// controllers/jengaController.js
const axios  = require('axios');
const pool   = require('../config/db');
const { getJengaToken, generateSignature } = require('../utils/jengaAuth');

const BASE = process.env.JENGA_BASE_URL;

// ── INITIATE M-PESA STK PUSH ──────────────────────────────
const initiateStkPush = async (req, res) => {
  const business_id = req.business.id;
  const { amount, phoneNumber, customerName, customerEmail } = req.body;

  if (!amount || !phoneNumber) {
    return res.status(400).json({ message: 'amount and phoneNumber are required' });
  }

  try {
    const token      = await getJengaToken();
    const orderRef   = `ORD${business_id}${Date.now()}`;
    const paymentRef = `PAY${business_id}${Date.now()}`;
    const cleanPhone = phoneNumber.replace(/^(\+254|254|0)/, '0');

    const signature = generateSignature([
      orderRef,
      'KES',
      cleanPhone,
      String(amount),
    ]);

    const payload = {
      order: {
        orderReference: orderRef,
        orderAmount:    amount,
        orderCurrency:  'KES',
        source:         'APICHECKOUT',
        countryCode:    'KE',
        description:    'Zuvy Pay Wallet Top Up',
      },
      customer: {
        name:           customerName  || 'Business Admin',
        email:          customerEmail || 'admin@zuvypay.com',
        phoneNumber:    cleanPhone,
        identityNumber: '00000000',
      },
      payment: {
        paymentReference: paymentRef,
        paymentCurrency:  'KES',
        channel:          'MOBILE',
        service:          'MPESA',
        provider:         'JENGA',
        callbackUrl:      process.env.JENGA_CALLBACK_URL,
        details: {
          msisdn:        cleanPhone,
          paymentAmount: amount,
        },
      },
    };

    const response = await axios.post(
      `${BASE}/api-checkout/mpesa-stk-push/v3.0/init`,
      payload,
      {
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
          'Signature':     signature,
        },
      }
    );

    await pool.query(
      `INSERT INTO wallet_transactions
        (business_id, type, amount, reference, description, balance_after)
       VALUES ($1, 'pending', $2, $3, 'M-Pesa STK Push', 0)`,
      [business_id, amount, paymentRef]
    );

    return res.json({
      message:       'STK push sent — check your phone',
      orderRef,
      paymentRef,
      jengaResponse: response.data,
    });
  } catch (error) {
    console.error('initiateStkPush error:', error?.response?.data || error.message);
    return res.status(500).json({
      message: 'Failed to initiate STK push',
      detail:  error?.response?.data,
    });
  }
};

const jengaCallback = async (req, res) => {
  res.setHeader('ngrok-skip-browser-warning', 'any-value');

  try {
    const body     = req.body;
    console.log('Jenga callback received:', JSON.stringify(body, null, 2));

    const stkCallback = body?.data?.Body?.stkCallback;
    const resultCode  = stkCallback?.ResultCode;
    const checkoutId  = stkCallback?.CheckoutRequestID;

    // Extract amount and receipt from CallbackMetadata
    const items      = stkCallback?.CallbackMetadata?.Item || [];
    const getItem    = (name) => items.find(i => i.Name === name)?.Value;
    const amount     = parseFloat(getItem('Amount') || 0);
    const mpesaRef   = getItem('MpesaReceiptNumber');

    console.log(`ResultCode: ${resultCode}, CheckoutID: ${checkoutId}, Amount: ${amount}, Ref: ${mpesaRef}`);

    if (resultCode === 0 && checkoutId && amount > 0) {
      // Find pending transaction by checkoutRequestId
      const txn = await pool.query(
        `SELECT * FROM wallet_transactions WHERE reference LIKE $1 AND type = 'pending'`,
        [`%${checkoutId}%`]
      );

      if (txn.rows.length > 0) {
        const { business_id, id } = txn.rows[0];

        await pool.query('BEGIN');

        const updated = await pool.query(
          `UPDATE businesses
           SET wallet_balance = wallet_balance + $1
           WHERE id = $2
           RETURNING wallet_balance`,
          [amount, business_id]
        );

        const newBalance = parseFloat(updated.rows[0].wallet_balance);

        await pool.query(
          `UPDATE wallet_transactions
           SET type = 'credit', balance_after = $1, 
               description = 'M-Pesa Top Up Success',
               reference = $2
           WHERE id = $3`,
          [newBalance, mpesaRef, id]
        );

        await pool.query('COMMIT');
        console.log(`Wallet credited for business ${business_id}. New balance: ${newBalance}`);
      } else {
        console.log(`No pending transaction found for checkout: ${checkoutId}`);
      }
    } else {
      console.log(`Payment failed — ResultCode: ${resultCode}`);
    }

    return res.status(200).json({ message: 'Callback received' });

  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('jengaCallback error:', error.message);
    return res.status(200).json({ message: 'Callback received' });
  }
};

// ── DISBURSE SALARY ───────────────────────────────────────
const disburseSalary = async ({ employeeName, phoneNumber, amount, reference }) => {
  const token = await getJengaToken();

  const signature = generateSignature([
    String(amount),
    'KES',
    reference,
    phoneNumber,
  ]);

  const payload = {
    source: {
      countryCode:   process.env.JENGA_COUNTRY_CODE,
      name:          process.env.JENGA_ACCOUNT_NAME,
      accountNumber: process.env.JENGA_ACCOUNT_NUMBER,
    },
    destination: {
      type:         'mobile',
      countryCode:  'KE',
      name:         employeeName,
      mobileNumber: phoneNumber,
      walletName:   'Mpesa',
    },
    transfer: {
      type:         'MobileWallet',
      amount:       String(amount),
      currencyCode: 'KES',
      reference,
      date:         new Date().toISOString().split('T')[0],
      description:  `Zuvy Pay Salary - ${employeeName}`,
    },
  };

  const response = await axios.post(
    `${BASE}/v3-apis/transaction-api/v3.0/remittance/sendmobile`,
    payload,
    {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        'Signature':     signature,
      },
    }
  );

  return response.data;
};

// ── QUERY STK STATUS ──────────────────────────────────────
const queryStkStatus = async (req, res) => {
  const { orderRef } = req.params;
  try {
    const token    = await getJengaToken();
    const response = await axios.get(
      `${BASE}/api-checkout/mpesa-stk-push/v3.0/status/${orderRef}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.json(response.data);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to query status' });
  }
};

// ── RECEIVE BANK DEPOSIT WEBHOOK ──────────────────────────
const receiveBankDeposit = async (req, res) => {
  try {
    const body        = req.body;
    console.log('Bank deposit webhook received:', JSON.stringify(body, null, 2));

    const reference  = body?.transactionReference || body?.reference;
    const amount     = parseFloat(body?.amount || body?.transactionAmount || 0);
    const senderName = body?.senderName || body?.source?.name || 'Unknown';
    const senderAcct = body?.senderAccount || body?.source?.accountNumber || null;

    if (!reference || amount <= 0) {
      return res.status(200).json({ message: 'Ignored — missing fields' });
    }

    await pool.query(
      `INSERT INTO pending_deposits
        (amount, reference, sender_name, sender_account, status)
       VALUES ($1, $2, $3, $4, 'unclaimed')
       ON CONFLICT (reference) DO NOTHING`,
      [amount, reference, senderName, senderAcct]
    );

    console.log(`Deposit received: KES ${amount} ref ${reference}`);
    return res.status(200).json({ message: 'Received' });

  } catch (error) {
    console.error('receiveBankDeposit error:', error.message);
    return res.status(200).json({ message: 'Received' });
  }
};

// ── OPEN VIRTUAL ACCOUNT ──────────────────────────────────
const openVirtualAccount = async (businessId, businessName, phone) => {
  try {
    const token     = await getJengaToken();
    const date      = new Date().toISOString().split('T')[0];
    const accountId = `ZUVY${businessId}`;
    const signature = generateSignature([accountId, 'KE', date]);

    const payload = {
      accountId,
      countryCode: 'KE',
      currency:    'KES',
      customer: {
        name:        businessName,
        mobilePhone: phone,
      },
      date,
    };

    const response = await axios.post(
      `${BASE}/v3-apis/account-api/v3.0/account`,
      payload,
      {
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
          'Signature':     signature,
        },
      }
    );

    const accountNumber = response.data?.account?.accountNumber
                       || response.data?.accountNumber;

    if (!accountNumber) {
      console.error('Jenga returned no account number:', response.data);
      return;
    }

    await pool.query(
      `UPDATE businesses SET virtual_account_number = $1 WHERE id = $2`,
      [accountNumber, businessId]
    );

    console.log(`Virtual account ${accountNumber} opened for business ${businessId}`);
    return accountNumber;

  } catch (err) {
    console.error('openVirtualAccount error:', err?.response?.data || err.message);
    throw err;
  }
};

module.exports = {
  initiateStkPush,
  jengaCallback,
  disburseSalary,
  queryStkStatus,
  receiveBankDeposit,
  openVirtualAccount,
};