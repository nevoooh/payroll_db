// controllers/payrollController.js
// Zuvy — Payroll Controller + Auto Disbursement
// ─────────────────────────────────────────────────────────────────────────────
const pool = require('../config/db');
const { calculatePayroll }    = require('../utils/calculations');
const { disburseBulkPayroll } = require('../services/jengaService');

// ── RUN PAYROLL ───────────────────────────────────────────────────────────────
const runPayroll = async (req, res) => {
  const business_id = req.business.id;
  const { month, year } = req.body;

  if (!month || !year) {
    return res.status(400).json({ message: 'Month and year are required' });
  }
  if (month < 1 || month > 12) {
    return res.status(400).json({ message: 'Month must be between 1 and 12' });
  }

  try {
    // 1. Prevent duplicate
    const duplicate = await pool.query(
      `SELECT id FROM payroll_runs 
       WHERE business_id = $1 AND month = $2 AND year = $3`,
      [business_id, month, year]
    );
    if (duplicate.rows.length > 0) {
      return res.status(400).json({
        message: `Payroll for ${month}/${year} already run`,
      });
    }

    // 2. Get business + wallet
    const bizResult = await pool.query(
      `SELECT name, wallet_balance FROM businesses WHERE id = $1`,
      [business_id]
    );
    if (bizResult.rows.length === 0) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const { name: businessName, wallet_balance } = bizResult.rows[0];

    // 3. Get active employees
    const empResult = await pool.query(
      `SELECT * FROM employees 
       WHERE business_id = $1 AND is_active = true`,
      [business_id]
    );
    if (empResult.rows.length === 0) {
      return res.status(400).json({ message: 'No active employees found' });
    }
    const employees = empResult.rows;

    // 4. Calculate totals
    let totalGross = 0, totalNet = 0, totalPaye = 0;
    let totalShif  = 0, totalNssf = 0, totalHousingLevy = 0;
    let totalPlatformFee = 0;
    const payrollItems = [];

    for (const emp of employees) {
      const calc = calculatePayroll(parseFloat(emp.gross_salary));
      totalGross       += calc.grossSalary;
      totalNet         += calc.netSalary;
      totalPaye        += calc.paye;
      totalShif        += calc.shif;
      totalNssf        += calc.nssf;
      totalHousingLevy += calc.housingLevy;
      totalPlatformFee += calc.platformFee;
      payrollItems.push({ employee: emp, calc });
    }

    const totalRequired = parseFloat((totalNet + totalPlatformFee).toFixed(2));

    // 5. Check wallet
    if (parseFloat(wallet_balance) < totalRequired) {
      return res.status(400).json({
        message:       'Insufficient wallet balance',
        walletBalance: parseFloat(wallet_balance),
        required:      totalRequired,
        shortfall:     parseFloat((totalRequired - parseFloat(wallet_balance)).toFixed(2)),
      });
    }

    // 6. Generate reference
    const monthStr  = String(month).padStart(2, '0');
    const reference = `ZUVY-${business_id}-${year}${monthStr}-${Date.now()}`;

    // 7. Save payroll run
    const runResult = await pool.query(
      `INSERT INTO payroll_runs
        (business_id, month, year,
         total_gross, total_net, total_paye, total_shif, total_nssf,
         total_housing_levy, total_platform_fee,
         payment_reference, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'processing')
       RETURNING *`,
      [
        business_id, month, year,
        parseFloat(totalGross.toFixed(2)),
        parseFloat(totalNet.toFixed(2)),
        parseFloat(totalPaye.toFixed(2)),
        parseFloat(totalShif.toFixed(2)),
        parseFloat(totalNssf.toFixed(2)),
        parseFloat(totalHousingLevy.toFixed(2)),
        parseFloat(totalPlatformFee.toFixed(2)),
        reference,
      ]
    );
    const payrollRunId = runResult.rows[0].id;

    // 8. Save payroll items
    for (const { employee: emp, calc } of payrollItems) {
      await pool.query(
        `INSERT INTO payroll_items
          (payroll_run_id, employee_id,
           gross_salary, paye, shif, nssf, housing_levy,
           platform_fee, net_salary, payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
        [
          payrollRunId, emp.id,
          calc.grossSalary, calc.paye, calc.shif,
          calc.nssf, calc.housingLevy, calc.platformFee, calc.netSalary,
        ]
      );
    }

    // 9. Deduct wallet
    await pool.query(
      `UPDATE businesses SET wallet_balance = wallet_balance - $1 WHERE id = $2`,
      [totalRequired, business_id]
    );

    // 10. Respond immediately — don't make employer wait for disbursements
    res.status(201).json({
      message:   'Payroll initiated — disbursing to employees now',
      reference,
      summary: {
        businessName,
        month,
        year,
        totalEmployees:    employees.length,
        totalGross:        parseFloat(totalGross.toFixed(2)),
        totalNet:          parseFloat(totalNet.toFixed(2)),
        totalPaye:         parseFloat(totalPaye.toFixed(2)),
        totalShif:         parseFloat(totalShif.toFixed(2)),
        totalNssf:         parseFloat(totalNssf.toFixed(2)),
        totalHousingLevy:  parseFloat(totalHousingLevy.toFixed(2)),
        totalPlatformFee:  parseFloat(totalPlatformFee.toFixed(2)),
        totalRequired,
        walletBalanceAfter: parseFloat(
          (parseFloat(wallet_balance) - totalRequired).toFixed(2)
        ),
      },
    });

    // 11. Fire JengaAPI disbursements in background
    // Don't await — employer already got their response above
    disburseBulkPayroll(payrollRunId, businessName)
      .then((result) => {
        console.log(`Payroll ${payrollRunId} disbursement: ${result.status}`);
      })
      .catch((err) => {
        console.error(`Payroll ${payrollRunId} disbursement error:`, err.message);
      });

  } catch (error) {
    console.error('runPayroll error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET PAYROLL HISTORY ───────────────────────────────────────────────────────
const getPayrollHistory = async (req, res) => {
  const business_id = req.business.id;
  try {
    const result = await pool.query(
      `SELECT id, month, year, status,
              total_gross, total_net, total_paye,
              total_shif, total_nssf, total_housing_levy,
              total_platform_fee, payment_reference, created_at
       FROM payroll_runs
       WHERE business_id = $1
       ORDER BY year DESC, month DESC`,
      [business_id]
    );
    return res.json({ payrolls: result.rows });
  } catch (error) {
    console.error('getPayrollHistory error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET PAYROLL DETAILS ───────────────────────────────────────────────────────
const getPayrollDetails = async (req, res) => {
  const { id }      = req.params;
  const business_id = req.business.id;
  try {
    const runResult = await pool.query(
      `SELECT * FROM payroll_runs WHERE id = $1 AND business_id = $2`,
      [id, business_id]
    );
    if (runResult.rows.length === 0) {
      return res.status(404).json({ message: 'Payroll run not found' });
    }

    const itemsResult = await pool.query(
      `SELECT pi.id, e.full_name, e.phone, e.bank_name, e.bank_account,
              pi.gross_salary, pi.nssf, pi.shif, pi.housing_levy,
              pi.paye, pi.platform_fee, pi.net_salary,
              pi.payment_status, pi.jenga_reference
       FROM payroll_items pi
       JOIN employees e ON pi.employee_id = e.id
       WHERE pi.payroll_run_id = $1
       ORDER BY e.full_name ASC`,
      [id]
    );

    return res.json({
      payroll: runResult.rows[0],
      items:   itemsResult.rows,
    });
  } catch (error) {
    console.error('getPayrollDetails error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── CURRENT MONTH ─────────────────────────────────────────────────────────────
const getCurrentMonthSummary = async (req, res) => {
  const business_id = req.business.id;
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  try {
    const result = await pool.query(
      `SELECT * FROM payroll_runs 
       WHERE business_id = $1 AND month = $2 AND year = $3`,
      [business_id, month, year]
    );
    return res.json({ month, year, payroll: result.rows[0] || null });
  } catch (error) {
    console.error('getCurrentMonthSummary error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/payroll/estimate/:gross
const estimateSalary = async (req, res) => {
  try {
    const gross = parseFloat(req.params.gross);
    if (isNaN(gross) || gross <= 0) {
      return res.status(400).json({ message: 'Invalid gross salary' });
    }
    const calc = calculatePayroll(gross);
    return res.json(calc);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// Add to exports:
module.exports = {
  runPayroll,
  getPayrollHistory,
  getPayrollDetails,
  getCurrentMonthSummary,
  estimateSalary, // ← add
};