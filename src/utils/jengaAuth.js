// utils/jengaAuth.js
const axios  = require('axios');
const crypto = require('crypto');

let _cachedToken = null;
let _tokenExpiry = 0;

// ── Get Bearer token (cached until it expires) ────────────
const getJengaToken = async () => {
  if (_cachedToken && Date.now() < _tokenExpiry) {
    return _cachedToken;
  }

  const response = await axios.post(
    `${process.env.JENGA_BASE_URL}/authentication/api/v3/authenticate/merchant`,
    {
      merchantCode:   process.env.JENGA_MERCHANT_CODE,
      consumerSecret: process.env.JENGA_CONSUMER_SECRET,
    },
    {
      headers: {
        'Api-Key':      process.env.JENGA_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  _cachedToken = response.data.accessToken;
  _tokenExpiry = Date.now() + 55 * 60 * 1000;
  return _cachedToken;
};

// ── Generate RSA-SHA256 signature ─────────────────────────
const generateSignature = (fields) => {
  const data = fields.join('');

  // Handle collapsed newlines from dotenv
  const rawKey    = process.env.JENGA_PRIVATE_KEY || '';
  const privateKey = rawKey.includes('\\n')
    ? rawKey.replace(/\\n/g, '\n')
    : rawKey;

  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign({ key: privateKey, format: 'pem' }, 'base64');
};

module.exports = { getJengaToken, generateSignature };