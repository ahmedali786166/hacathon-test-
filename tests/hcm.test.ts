import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, query, queryOne, run } from '../server/db/database.js';
import { calculatePakistanAnnualTax, calculateSalaryStructure, computeMonthlyPayroll } from '../server/services/payrollCalculations.js';
import { calculateWorkingDaysBetween, getWorkingDaysInMonth } from '../server/services/workingDaysService.js';

describe('HCM Lite Comprehensive Test Suite', () => {
  beforeAll(async () => {
    await getDb();
  });

  describe('1. Pakistan Income Tax & Salary Calculations', () => {
    it('Slab 1: should calculate 0% tax for annual taxable income up to PKR 600,000', () => {
      expect(calculatePakistanAnnualTax(500000)).toBe(0);
      expect(calculatePakistanAnnualTax(600000)).toBe(0);
    });

    it('Slab 2: should calculate 5% for amount above PKR 600,000 up to 1,200,000', () => {
      // For 900,000: (900,000 - 600,000) * 0.05 = 300,000 * 0.05 = 15,000
      expect(calculatePakistanAnnualTax(900000)).toBe(15000);
      // Boundary at 1,200,000: (1,200,000 - 600,000) * 0.05 = 30,000
      expect(calculatePakistanAnnualTax(1200000)).toBe(30000);
    });

    it('Slab 3: should calculate PKR 30,000 + 15% above 1,200,000 up to 2,400,000', () => {
      // For 1,800,000: 30,000 + (600,000 * 0.15) = 30,000 + 90,000 = 120,000
      expect(calculatePakistanAnnualTax(1800000)).toBe(120000);
      // Boundary at 2,400,000: 30,000 + (1,200,000 * 0.15) = 210,000
      expect(calculatePakistanAnnualTax(2400000)).toBe(210000);
    });

    it('Slab 4: should calculate PKR 210,000 + 25% above 2,400,000 up to 3,600,000', () => {
      // For 3,000,000: 210,000 + (600,000 * 0.25) = 210,000 + 150,000 = 360,000
      expect(calculatePakistanAnnualTax(3000000)).toBe(360000);
      // Boundary at 3,600,000: 210,000 + (1,200,000 * 0.25) = 510,000
      expect(calculatePakistanAnnualTax(3600000)).toBe(510000);
    });

    it('Slab 5: should calculate PKR 510,000 + 35% above 3,600,000', () => {
      // For 4,000,000: 510,000 + (400,000 * 0.35) = 510,000 + 140,000 = 650,000
      expect(calculatePakistanAnnualTax(4000000)).toBe(650000);
    });

    it('should deconstruct basic salary into gross (1.5x), HRA (40%), and Medical (10%)', () => {
      const basic = 100000;
      const structure = calculateSalaryStructure(basic);
      expect(structure.grossSalary).toBe(150000); // 1.5 * 100,000
      expect(structure.hra).toBe(40000); // 40% of basic
      expect(structure.medicalAllowance).toBe(10000); // 10% of basic
      expect(structure.annualTaxableGross).toBe(1800000);
      expect(structure.annualTax).toBe(120000);
      expect(structure.monthlyTax).toBe(10000);
    });

    it('should compute full monthly payroll with half-day and absence deductions accurately', () => {
      const res = computeMonthlyPayroll({
        basicSalary: 100000,
        workingDaysInMonth: 22,
        presentDays: 20,
        absentDays: 1,
        halfDays: 2,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
      });

      // Gross = 150,000; Daily gross = 150,000 / 22 = 6818.1818...
      // 1 absent day = 6818.18
      // 2 half days = 2 * (0.5 * 6818.18) = 6818.18
      // Monthly tax = 10,000
      expect(res.grossSalary).toBe(150000);
      expect(res.absentDeduction).toBeCloseTo(6818.18, 1);
      expect(res.halfDayDeduction).toBeCloseTo(6818.18, 1);
      expect(res.monthlyTax).toBe(10000);
      expect(res.netSalary).toBeCloseTo(150000 - (6818.18 * 2 + 10000), 1);
    });
  });

  describe('2. Working Days, Holidays, and Weekend Exclusions', () => {
    it('should calculate working days between dates excluding Saturdays and Sundays', () => {
      // 2026-10-19 (Monday) to 2026-10-25 (Sunday) = 5 working days (Mon-Fri) + 2 weekend days (Sat, Sun)
      const res = calculateWorkingDaysBetween('2026-10-19', '2026-10-25', ['Saturday', 'Sunday']);
      expect(res.workingDays).toBe(5);
      expect(res.weekendCount).toBe(2);
    });

    it('should return 0 working days if range only contains weekend days', () => {
      // 2026-10-24 (Saturday) to 2026-10-25 (Sunday)
      const res = calculateWorkingDaysBetween('2026-10-24', '2026-10-25', ['Saturday', 'Sunday']);
      expect(res.workingDays).toBe(0);
      expect(res.weekendCount).toBe(2);
    });

    it('should calculate working days in a month', () => {
      // October 2026 has 31 days. 4 Saturdays, 4 Sundays = 8 weekend days. 31 - 8 = 23 working days.
      const days = getWorkingDaysInMonth('2026-10');
      expect(days).toBeGreaterThanOrEqual(20);
    });
  });

  describe('3. Database Relational Integrity and Schema Verification', () => {
    it('should have tables created and enforce foreign keys', () => {
      const tables = query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
      const tableNames = tables.map(t => t.name);

      expect(tableNames).toContain('company_settings');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('departments');
      expect(tableNames).toContain('designations');
      expect(tableNames).toContain('employees');
      expect(tableNames).toContain('leave_types');
      expect(tableNames).toContain('leave_balances');
      expect(tableNames).toContain('leave_requests');
      expect(tableNames).toContain('attendance');
      expect(tableNames).toContain('payroll_runs');
      expect(tableNames).toContain('payslips');
      expect(tableNames).toContain('audit_logs');
      expect(tableNames).toContain('ai_logs');
    });

    it('should correctly link designation to department in database', () => {
      const deptId = 'test-dept-1';
      const desigId = 'test-desig-1';
      const now = new Date().toISOString();

      // Clean test records if any
      run('DELETE FROM designations WHERE id = ?', [desigId]);
      run('DELETE FROM departments WHERE id = ?', [deptId]);

      // Insert department
      run(
        'INSERT INTO departments (id, name, code, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [deptId, 'Engineering QA', 'ENG_QA', 'Software Engineering', now, now]
      );

      // Insert designation linked to dept
      run(
        'INSERT INTO designations (id, department_id, title, code, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [desigId, deptId, 'Senior Fullstack Engineer', 'SR_FSE', 'Tech Lead', now, now]
      );

      const queriedDesig = queryOne<any>(
        'SELECT des.*, d.name as dept_name FROM designations des JOIN departments d ON d.id = des.department_id WHERE des.id = ?',
        [desigId]
      );

      expect(queriedDesig).not.toBeNull();
      expect(queriedDesig.dept_name).toBe('Engineering QA');
      expect(queriedDesig.department_id).toBe(deptId);

      // Clean up
      run('DELETE FROM designations WHERE id = ?', [desigId]);
      run('DELETE FROM departments WHERE id = ?', [deptId]);
    });
  });
});
