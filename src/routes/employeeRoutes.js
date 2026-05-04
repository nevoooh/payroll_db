const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  addEmployee,
  getEmployees,
  getEmployee,
  updateEmployee,
  toggleEmployeeStatus,
  deleteEmployee,
  getBanks,
  estimateSalary,       // ← added
} = require('../controllers/employeeController');

// static routes BEFORE /:id — otherwise Express reads them as an id param
router.get   ('/banks',       protect, getBanks);
router.get   ('/estimate',    protect, estimateSalary);   // ← added

router.get   ('/',            protect, getEmployees);
router.post  ('/',            protect, addEmployee);
router.get   ('/:id',         protect, getEmployee);
router.put   ('/:id',         protect, updateEmployee);
router.patch ('/:id/status',  protect, toggleEmployeeStatus);
router.delete('/:id',         protect, deleteEmployee);

module.exports = router;