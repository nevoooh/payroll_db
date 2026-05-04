// services/jengaService.js
const axios  = require('axios');
const pool   = require('../config/db');
const { getJengaToken, generateSignature } = require('../utils/jengaAuth');

const BASE = process.env.JENGA_BASE_URL;

const normalisePhone = (phone) => {
  if (!phone) return '';
  const clean = phone.replace(/\s+/g, '');
  if (clean.startsWith('+254')) return '0' + clean.slice(4);
  if (clean.startsWith('254'))  return '0' + clean.slice(3);
  return clean;
};

// ── BULK PAYROLL DISBURSE (called in background after runPayroll) ──────────────
const disburseBulkPayroll = async (payrollRunId, businessName) => {
  console.log(`\n🚀 Starting disbursement for payroll run ${payrollRunId}`);

  const itemsResult = await pool.query(
    `SELECT pi.id, pi.net_salary, pi.employee_id,
            e.full_name, e.phone
     FROM payroll_items pi
     JOIN employees e ON pi.employee_id = e.id
     WHERE pi.payroll_run_id = $1 AND pi.payment_status = 'pending'`,
    [payrollRunId]
  );

  const items = itemsResult.rows;
  if (items.length === 0) return { status: 'no_items' };

  let successCount = 0;
  let failCount    = 0;

  for (const item of items) {
    const reference = `SAL-${payrollRunId}-${item.employee_id}-${Date.now()}`;
    const phone     = normalisePhone(item.phone);
    const amount    = parseFloat(item.net_salary);

    try {
      const token     = await getJengaToken();
      const signature = generateSignature([
        String(amount),
        'KES',
        reference,
        phone,
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
          name:         item.full_name,
          mobileNumber: phone,
          walletName:   'Mpesa',
        },
        transfer: {
          type:         'MobileWallet',
          amount:       String(amount),
          currencyCode: 'KES',
          reference,
          date:         new Date().toISOString().split('T')[0],
          description:  `Salary - ${businessName}`,
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
          timeout: 30000,
        }
      );

      await pool.query(
        `UPDATE payroll_items
         SET payment_status = 'disbursed', jenga_reference = $1
         WHERE id = $2`,
        [response.data?.transactionId || reference, item.id]
      );

      console.log(`✅ Paid ${item.full_name} KES ${amount}`);
      successCount++;

    } catch (err) {
      console.error(`❌ Failed for ${item.full_name}:`, err?.response?.data || err.message);
      await pool.query(
        `UPDATE payroll_items SET payment_status = 'failed' WHERE id = $1`,
        [item.id]
      );
      failCount++;
    }

    // Small delay to avoid Jenga rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  const finalStatus = failCount === 0 ? 'completed'
                    : successCount === 0 ? 'failed'
                    : 'partial';

  await pool.query(
    `UPDATE payroll_runs SET status = $1 WHERE id = $2`,
    [finalStatus, payrollRunId]
  );

  console.log(`\n📊 Done — ✅ ${successCount} paid, ❌ ${failCount} failed`);
  return { status: finalStatus, successCount, failCount };
};

module.exports = { disburseBulkPayroll };