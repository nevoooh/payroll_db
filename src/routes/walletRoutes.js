// routes/walletRoutes.js
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getWalletBalance,
  topUpWallet,
  getWalletTransactions,
  getWalletSummary,
  getBankDetails
} = require('../controllers/walletController');

router.get('/balance',      protect, getWalletBalance);
router.get('/summary',      protect, getWalletSummary);
router.get('/transactions', protect, getWalletTransactions);
router.post('/topup',       protect, topUpWallet);
router.get('/bank-details', getBankDetails);
module.exports = router;