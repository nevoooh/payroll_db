const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  getMonthlySummary,
  getAnnualSummary 
} = require('../controllers/reportController');

router.get('/:month/:year', protect, getMonthlySummary);
router.get('/annual/:year', protect, getAnnualSummary);

module.exports = router;