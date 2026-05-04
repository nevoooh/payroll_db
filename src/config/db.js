const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'payroll_db',
  user: 'postgres',
  password: 'Caleb15.ongaga',
});

pool.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully');
  }
});

module.exports = pool;