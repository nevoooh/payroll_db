require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });  

const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const reportRoutes = require('./routes/reportRoutes');
const walletRoutes = require('./routes/walletRoutes');
const jengaRoutes = require('./routes/jengaRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/jenga', jengaRoutes);
app.get('/', (req, res) => {
  res.json({ message: 'Zuvy Payroll API Running 🚀' });
});

// ← ADD THIS — catches any unhandled errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err?.message || err);
  res.status(500).json({ message: 'Something went wrong' });
});

const PORT = process.env.PORT || 3000; // ← use .env port
app.listen(PORT, () => {
  console.log(`✅ Zuvy API running on port ${PORT}`);
});