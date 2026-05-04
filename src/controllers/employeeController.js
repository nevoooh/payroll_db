const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// BANK CODE LOOKUP
// Backend handles this — Flutter just sends bank_name, we resolve the code
// ─────────────────────────────────────────────────────────────────────────────
const BANK_CODES = {
  'Equity Bank':          '63',
  'KCB':                  '01',
  'Co-operative Bank':    '11',
  'Absa Bank':            '03',
  'Standard Chartered':   '02',
  'NCBA Bank':            '07',
  'DTB':                  '63',
  'Family Bank':          '70',
  'Stanbic Bank':         '31',
  'I&M Bank':             '57',
  'Prime Bank':           '10',
  'NIC Bank':             '07',
  'Sidian Bank':          '66',
  'Gulf African Bank':    '72',
  'HF Group':             '61',
  'Mpesa':                '00', // mobile money
};

const resolveBankCode = (bankName) => {
  if (!bankName) return null;
  // Try exact match first
  if (BANK_CODES[bankName]) return BANK_CODES[bankName];
  // Try partial match (case insensitive)
  const key = Object.keys(BANK_CODES).find(k =>
    k.toLowerCase().includes(bankName.toLowerCase()) ||
    bankName.toLowerCase().includes(k.toLowerCase())
  );
  return key ? BANK_CODES[key] : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────
const addEmployee = async (req, res) => {
  const {
    full_name,
    id_number,
    phone,
    gross_salary,
    bank_name,
    bank_account,
    account_name,
    payment_method = 'bank',
    kra_pin,
    nssf_number,
  } = req.body;

  const business_id = req.business.id;

  // Resolve bank code from bank name
  const bank_code = resolveBankCode(bank_name);

  // Basic validation
  if (!full_name || !gross_salary) {
    return res.status(400).json({ message: 'Full name and gross salary are required' });
  }

  if (payment_method === 'bank' && (!bank_name || !bank_account)) {
    return res.status(400).json({ message: 'Bank name and account number are required for bank payments' });
  }

  if (payment_method === 'mpesa' && !phone) {
    return res.status(400).json({ message: 'Phone number is required for M-Pesa payments' });
  }

  try {
    // Check for duplicate ID number within same business
    if (id_number) {
      const existing = await pool.query(
        'SELECT id FROM employees WHERE id_number = $1 AND business_id = $2 AND is_active = true',
        [id_number, business_id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: 'An employee with this ID number already exists' });
      }
    }

    const result = await pool.query(
      `INSERT INTO employees 
        (business_id, full_name, id_number, phone, gross_salary,
         bank_name, bank_code, bank_account, account_name, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        business_id, full_name, id_number, phone, gross_salary,
        bank_name, bank_code, bank_account,
        account_name || full_name, // default account name to employee name
        payment_method,
      ]
    );

    res.status(201).json({
      message: 'Employee added successfully',
      employee: result.rows[0],
    });

  } catch (error) {
    console.error('addEmployee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL EMPLOYEES
// Returns active + inactive — Flutter filters by is_active if needed
// ─────────────────────────────────────────────────────────────────────────────
const getEmployees = async (req, res) => {
  const business_id = req.business.id;
  const { status } = req.query; // ?status=active | ?status=inactive | (all)

  try {
    let query = 'SELECT * FROM employees WHERE business_id = $1';
    const params = [business_id];

    if (status === 'active') {
      query += ' AND is_active = true';
    } else if (status === 'inactive') {
      query += ' AND is_active = false';
    }

    query += ' ORDER BY full_name ASC';

    const result = await pool.query(query, params);

    // Return summary counts too — useful for dashboard
    const active   = result.rows.filter(e => e.is_active).length;
    const inactive = result.rows.filter(e => !e.is_active).length;
    const totalGross = result.rows
      .filter(e => e.is_active)
      .reduce((sum, e) => sum + parseFloat(e.gross_salary), 0);

    res.json({
      employees:   result.rows,
      summary: {
        total:      result.rows.length,
        active,
        inactive,
        totalGross, // total gross salary of active employees
      },
    });

  } catch (error) {
    console.error('getEmployees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────
const getEmployee = async (req, res) => {
  const { id } = req.params;
  const business_id = req.business.id;

  try {
    const result = await pool.query(
      'SELECT * FROM employees WHERE id = $1 AND business_id = $2',
      [id, business_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ employee: result.rows[0] });

  } catch (error) {
    console.error('getEmployee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────
const updateEmployee = async (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    phone,
    gross_salary,
    bank_name,
    bank_account,
    account_name,
    payment_method,
  } = req.body;

  const business_id = req.business.id;

  // Re-resolve bank code if bank name changed
  const bank_code = bank_name ? resolveBankCode(bank_name) : undefined;

  try {
    // Build dynamic update — only update fields that were sent
    const fields  = [];
    const values  = [];
    let   counter = 1;

    const addField = (col, val) => {
      if (val !== undefined && val !== null) {
        fields.push(`${col} = $${counter++}`);
        values.push(val);
      }
    };

    addField('full_name',       full_name);
    addField('phone',           phone);
    addField('gross_salary',    gross_salary);
    addField('bank_name',       bank_name);
    addField('bank_code',       bank_code);
    addField('bank_account',    bank_account);
    addField('account_name',    account_name);
    addField('payment_method',  payment_method);

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(id, business_id);

    const result = await pool.query(
      `UPDATE employees SET ${fields.join(', ')}
       WHERE id = $${counter} AND business_id = $${counter + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      message:  'Employee updated successfully',
      employee: result.rows[0],
    });

  } catch (error) {
    console.error('updateEmployee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE EMPLOYEE STATUS (active ↔ inactive)
// Soft delete — never hard delete employees (payroll history needs them)
// ─────────────────────────────────────────────────────────────────────────────
const toggleEmployeeStatus = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body; // true or false
  const business_id = req.business.id;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ message: 'is_active must be true or false' });
  }

  try {
    const result = await pool.query(
      `UPDATE employees SET is_active = $1
       WHERE id = $2 AND business_id = $3
       RETURNING *`,
      [is_active, id, business_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      message:  `Employee ${is_active ? 'activated' : 'deactivated'} successfully`,
      employee: result.rows[0],
    });

  } catch (error) {
    console.error('toggleEmployeeStatus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE EMPLOYEE (soft delete — same as deactivate)
// Kept for backward compatibility with existing Flutter service
// ─────────────────────────────────────────────────────────────────────────────
const deleteEmployee = async (req, res) => {
  const { id } = req.params;
  const business_id = req.business.id;

  try {
    const result = await pool.query(
      `UPDATE employees SET is_active = false
       WHERE id = $1 AND business_id = $2
       RETURNING id, full_name`,
      [id, business_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ message: 'Employee removed successfully' });

  } catch (error) {
    console.error('deleteEmployee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET BANK LIST
// Flutter calls this to populate the bank dropdown
// ─────────────────────────────────────────────────────────────────────────────
const getBanks = async (req, res) => {
  const banks = Object.entries(BANK_CODES)
    .filter(([name]) => name !== 'Mpesa')
    .map(([name, code]) => ({ name, code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ banks });
};
// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATE SALARY BREAKDOWN
// GET /api/employees/estimate?gross=45000
// No DB writes — pure calculation for the detail sheet preview
// ─────────────────────────────────────────────────────────────────────────────
const { calculatePayroll } = require('../utils/calculations');

const estimateSalary = async (req, res) => {
  const gross = parseFloat(req.query.gross);
  if (!gross || gross <= 0) {
    return res.status(400).json({ message: 'Valid gross salary required' });
  }
  res.json(calculatePayroll(gross));
};
module.exports = {
  addEmployee,
  getEmployees,
  getEmployee,
  updateEmployee,
  toggleEmployeeStatus,
  deleteEmployee,
  getBanks,
  estimateSalary,
};