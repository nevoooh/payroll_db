require('dotenv').config();
const { getJengaToken, generateSignature } = require('./src/utils/jengaAuth');
const axios = require('axios');

async function test() {
  const token = await getJengaToken();
 const orderRef = 'TEST' + Date.now();
const payRef = 'PAY' + Date.now();
  const phone = '254716730442';
  const amount = '2';

  const signature = generateSignature([orderRef, 'KES', phone, amount]);

  const res = await axios.post(
    process.env.JENGA_BASE_URL + '/api-checkout/mpesa-stk-push/v3.0/init',
    {
      order: { orderReference: orderRef, orderAmount: amount, orderCurrency: 'KES', source: 'APICHECKOUT', countryCode: 'KE', description: 'Test' },
      customer: { name: 'Test', email: 'test@test.com', phoneNumber: phone, identityNumber: '00000000' },
      payment: { paymentReference: payRef, paymentCurrency: 'KES', channel: 'MOBILE', service: 'MPESA', provider: 'JENGA',
        callbackUrl: process.env.JENGA_CALLBACK_URL,
        details: { msisdn: phone, paymentAmount: amount }
      }
    },
    { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, Signature: signature } }
  );
  console.log('✅ STK push response:', JSON.stringify(res.data, null, 2));
}

test().catch(err => console.log('❌ Failed:', err?.response?.data || err.message));