// routes/jengaRoutes.js
const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const {
  initiateStkPush,
  jengaCallback,
  queryStkStatus,
  openVirtualAccount,
} = require('../controllers/jengaController');

router.post('/stk-push',            protect, initiateStkPush);
router.get('/stk-status/:orderRef', protect, queryStkStatus);
router.post('/callback',                     jengaCallback);

router.post('/open-virtual-account', protect, async (req, res) => {
  try {
    const { id, name, phone } = req.business;
    const accountNumber = await openVirtualAccount(id, name, phone);
    return res.json({ message: 'Virtual account opened', accountNumber });
  } catch (err) {
    return res.status(500).json({ message: 'Failed', detail: err.message });
  }
});

module.exports = router;