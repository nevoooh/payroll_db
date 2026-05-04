const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { openVirtualAccount } = require('./jengaController');

// Register Business
const register = async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    // Check if email exists
    const exists = await pool.query(
      'SELECT * FROM businesses WHERE email = $1',
      [email]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Save business
    const result = await pool.query(
      'INSERT INTO businesses (name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [name, email, phone, hash]
    );

    const business = result.rows[0];

    // Open virtual account in background — don't block signup if it fails
    openVirtualAccount(business.id, name, phone).catch((err) =>
      console.error('Virtual account opening failed for business', business.id, err.message)
    );

    res.status(201).json({
      message: 'Business registered successfully',
      business,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login Business
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM businesses WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const business = result.rows[0];
    const valid = await bcrypt.compare(password, business.password_hash);
    if (!valid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: business.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      business: {
        id:                     business.id,
        name:                   business.name,
        email:                  business.email,
        virtual_account_number: business.virtual_account_number,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Business Profile
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, virtual_account_number, created_at FROM businesses WHERE id = $1',
      [req.business.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Business not found' });
    }
    res.json({ business: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { register, login, getProfile };