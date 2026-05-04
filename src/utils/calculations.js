// utils/calculations.js
// Zuvy Payroll Engine — Kenya 2026 Tax Rates
// ─────────────────────────────────────────────────────────────────────────────
// Sources:
//   NSSF  — NSSF Act 2013, Year 4 rates effective 1 Feb 2026
//           LEL: KSh 9,000 | UEL: KSh 108,000 | Rate: 6% employee
//   SHIF  — Social Health Insurance Fund (replaced NHIF Oct 2024)
//           Rate: 2.75% of gross, minimum KSh 300
//   AHL   — Affordable Housing Act 2024 + Tax Laws (Amendment) Act 2024
//           Rate: 1.5% of gross. Pre-tax deduction per KRA notice Dec 2024.
//   PAYE  — Income Tax Act Cap 470, Finance Act 2024
//           Taxable = Gross - NSSF - SHIF - AHL
//           Bands: 10/25/30/32.5/35%. Personal relief: KSh 2,400/mo.
// ─────────────────────────────────────────────────────────────────────────────


// ── NSSF ─────────────────────────────────────────────────────────────────────
// Tiered system per NSSF Act 2013, Year 4 (effective 1 Feb 2026):
//   Tier I  — 6% on first KSh 9,000         → max KSh 540
//   Tier II — 6% on KSh 9,001 to KSh 108,000 → max KSh 5,940
//   Total employee max: KSh 6,480/month
//   Employer matches the same amount (not deducted from employee here).
//
// FIX: Old code used flat 6% of gross capped at KSh 2,160 — that was
//      wrong. A KSh 50,000 earner should pay KSh 3,000, not KSh 2,160.
const calculateNSSF = (gross) => {
  const LEL = 9000;    // Lower Earnings Limit (Tier I ceiling)
  const UEL = 108000;  // Upper Earnings Limit (Tier II ceiling)

  if (gross <= 0)   return 0;
  if (gross <= LEL) return parseFloat((gross * 0.06).toFixed(2));

  const tier1 = LEL * 0.06;                                  // KSh 540
  const tier2 = (Math.min(gross, UEL) - LEL) * 0.06;        // max KSh 5,940
  return parseFloat((tier1 + tier2).toFixed(2));             // max KSh 6,480
};


// ── SHIF (Social Health Insurance Fund) ──────────────────────────────────────
// Replaced NHIF from October 2024.
// Rate: 2.75% of gross salary, minimum KSh 300/month, no cap.
// Pre-tax deduction — reduces taxable income before PAYE.
const calculateSHIF = (gross) => {
  return parseFloat(Math.max(gross * 0.0275, 300).toFixed(2));
};


// ── AFFORDABLE HOUSING LEVY (AHL) ─────────────────────────────────────────────
// Rate: 1.5% of gross salary — no cap, no minimum.
// Per KRA notice (Dec 2024) and Tax Laws (Amendment) Act 2024:
//   AHL is an allowable pre-tax deduction — it reduces taxable income.
// Employer also contributes a matching 1.5% (not deducted from employee).
const calculateHousingLevy = (gross) => {
  return parseFloat((gross * 0.015).toFixed(2));
};


// ── PAYE ──────────────────────────────────────────────────────────────────────
// Taxable income = Gross − NSSF − SHIF − AHL
//
// 2026 KRA monthly tax bands (Finance Act 2024):
//   KSh 0       – 24,000   → 10%
//   KSh 24,001  – 32,333   → 25%
//   KSh 32,334  – 500,000  → 30%
//   KSh 500,001 – 800,000  → 32.5%
//   KSh 800,001+            → 35%
//
// Personal relief: KSh 2,400/month (all resident employees, automatic).
// PAYE cannot go below zero — no refunds through payroll.
//
// FIX 1: Old code subtracted only NSSF + AHL from gross to get taxable.
//        SHIF is also a pre-tax deduction and must be subtracted too.
// FIX 2: Old code used flat NSSF (wrong), feeding a lower taxable base.
//        Now correctly uses tiered NSSF.
const calculatePAYE = (gross) => {
  const nssf    = calculateNSSF(gross);
  const shif    = calculateSHIF(gross);
  const housing = calculateHousingLevy(gross);

  // Taxable income after all three pre-tax deductions
  const taxable = Math.max(0, gross - nssf - shif - housing);

  let tax = 0;

  if (taxable <= 0) {
    tax = 0;
  } else if (taxable <= 24000) {
    tax = taxable * 0.10;
  } else if (taxable <= 32333) {
    tax = (24000 * 0.10)
        + ((taxable - 24000) * 0.25);
  } else if (taxable <= 500000) {
    tax = (24000 * 0.10)
        + (8333   * 0.25)
        + ((taxable - 32333) * 0.30);
  } else if (taxable <= 800000) {
    tax = (24000  * 0.10)
        + (8333   * 0.25)
        + (467667 * 0.30)
        + ((taxable - 500000) * 0.325);
  } else {
    tax = (24000  * 0.10)
        + (8333   * 0.25)
        + (467667 * 0.30)
        + (300000 * 0.325)
        + ((taxable - 800000) * 0.35);
  }

  // Subtract personal relief (KSh 2,400/month, all resident employees)
  tax -= 2400;

  return parseFloat(Math.max(0, tax).toFixed(2));
};


// ── PLATFORM FEE ─────────────────────────────────────────────────────────────
// KSh 80 flat per employee per payroll run.
// Charged to EMPLOYER — NOT deducted from employee salary.
const PLATFORM_FEE = 80;


// ── MAIN CALCULATION ─────────────────────────────────────────────────────────
const calculatePayroll = (grossSalary) => {
  const gross       = parseFloat(grossSalary) || 0;
  const nssf        = calculateNSSF(gross);
  const shif        = calculateSHIF(gross);
  const housingLevy = calculateHousingLevy(gross);
  const paye        = calculatePAYE(gross);
  const platformFee = PLATFORM_FEE;

  const totalDeductions = parseFloat((nssf + shif + housingLevy + paye).toFixed(2));
  const netSalary       = parseFloat(Math.max(0, gross - totalDeductions).toFixed(2));

  return {
    grossSalary: gross,
    nssf,
    shif,
    housingLevy,
    paye,
    platformFee,
    netSalary,
    totalDeductions,
  };
};


// ── QUICK TEST (run: node utils/calculations.js) ──────────────────────────────
//
// KSh 15,000 — low earner, NSSF = 6% of full gross (under LEL):
//   nssf=900 | shif=412.50 | housing=225 | taxable=13,462.50
//   tax on 13,462.50 = 1,346.25 − 2,400 = 0 (floored) | paye=0
//   net=13,462.50
//
// KSh 50,000 — mid earner, NSSF = Tier I (540) + Tier II (2,460) = 3,000:
//   nssf=3,000 | shif=1,375 | housing=750 | taxable=44,875
//   tax: 2,400 + (8,333×0.25) + (12,542×0.30) = 2,400+2,083.25+3,762.60
//        = 8,245.85 − 2,400 = 5,845.85 | paye=5,845.85
//   net=39,029.15
//
// KSh 150,000 — high earner, NSSF = Tier I (540) + Tier II (5,940) = 6,480:
//   nssf=6,480 | shif=4,125 | housing=2,250 | taxable=137,145
//   paye=... | net=...
//
if (require.main === module) {
  console.log('\n── KSh 15,000 ──');
  console.table(calculatePayroll(15000));

  console.log('\n── KSh 50,000 ──');
  console.table(calculatePayroll(50000));

  console.log('\n── KSh 150,000 ──');
  console.table(calculatePayroll(150000));

  console.log('\n── KSh 300,000 ──');
  console.table(calculatePayroll(300000));
}

module.exports = {
  calculatePayroll,
  calculateNSSF,
  calculateSHIF,
  calculateHousingLevy,
  calculatePAYE,
  PLATFORM_FEE,
};