// routes/payrollRoutes.js
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  runPayroll,
  getPayrollHistory,
  getPayrollDetails,
  getCurrentMonthSummary,  // ← add this
  estimateSalary,
} = require('../controllers/payrollController');

// ⚠️ ORDER MATTERS — specific routes BEFORE /:id
router.post('/run',         protect, runPayroll);
router.get('/history',      protect, getPayrollHistory);
router.get('/current',      protect, getCurrentMonthSummary);  // ← add this
// Add BEFORE /:id route
router.get('/estimate/:gross', protect, estimateSalary);
router.get('/:id',          protect, getPayrollDetails);       // ← always last

module.exports = router;