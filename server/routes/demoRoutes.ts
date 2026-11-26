import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, run, transaction } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const demoRouter = Router();

const DEMO_EMAIL_DOMAIN = 'demo.hcmlite.dev';
const ANNOUNCEMENT_TITLE = 'Welcome to the HCM Lite demo workspace';

function karachiToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function dayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function timeStr(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}:00`;
}

async function ensureDepartment(name: string, code: string): Promise<string> {
  const existing = await queryOne<any>('SELECT id FROM departments WHERE name = ? OR code = ?', [name, code]);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    'INSERT INTO departments (id, name, code, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, code, `${name} department (demo data)`, now, now]
  );
  return id;
}

async function ensureDesignation(departmentId: string, title: string, code: string): Promise<string> {
  const existing = await queryOne<any>(
    'SELECT id FROM designations WHERE department_id = ? AND title = ?',
    [departmentId, title]
  );
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    'INSERT INTO designations (id, department_id, title, code, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, departmentId, title, code, `${title} (demo data)`, now, now]
  );
  return id;
}

demoRouter.get('/status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const seeded = await queryOne<{ count: number }>(
      `SELECT count(1) as count FROM employees WHERE email LIKE ?`,
      [`%@${DEMO_EMAIL_DOMAIN}`]
    );
    res.json({ seeded: (seeded?.count ?? 0) > 0, employees: seeded?.count ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

demoRouter.post('/seed', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const already = await queryOne<{ count: number }>(
      'SELECT count(1) as count FROM employees WHERE email LIKE ?',
      [`%@${DEMO_EMAIL_DOMAIN}`]
    );
    if ((already?.count ?? 0) > 0) {
      res.json({
        message: 'Sample workspace is already loaded.',
        alreadySeeded: true,
        employees: already?.count ?? 0,
      });
      return;
    }

    const adminId = req.user!.id;
    const adminEmail = req.user!.email;
    const now = new Date().toISOString();
    const year = Number(karachiToday().slice(0, 4));
    const settings = await queryOne<any>('SELECT weekend_days, start_time, grace_minutes FROM company_settings LIMIT 1');
    let weekendDays: string[] = ['Saturday', 'Sunday'];
    if (settings?.weekend_days) {
      try {
        weekendDays = JSON.parse(settings.weekend_days);
      } catch {
        weekendDays = ['Saturday', 'Sunday'];
      }
    }
    const startTime = String(settings?.start_time || '09:00');
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const graceMinutes = Number(settings?.grace_minutes ?? 15);

    const devDept = await ensureDepartment('Developer', 'DEV');
    const hrDept = await ensureDepartment('Human Resources', 'HR');
    const finDept = await ensureDepartment('Finance', 'FIN');
    const salesDept = await ensureDepartment('Sales', 'SALES');

    const seniorDev = await ensureDesignation(devDept, 'Senior Software Engineer', 'DEMO-SSE');
    const backendDev = await ensureDesignation(devDept, 'Backend Engineer', 'DEMO-BE');
    const frontendDev = await ensureDesignation(devDept, 'Frontend Engineer', 'DEMO-FE');
    const hrExec = await ensureDesignation(hrDept, 'HR Executive', 'DEMO-HRE');
    const accountant = await ensureDesignation(finDept, 'Accountant', 'DEMO-ACC');
    const salesExec = await ensureDesignation(salesDept, 'Sales Executive', 'DEMO-SE');

    const demoEmployees = [
      { first: 'Ayesha', last: 'Khan', dept: devDept, desig: seniorDev, salary: 220000, join: '2023-08-14', phone: '+92-300-2451181' },
      { first: 'Bilal', last: 'Ahmed', dept: devDept, desig: backendDev, salary: 160000, join: '2024-01-08', phone: '+92-301-8824410' },
      { first: 'Zain', last: 'Abbas', dept: devDept, desig: frontendDev, salary: 130000, join: '2024-06-03', phone: '+92-302-3390874' },
      { first: 'Sana', last: 'Malik', dept: hrDept, desig: hrExec, salary: 95000, join: '2024-09-16', phone: '+92-303-7741265' },
      { first: 'Usman', last: 'Tariq', dept: finDept, desig: accountant, salary: 110000, join: '2023-11-20', phone: '+92-304-6619083' },
      { first: 'Hira', last: 'Sheikh', dept: salesDept, desig: salesExec, salary: 85000, join: '2025-02-10', phone: '+92-305-5520471' },
    ];

    const leaveTypes = await query<any>('SELECT id, code, annual_days FROM leave_types');
    const leaveTypeByCode = new Map<string, any>(leaveTypes.map(lt => [lt.code, lt]));

    const today = karachiToday();
    const monthStart = `${today.slice(0, 7)}-01`;
    const attendanceDates: string[] = [];
    let cursor = monthStart;
    while (cursor <= today) {
      if (!weekendDays.includes(dayName(cursor))) attendanceDates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    if (attendanceDates.length === 0) attendanceDates.push(today);

    const employeeIds: string[] = [];
    let attendanceRows = 0;

    await transaction(async () => {
      for (let i = 0; i < demoEmployees.length; i++) {
        const emp = demoEmployees[i];
        const email = `${emp.first.toLowerCase()}.${emp.last.toLowerCase()}@${DEMO_EMAIL_DOMAIN}`;
        const id = crypto.randomUUID();
        const code = `DEMO-${pad(i + 1)}`;
        await run(
          `INSERT INTO employees
             (id, employee_code, first_name, last_name, email, phone, department_id, designation_id, join_date, status, basic_salary, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
          [id, code, emp.first, emp.last, email, emp.phone, emp.dept, emp.desig, emp.join, emp.salary, now, now]
        );
        employeeIds.push(id);

        for (const lt of leaveTypes) {
          const total = lt.code === 'UNPAID' ? 0 : Number(lt.annual_days || 0);
          const used = lt.code === 'UNPAID' ? 0 : Math.min(total, (i * 3 + lt.code.length) % 4);
          const pending = 0;
          await run(
            `INSERT INTO leave_balances (id, employee_id, leave_type_id, total_days, used_days, pending_days, year, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), id, lt.id, total, used, pending, year, now, now]
          );
        }

        for (let d = 0; d < attendanceDates.length; d++) {
          const date = attendanceDates[d];
          const isToday = date === today;
          const seed = (i * 31 + d * 17 + 7) % 100;

          let status: string;
          let checkIn: string | null = null;
          let checkOut: string | null = null;
          let hours = 0;

          if (isToday) {
            const todayPattern = ['PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'ABSENT', 'PRESENT'];
            status = todayPattern[i % todayPattern.length];
          } else if (seed < 68) {
            status = 'PRESENT';
          } else if (seed < 82) {
            status = 'LATE';
          } else if (seed < 90) {
            status = 'HALF_DAY';
          } else {
            status = 'ABSENT';
          }

          if (status === 'PRESENT') {
            const inMinute = startMinute + 2 + (seed % 10);
            const inHour = startHour + Math.floor(inMinute / 60);
            checkIn = timeStr(inHour, inMinute % 60);
            if (!isToday) {
              const outHour = 17 + (seed % 2);
              checkOut = timeStr(outHour, 30 + (seed % 25));
              hours = Number((outHour + (30 + (seed % 25)) / 60 - inHour - (inMinute % 60) / 60).toFixed(2));
            }
          } else if (status === 'LATE') {
            const inMinute = startMinute + graceMinutes + 3 + (seed % 35);
            const inHour = startHour + Math.floor(inMinute / 60);
            checkIn = timeStr(inHour, inMinute % 60);
            if (!isToday) {
              checkOut = timeStr(17, 45 + (seed % 10));
              hours = Number((17 + (45 + (seed % 10)) / 60 - inHour - (inMinute % 60) / 60).toFixed(2));
            }
          } else if (status === 'HALF_DAY') {
            checkIn = timeStr(startHour, startMinute + 3);
            checkOut = timeStr(13, 30 + (seed % 15));
            hours = Number((13 + (30 + (seed % 15)) / 60 - startHour - (startMinute + 3) / 60).toFixed(2));
          }

          await run(
            `INSERT INTO attendance
               (id, employee_id, date, check_in_time, check_out_time, total_working_hours, status, is_corrected, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [crypto.randomUUID(), id, date, checkIn, checkOut, hours, status, now, now]
          );
          attendanceRows++;
        }
      }

      const annual = leaveTypeByCode.get('ANNUAL');
      const sick = leaveTypeByCode.get('SICK');
      const demoLeaveRequests = [
        { idx: 3, typeId: annual?.id, start: addDays(today, 3), end: addDays(today, 4), days: 2, reason: 'Family wedding in Lahore — requesting two days off.', status: 'PENDING' },
        { idx: 1, typeId: sick?.id, start: addDays(today, -6), end: addDays(today, -5), days: 2, reason: 'Flu and fever, doctor advised two days rest.', status: 'APPROVED' },
        { idx: 4, typeId: annual?.id, start: addDays(today, -12), end: addDays(today, -12), days: 1, reason: 'Personal errand.', status: 'REJECTED' },
      ];

      for (const lr of demoLeaveRequests) {
        if (!lr.typeId) continue;
        const employeeId = employeeIds[lr.idx];
        const isReviewed = lr.status !== 'PENDING';
        await run(
          `INSERT INTO leave_requests
             (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, reviewer_id, review_timestamp, review_comment, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            employeeId,
            lr.typeId,
            lr.start,
            lr.end,
            lr.days,
            lr.reason,
            lr.status,
            isReviewed ? adminId : null,
            isReviewed ? now : null,
            lr.status === 'APPROVED' ? 'Approved. Get well soon.' : lr.status === 'REJECTED' ? 'Rejected — please plan leaves with two days notice.' : null,
            now,
            now,
          ]
        );

        const balance = await queryOne<any>(
          'SELECT id FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
          [employeeId, lr.typeId, year]
        );
        if (balance) {
          if (lr.status === 'PENDING') {
            await run('UPDATE leave_balances SET pending_days = pending_days + ?, updated_at = ? WHERE id = ?', [lr.days, now, balance.id]);
          } else if (lr.status === 'APPROVED') {
            await run('UPDATE leave_balances SET used_days = used_days + ?, updated_at = ? WHERE id = ?', [lr.days, now, balance.id]);
            await run(
              `UPDATE attendance
               SET status = 'ON_LEAVE', check_in_time = NULL, check_out_time = NULL, total_working_hours = 0, updated_at = ?
               WHERE employee_id = ? AND date BETWEEN ? AND ?`,
              [now, employeeId, lr.start, lr.end]
            );
          }
        }
      }

      await run(
        `INSERT INTO announcements (id, title, content, target_audience, author_id, priority, created_at, updated_at)
         VALUES (?, ?, ?, 'ALL', ?, 'NORMAL', ?, ?)`,
        [
          crypto.randomUUID(),
          ANNOUNCEMENT_TITLE,
          'This workspace is pre-loaded with sample employees, month-to-date attendance, leave requests and balances so evaluators can explore every feature. Generate a payroll draft from Payroll & Tax to try the Pakistan tax engine.',
          adminId,
          now,
          now,
        ]
      );
    });

    await logAudit({
      actorId: adminId,
      actorEmail: adminEmail,
      actorRole: 'ADMIN',
      action: 'DEMO_DATA_SEEDED',
      targetType: 'SYSTEM',
      afterState: { employees: demoEmployees.length, attendanceRows, leaveRequests: 3 },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'Sample workspace loaded: 6 employees, month-to-date attendance, leave requests and an announcement.',
      employees: demoEmployees.length,
      attendanceRows,
      leaveRequests: 3,
    });
  } catch (err: any) {
    console.error('Demo seed error:', err);
    res.status(500).json({ error: err.message || 'Failed to load sample workspace.' });
  }
});

demoRouter.delete('/reset', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const demoEmployees = await query<{ id: string }>(
      'SELECT id FROM employees WHERE email LIKE ?',
      [`%@${DEMO_EMAIL_DOMAIN}`]
    );
    if (demoEmployees.length === 0) {
      res.json({ message: 'No sample data to remove.', removed: 0 });
      return;
    }

    await transaction(async () => {
      await run('DELETE FROM employees WHERE email LIKE ?', [`%@${DEMO_EMAIL_DOMAIN}`]);
      await run('DELETE FROM announcements WHERE title = ?', [ANNOUNCEMENT_TITLE]);
      await run(
        `DELETE FROM payroll_runs
         WHERE status = 'DRAFT'
           AND NOT EXISTS (SELECT 1 FROM payslips WHERE payslips.payroll_run_id = payroll_runs.id)`
      );
    });

    await logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: 'ADMIN',
      action: 'DEMO_DATA_REMOVED',
      targetType: 'SYSTEM',
      afterState: { employees: demoEmployees.length },
      ipAddress: req.ip,
    });

    res.json({ message: 'Sample employees, attendance, leaves and announcement removed.', removed: demoEmployees.length });
  } catch (err: any) {
    console.error('Demo reset error:', err);
    res.status(500).json({ error: err.message || 'Failed to remove sample data.' });
  }
});
