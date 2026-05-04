// controllers/walletController.js
// Zuvy — Wallet Controller
// ─────────────────────────────────────────────────────────────────────────────
const pool = require('../config/db');
const { calculatePayroll } = require('../utils/calculations');

// ── GET WALLET BALANCE ────────────────────────────────────────────────────────
const getWalletBalance = async (req, res) => {
  const business_id = req.business.id;
  try {
    const result = await pool.query(
      `SELECT wallet_balance FROM businesses WHERE id = $1`,
      [business_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Business not found' });
    }
    return res.json({ balance: parseFloat(result.rows[0].wallet_balance) });
  } catch (error) {
    console.error('getWalletBalance error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── TOP UP WALLET (bank transfer — matches against pending_deposits) ───────────
const topUpWallet = async (req, res) => {
  const business_id = req.business.id;
  const { amount, reference } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Valid amount is required' });
  }
  if (!reference) {
    return res.status(400).json({ message: 'Reference number is required' });
  }

  try {
    // 1. Find unclaimed deposit matching this reference
    const deposit = await pool.query(
      `SELECT * FROM pending_deposits
       WHERE reference = $1 AND status = 'unclaimed'`,
      [reference]
    );

    if (deposit.rows.length === 0) {
      return res.status(400).json({
        message: 'Reference not found or already claimed — check your reference number',
      });
    }

    const found = deposit.rows[0];

    // 2. Amount must match exactly (allow 1 cent rounding tolerance)
    if (Math.abs(parseFloat(found.amount) - parseFloat(amount)) > 0.01) {
      return res.status(400).json({
        message: `Amount doesn't match — we received KSh ${found.amount} for this reference`,
      });
    }

    // 3. Claim it atomically — prevents double claiming
    const claimed = await pool.query(
      `UPDATE pending_deposits
       SET status = 'claimed', claimed_by = $1, claimed_at = now()
       WHERE reference = $2 AND status = 'unclaimed'
       RETURNING id`,
      [business_id, reference]
    );

    if (claimed.rows.length === 0) {
      return res.status(400).json({ message: 'Already claimed — try refreshing' });
    }

    // 4. Credit the wallet
    const result = await pool.query(
      `UPDATE businesses
       SET wallet_balance = wallet_balance + $1
       WHERE id = $2
       RETURNING wallet_balance`,
      [found.amount, business_id]
    );

    const newBalance = parseFloat(result.rows[0].wallet_balance);

    // 5. Log the transaction
    await pool.query(
      `INSERT INTO wallet_transactions
        (business_id, type, amount, reference, description, balance_after)
       VALUES ($1, 'credit', $2, $3, 'Wallet top up via bank transfer', $4)`,
      [business_id, found.amount, reference, newBalance]
    );

    return res.json({
      message: 'Wallet topped up successfully',
      amount: parseFloat(found.amount),
      newBalance,
    });
  } catch (error) {
    console.error('topUpWallet error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET WALLET TRANSACTIONS ───────────────────────────────────────────────────
const getWalletTransactions = async (req, res) => {
  const business_id = req.business.id;
  try {
    const result = await pool.query(
      `SELECT id, type, amount, reference, description, balance_after, created_at
       FROM wallet_transactions
       WHERE business_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [business_id]
    );
    return res.json({ transactions: result.rows });
  } catch (error) {
    console.error('getWalletTransactions error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET WALLET SUMMARY ────────────────────────────────────────────────────────
const getWalletSummary = async (req, res) => {
  const business_id = req.business.id;
  try {
    // 1. Balance
    const bizResult = await pool.query(
      `SELECT wallet_balance FROM businesses WHERE id = $1`,
      [business_id]
    );
    if (bizResult.rows.length === 0) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const balance = parseFloat(bizResult.rows[0].wallet_balance);

    // 2. Active employees
    const empResult = await pool.query(
      `SELECT id, gross_salary FROM employees
       WHERE business_id = $1 AND is_active = true`,
      [business_id]
    );
    const employees      = empResult.rows;
    const totalEmployees = employees.length;

    // 3. Already run this month?
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    const payrollCheck = await pool.query(
      `SELECT id, status FROM payroll_runs
       WHERE business_id = $1 AND month = $2 AND year = $3`,
      [business_id, month, year]
    );
    const alreadyRun       = payrollCheck.rows.length > 0;
    const currentPayrollId = alreadyRun ? payrollCheck.rows[0].id     : null;
    const currentStatus    = alreadyRun ? payrollCheck.rows[0].status : null;

    // 4. No employees edge case
    if (totalEmployees === 0) {
      return res.json({
        balance,
        totalEmployees:       0,
        totalGross:           0,
        totalDeductions:      0,
        estimatedNet:         0,
        platformFees:         0,
        estimatedNextPayroll: 0,
        shortfall:            0,
        sufficient:           true,
        topUpNeeded:          0,
        alreadyRun,
        currentPayrollId,
        currentStatus,
        month,
        year,
      });
    }

    // 5. Real calculation per employee using payroll engine
    let estimatedNet    = 0;
    let totalDeductions = 0;
    let totalGross      = 0;
    let platformFees    = 0;

    for (const emp of employees) {
      const calc    = calculatePayroll(parseFloat(emp.gross_salary));
      estimatedNet    += calc.netSalary;
      totalDeductions += calc.totalDeductions;
      totalGross      += calc.grossSalary;
      platformFees    += calc.platformFee;
    }

    estimatedNet    = parseFloat(estimatedNet.toFixed(2));
    totalGross      = parseFloat(totalGross.toFixed(2));
    totalDeductions = parseFloat(totalDeductions.toFixed(2));
    platformFees    = parseFloat(platformFees.toFixed(2));

    const estimatedTotal = parseFloat((estimatedNet + platformFees).toFixed(2));
    const shortfall      = parseFloat(Math.max(0, estimatedTotal - balance).toFixed(2));
    const sufficient     = balance >= estimatedTotal;

    return res.json({
      balance,
      totalEmployees,
      totalGross,
      totalDeductions,
      estimatedNet,
      platformFees,
      estimatedNextPayroll: estimatedTotal,
      shortfall,
      sufficient,
      topUpNeeded:      shortfall,
      alreadyRun,
      currentPayrollId,
      currentStatus,
      month,
      year,
    });
  } catch (error) {
    console.error('getWalletSummary error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
const getBankDetails = async (req, res) => {
  const business_id = req.business.id;
  try {
    const result = await pool.query(
      `SELECT virtual_account_number FROM businesses WHERE id = $1`,
      [business_id]
    );

    const virtualAccount = result.rows[0]?.virtual_account_number;

    return res.json({
      accountNumber: virtualAccount || process.env.JENGA_ACCOUNT_NUMBER,
      accountName:   'Equity Bank Kenya',
      bankName:      'Equity Bank Kenya',
      isVirtual:     !!virtualAccount,
    });
  } catch (error) {
    console.error('getBankDetails error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
module.exports = {
  getWalletBalance,
  topUpWallet,
  getWalletTransactions,
  getWalletSummary,
  getBankDetails, 
};