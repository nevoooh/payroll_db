const pool = require('../config/db');

// Get Monthly Summary
const getMonthlySummary = async (req, res) => {
  const business_id = req.business.id;
  const { month, year } = req.params;

  try {
    const payroll = await pool.query(
      `SELECT pr.*, 
      COUNT(pi.id) as total_employees
      FROM payroll_runs pr
      JOIN payroll_items pi ON pr.id = pi.payroll_run_id
      WHERE pr.business_id = $1 
      AND pr.month = $2 
      AND pr.year = $3
      GROUP BY pr.id`,
      [business_id, month, year]
    );

    if (payroll.rows.length === 0) {
      return res.status(404).json({ 
        message: 'No payroll found for this month' 
      });
    }

    const items = await pool.query(
      `SELECT 
        e.full_name,
        e.phone,
        pi.gross_salary,
        pi.paye,
        pi.shif,
        pi.nssf,
        pi.platform_fee,
        pi.net_salary,
        pi.payment_status
      FROM payroll_items pi
      JOIN employees e ON pi.employee_id = e.id
      JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
      WHERE pr.business_id = $1
      AND pr.month = $2
      AND pr.year = $3`,
      [business_id, month, year]
    );

    res.json({
      summary: payroll.rows[0],
      employees: items.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Annual Summary
const getAnnualSummary = async (req, res) => {
  const business_id = req.business.id;
  const { year } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        month,
        total_gross,
        total_net,
        total_paye,
        total_shif,
        total_nssf,
        total_platform_fee,
        status
      FROM payroll_runs
      WHERE business_id = $1
      AND year = $2
      ORDER BY month ASC`,
      [business_id, year]
    );

    const totals = result.rows.reduce((acc, row) => {
      acc.totalGross += parseFloat(row.total_gross || 0);
      acc.totalNet += parseFloat(row.total_net || 0);
      acc.totalPaye += parseFloat(row.total_paye || 0);
      acc.totalShif += parseFloat(row.total_shif || 0);
      acc.totalNssf += parseFloat(row.total_nssf || 0);
      return acc;
    }, {
      totalGross: 0,
      totalNet: 0,
      totalPaye: 0,
      totalShif: 0,
      totalNssf: 0
    });

    res.json({
      year,
      months: result.rows,
      totals
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getMonthlySummary, getAnnualSummary };