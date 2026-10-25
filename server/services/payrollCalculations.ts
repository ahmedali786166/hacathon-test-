/**
 * HCM Lite - Pakistan Tax & Payroll Calculation Engine
 */

export interface SalaryBreakdown {
  basicSalary: number;
  grossSalary: number;
  hra: number;
  medicalAllowance: number;
  otherAllowance: number;
  annualTaxableGross: number;
  annualTax: number;
  monthlyTax: number;
}

export interface PayrollComputationInput {
  basicSalary: number;
  workingDaysInMonth: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  otherDeductions?: number;
}

export interface PayrollComputationResult {
  basicSalary: number;
  grossSalary: number;
  hra: number;
  medicalAllowance: number;
  otherAllowance: number;
  dailyGross: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  absentDeduction: number;
  halfDayDeduction: number;
  annualTax: number;
  monthlyTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
}

/**
 * Calculates Pakistan Annual Income Tax based on defined slabs:
 * - Up to PKR 600,000: 0%
 * - PKR 600,001 - 1,200,000: 5% of amount exceeding 600,000 (max PKR 30,000)
 * - PKR 1,200,001 - 2,400,000: PKR 30,000 + 15% exceeding 1,200,000 (max PKR 210,000)
 * - PKR 2,400,001 - 3,600,000: PKR 210,000 + 25% exceeding 2,400,000 (max PKR 510,000)
 * - Above PKR 3,600,000: PKR 510,000 + 35% exceeding 3,600,000
 */
export function calculatePakistanAnnualTax(annualTaxableIncome: number): number {
  if (annualTaxableIncome <= 600000) {
    return 0;
  }
  if (annualTaxableIncome <= 1200000) {
    return (annualTaxableIncome - 600000) * 0.05;
  }
  if (annualTaxableIncome <= 2400000) {
    return 30000 + (annualTaxableIncome - 1200000) * 0.15;
  }
  if (annualTaxableIncome <= 3600000) {
    return 210000 + (annualTaxableIncome - 2400000) * 0.25;
  }
  return 510000 + (annualTaxableIncome - 3600000) * 0.35;
}

/**
 * Deconstructs basic salary into standard Pakistani salary components:
 * Gross = 1.5 * Basic
 * HRA = 40% Basic
 * Medical = 10% Basic
 * Remaining gross component = Gross - (Basic + HRA + Medical)
 */
export function calculateSalaryStructure(basicSalary: number): SalaryBreakdown {
  const safeBasic = Math.max(0, basicSalary);
  const grossSalary = safeBasic * 1.5;
  const hra = safeBasic * 0.4;
  const medicalAllowance = safeBasic * 0.1;
  const otherAllowance = Math.max(0, grossSalary - (safeBasic + hra + medicalAllowance));
  const annualTaxableGross = grossSalary * 12;
  const annualTax = calculatePakistanAnnualTax(annualTaxableGross);
  const monthlyTax = Math.round((annualTax / 12) * 100) / 100;

  return {
    basicSalary: safeBasic,
    grossSalary,
    hra,
    medicalAllowance,
    otherAllowance,
    annualTaxableGross,
    annualTax,
    monthlyTax,
  };
}

/**
 * Computes full payroll for an employee for a specific month
 */
export function computeMonthlyPayroll(input: PayrollComputationInput): PayrollComputationResult {
  const structure = calculateSalaryStructure(input.basicSalary);
  const workingDays = Math.max(1, input.workingDaysInMonth);
  const dailyGross = structure.grossSalary / workingDays;

  // Total unworked days requiring deduction: absent days + unpaid leave
  const effectiveAbsentDays = input.absentDays + input.unpaidLeaveDays;
  const absentDeduction = Math.round(effectiveAbsentDays * dailyGross * 100) / 100;
  const halfDayDeduction = Math.round(input.halfDays * (0.5 * dailyGross) * 100) / 100;
  const otherDeductions = input.otherDeductions ? Math.round(input.otherDeductions * 100) / 100 : 0;
  const monthlyTax = structure.monthlyTax;

  const totalDeductions = Math.round((absentDeduction + halfDayDeduction + monthlyTax + otherDeductions) * 100) / 100;
  const netSalary = Math.max(0, Math.round((structure.grossSalary - totalDeductions) * 100) / 100);

  return {
    basicSalary: structure.basicSalary,
    grossSalary: structure.grossSalary,
    hra: structure.hra,
    medicalAllowance: structure.medicalAllowance,
    otherAllowance: structure.otherAllowance,
    dailyGross: Math.round(dailyGross * 100) / 100,
    workingDays,
    presentDays: input.presentDays,
    absentDays: input.absentDays,
    halfDays: input.halfDays,
    leaveDays: input.paidLeaveDays,
    absentDeduction,
    halfDayDeduction,
    annualTax: structure.annualTax,
    monthlyTax,
    otherDeductions,
    totalDeductions,
    netSalary,
  };
}

/**
 * Formats monetary amounts in standard Pakistani Rupee (PKR) formatting
 * e.g. PKR 1,50,000.00
 */
export function formatPKR(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}
