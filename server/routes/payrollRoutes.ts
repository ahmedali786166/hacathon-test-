import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, run, transaction } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { computeMonthlyPayroll, formatPKR } from '../services/payrollCalculations.js';
import { getWorkingDaysInMonth } from '../services/workingDaysService.js';
import { logAudit } from '../services/auditService.js';

export const payrollRouter = Router();

// -------------------------------------------------------------
// List All Payroll Runs (HR & Admin)
// -------------------------------------------------------------
payrollRouter.get('/runs', requireAuth, requireRole(['ADMIN', 'HR']), async (req: Request, res: Response) => {
  try {
    const runs = await query<any>(`
      SELECT pr.*, 
             u1.full_name as created_by_name,
             u2.full_name as locked_by_name,
             (SELECT count(1) FROM payslips p WHERE p.payroll_run_id = pr.id) as employee_count
      FROM payroll_runs pr
      LEFT JOIN users u1 ON u1.id = pr.created_by
      LEFT JOIN users u2 ON u2.id = pr.locked_by
      ORDER BY pr.month DESC
    `);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Generate / Prepare Payroll Draft (HR & Admin)
// -------------------------------------------------------------
payrollRouter.post('/generate-draft', requireAuth, requireRole(['ADMIN', 'HR']), async (req: Request, res: Response) => {
  try {
    const { month } = req.body; // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'Valid month in YYYY-MM format is required (e.g. 2026-10).' });
      return;
    }

    const existingRun = await queryOne<any>('SELECT * FROM payroll_runs WHERE month = ?', [month]);
    if (existingRun && existingRun.status === 'LOCKED') {
      res.status(400).json({
        error: `Payroll for ${month} is already finalized and locked. It cannot be recalculated.`,
      });
      return;
    }

    const workingDays = await getWorkingDaysInMonth(month);
    const activeEmployees = await query<any>(`
      SELECT e.*, d.name as department_name, des.title as designation_title
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      WHERE e.status = 'ACTIVE'
    `);

    if (activeEmployees.length === 0) {
      res.status(400).json({
        error: 'No active employees found in the database. Please register employees first.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const runId = existingRun ? existingRun.id : crypto.randomUUID();

    const preparedPayslips: any[] = [];
    let runTotalGross = 0;
    let runTotalNet = 0;
    let runTotalTax = 0;
    let runTotalDeductions = 0;

    for (const emp of activeEmployees) {
      // 1. Gather employee attendance for month
      const attendanceRecords = await query<any>(
        'SELECT status FROM attendance WHERE employee_id = ? AND date LIKE ?',
        [emp.id, `${month}%`]
      );

      let presentDays = 0;
      let halfDays = 0;
      let lateDays = 0;
      let recordedAbsent = 0;

      attendanceRecords.forEach(r => {
        if (r.status === 'PRESENT') presentDays++;
        else if (r.status === 'LATE') { presentDays++; lateDays++; }
        else if (r.status === 'HALF_DAY') halfDays++;
        else if (r.status === 'ABSENT') recordedAbsent++;
      });

      // 2. Gather approved leaves
      const approvedLeaves = await query<any>(`
        SELECT lr.total_days, lt.is_paid 
        FROM leave_requests lr
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.employee_id = ? AND lr.status = 'APPROVED'
          AND (lr.start_date LIKE ? OR lr.end_date LIKE ?)
      `, [emp.id, `${month}%`, `${month}%`]);

      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;
      approvedLeaves.forEach(l => {
        if (l.is_paid === 1) paidLeaveDays += l.total_days;
        else unpaidLeaveDays += l.total_days;
      });

      // Total working days accounted for
      const accountedDays = presentDays + (halfDays * 0.5) + paidLeaveDays + unpaidLeaveDays + recordedAbsent;
      // Any remaining unaccounted working days on working calendar default to absent
      const totalAbsentDays = Math.max(0, workingDays - (presentDays + (halfDays * 0.5) + paidLeaveDays));

      // 3. Compute salary breakdown & tax
      const comp = computeMonthlyPayroll({
        basicSalary: emp.basic_salary,
        workingDaysInMonth: workingDays,
        presentDays,
        absentDays: totalAbsentDays,
        halfDays,
        paidLeaveDays,
        unpaidLeaveDays,
      });

      runTotalGross += comp.grossSalary;
      runTotalNet += comp.netSalary;
      runTotalTax += comp.monthlyTax;
      runTotalDeductions += comp.totalDeductions;

      preparedPayslips.push({
        id: crypto.randomUUID(),
        payroll_run_id: runId,
        employee_id: emp.id,
        month,
        basic_salary: comp.basicSalary,
        gross_salary: comp.grossSalary,
        hra: comp.hra,
        medical_allowance: comp.medicalAllowance,
        other_allowance: comp.otherAllowance,
        working_days: workingDays,
        present_days: presentDays,
        absent_days: totalAbsentDays,
        half_days: halfDays,
        leave_days: paidLeaveDays,
        absent_deduction: comp.absentDeduction,
        half_day_deduction: comp.halfDayDeduction,
        tax_deduction: comp.monthlyTax,
        other_deductions: 0,
        net_salary: comp.netSalary,
        is_locked: 0,
        generated_at: nowIso,
        employee_code: emp.employee_code,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        department_name: emp.department_name,
        designation_title: emp.designation_title,
      });
    }

    await transaction(async () => {
      // Upsert payroll run
      if (existingRun) {
        await run(
          `UPDATE payroll_runs SET
            total_gross = ?, total_net = ?, total_tax = ?, total_deductions = ?, updated_at = ?
           WHERE id = ?`,
          [runTotalGross, runTotalNet, runTotalTax, runTotalDeductions, nowIso, runId]
        );
        await run('DELETE FROM payslips WHERE payroll_run_id = ?', [runId]);
      } else {
        await run(
          `INSERT INTO payroll_runs (id, month, status, total_gross, total_net, total_tax, total_deductions, created_by, locked_by, locked_at, created_at, updated_at)
           VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
          [runId, month, runTotalGross, runTotalNet, runTotalTax, runTotalDeductions, req.user!.id, nowIso, nowIso]
        );
      }

      // Insert prepared payslips
      for (const p of preparedPayslips) {
        await run(
          `INSERT INTO payslips (id, payroll_run_id, employee_id, month, basic_salary, gross_salary, hra, medical_allowance, other_allowance, working_days, present_days, absent_days, half_days, leave_days, absent_deduction, half_day_deduction, tax_deduction, other_deductions, net_salary, is_locked, generated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [
            p.id,
            p.payroll_run_id,
            p.employee_id,
            p.month,
            p.basic_salary,
            p.gross_salary,
            p.hra,
            p.medical_allowance,
            p.other_allowance,
            p.working_days,
            p.present_days,
            p.absent_days,
            p.half_days,
            p.leave_days,
            p.absent_deduction,
            p.half_day_deduction,
            p.tax_deduction,
            p.other_deductions,
            p.net_salary,
            p.generated_at,
          ]
        );
      }
    });

    await logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'GENERATE_PAYROLL_DRAFT',
      targetType: 'PAYROLL_RUN',
      targetId: runId,
      afterState: { month, employeeCount: preparedPayslips.length, totalGross: runTotalGross, totalNet: runTotalNet },
      ipAddress: req.ip,
    });

    res.json({
      message: `Payroll draft for ${month} generated with ${preparedPayslips.length} employees. Ready for review.`,
      run: {
        id: runId,
        month,
        status: 'DRAFT',
        totalGross: runTotalGross,
        totalNet: runTotalNet,
        totalTax: runTotalTax,
        totalDeductions: runTotalDeductions,
      },
      payslips: preparedPayslips,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Get Draft / Run Details for a Month (HR & Admin)
// -------------------------------------------------------------
payrollRouter.get('/draft/:month', requireAuth, requireRole(['ADMIN', 'HR']), async (req: Request, res: Response) => {
  try {
    const { month } = req.params;
    const payrollRun = await queryOne<any>('SELECT * FROM payroll_runs WHERE month = ?', [month]);
    if (!payrollRun) {
      res.status(404).json({ error: `No payroll records found for ${month}.` });
      return;
    }
    const payslips = await query<any>(`
      SELECT p.*, e.employee_code, e.first_name, e.last_name, e.email,
             d.name as department_name, des.title as designation_title
      FROM payslips p
      JOIN employees e ON e.id = p.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      WHERE p.payroll_run_id = ?
      ORDER BY e.first_name ASC
    `, [payrollRun.id]);

    res.json({ run: payrollRun, payslips });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Lock & Finalize Payroll (ADMIN EXCLUSIVE)
// HR CANNOT LOCK!
// -------------------------------------------------------------
payrollRouter.post('/lock/:month', requireAuth, async (req: Request, res: Response) => {
  try {
    // Strict Role Validation: Only ADMIN can lock payroll!
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Permission Denied: Only Administrator has the authority to finalize and lock payroll.',
      });
      return;
    }

    const { month } = req.params;
    const payrollRun = await queryOne<any>('SELECT * FROM payroll_runs WHERE month = ?', [month]);
    if (!payrollRun) {
      res.status(404).json({ error: `Payroll draft for ${month} not found.` });
      return;
    }

    if (payrollRun.status === 'LOCKED') {
      res.status(400).json({ error: `Payroll for ${month} is already locked.` });
      return;
    }

    const nowIso = new Date().toISOString();

    await transaction(async () => {
      await run(
        `UPDATE payroll_runs SET status = 'LOCKED', locked_by = ?, locked_at = ?, updated_at = ?
         WHERE id = ?`,
        [req.user!.id, nowIso, nowIso, payrollRun.id]
      );

      await run('UPDATE payslips SET is_locked = 1 WHERE payroll_run_id = ?', [payrollRun.id]);

      // Notify all active employees about their published payslip
      const users = await query<any>('SELECT id, employee_id FROM users WHERE employee_id IS NOT NULL');
      for (const u of users) {
        await run(
          `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
           VALUES (?, ?, ?, ?, 'PAYROLL', 0, ?)`,
          [
            crypto.randomUUID(),
            u.id,
            `Payslip Published for ${month}`,
            `Your finalized payslip for ${month} is now ready for download.`,
            nowIso,
          ]
        );
      }
    });

    await logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'FINALIZE_AND_LOCK_PAYROLL',
      targetType: 'PAYROLL_RUN',
      targetId: payrollRun.id,
      beforeState: { status: 'DRAFT' },
      afterState: { status: 'LOCKED', lockedBy: req.user!.email, lockedAt: nowIso },
      ipAddress: req.ip,
    });

    res.json({ message: `Payroll for ${month} has been finalized and locked successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Get Calling Employee's Finalized Payslips
// -------------------------------------------------------------
payrollRouter.get('/my-payslips', requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employee_id;
    if (!employeeId) {
      res.json({ payslips: [] });
      return;
    }

    const payslips = await query<any>(`
      SELECT p.*, pr.status as run_status, pr.locked_at
      FROM payslips p
      JOIN payroll_runs pr ON pr.id = p.payroll_run_id
      WHERE p.employee_id = ? AND p.is_locked = 1
      ORDER BY p.month DESC
    `, [employeeId]);

    res.json({ payslips });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Get Single Payslip (Confidentiality: Only Admin, HR, or Owner!)
// -------------------------------------------------------------
payrollRouter.get('/payslip/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payslip = await queryOne<any>(`
      SELECT p.*, e.employee_code, e.first_name, e.last_name, e.email, e.join_date,
             d.name as department_name, des.title as designation_title,
             cs.name as company_name, cs.legal_name as company_legal_name, cs.office_address as company_address
      FROM payslips p
      JOIN employees e ON e.id = p.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      LEFT JOIN company_settings cs ON 1=1
      WHERE p.id = ?
    `, [id]);

    if (!payslip) {
      res.status(404).json({ error: 'Payslip not found.' });
      return;
    }

    // Role check: Only Admin, HR, or the specific employee owning the payslip
    const isOwner = req.user!.employee_id === payslip.employee_id;
    const isPrivileged = req.user!.role === 'ADMIN' || req.user!.role === 'HR';

    if (!isPrivileged && !isOwner) {
      res.status(403).json({
        error: 'Access Denied: You are not authorized to view another employee’s confidential payslip.',
      });
      return;
    }

    res.json({ payslip });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
