import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, run, transaction } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getCompanySchedule } from '../services/workingDaysService.js';
import { logAudit } from '../services/auditService.js';

export const attendanceRouter = Router();

// -------------------------------------------------------------
// Check-In (Employee checks in, server generates timestamp)
// -------------------------------------------------------------
attendanceRouter.post('/check-in', requireAuth, (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employee_id;
    if (!employeeId) {
      res.status(403).json({ error: 'No employee record linked to current account. Cannot check in.' });
      return;
    }

    const now = new Date();
    // Server-side date and time strings
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss

    // Check duplicate check-in
    const existing = queryOne<any>(
      'SELECT id, check_in_time FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, dateStr]
    );

    if (existing && existing.check_in_time) {
      res.status(409).json({
        error: `Duplicate check-in rejected: You have already checked in today at ${existing.check_in_time}.`,
      });
      return;
    }

    const schedule = getCompanySchedule();
    // Start time is 09:00, grace is 15 mins -> 09:15 threshold
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const lateThresholdMinutes = startH * 60 + startM + schedule.graceMinutes;

    const [currentH, currentM] = timeStr.split(':').map(Number);
    const currentTotalMinutes = currentH * 60 + currentM;

    const status = currentTotalMinutes > lateThresholdMinutes ? 'LATE' : 'PRESENT';
    const id = existing?.id || crypto.randomUUID();
    const nowIso = now.toISOString();

    if (existing) {
      run(
        `UPDATE attendance SET check_in_time = ?, status = ?, updated_at = ? WHERE id = ?`,
        [timeStr, status, nowIso, existing.id]
      );
    } else {
      run(
        `INSERT INTO attendance (id, employee_id, date, check_in_time, check_out_time, total_working_hours, status, is_corrected, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, 0, ?, 0, ?, ?)`,
        [id, employeeId, dateStr, timeStr, status, nowIso, nowIso]
      );
    }

    const record = queryOne<any>('SELECT * FROM attendance WHERE id = ?', [id]);
    res.status(201).json({
      message: status === 'LATE' ? `Checked in at ${timeStr} (Marked Late)` : `Checked in successfully at ${timeStr}`,
      attendance: record,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Check-Out (Employee checks out, server calculates duration)
// -------------------------------------------------------------
attendanceRouter.post('/check-out', requireAuth, (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employee_id;
    if (!employeeId) {
      res.status(403).json({ error: 'No employee profile linked to current account.' });
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss

    const record = queryOne<any>(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, dateStr]
    );

    if (!record || !record.check_in_time) {
      res.status(400).json({ error: 'Cannot check out: You have not checked in today yet.' });
      return;
    }

    if (record.check_out_time) {
      res.status(409).json({ error: `You have already checked out today at ${record.check_out_time}.` });
      return;
    }

    // Calculate hours worked
    const [inH, inM, inS = 0] = record.check_in_time.split(':').map(Number);
    const [outH, outM, outS = 0] = timeStr.split(':').map(Number);

    const totalSeconds = (outH * 3600 + outM * 60 + outS) - (inH * 3600 + inM * 60 + inS);
    const totalHours = Math.max(0, Math.round((totalSeconds / 3600) * 100) / 100);

    const schedule = getCompanySchedule();
    // If recorded working time is below half-day threshold (default 5.0 hours), classify as HALF_DAY
    let status = record.status;
    if (totalHours < schedule.halfDayHours) {
      status = 'HALF_DAY';
    }

    const nowIso = now.toISOString();
    run(
      `UPDATE attendance SET check_out_time = ?, total_working_hours = ?, status = ?, updated_at = ? WHERE id = ?`,
      [timeStr, totalHours, status, nowIso, record.id]
    );

    const updated = queryOne<any>('SELECT * FROM attendance WHERE id = ?', [record.id]);
    res.json({
      message: `Checked out successfully at ${timeStr}. Total hours: ${totalHours} hrs.${status === 'HALF_DAY' ? ' (Classified as Half-Day: under 5 hours)' : ''}`,
      attendance: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Get Today's Attendance for Calling Employee
// -------------------------------------------------------------
attendanceRouter.get('/today', requireAuth, (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employee_id;
    if (!employeeId) {
      res.json({ attendance: null });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const record = queryOne<any>(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, todayStr]
    );
    res.json({ attendance: record || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Get Calling Employee's Attendance History
// -------------------------------------------------------------
attendanceRouter.get('/my-history', requireAuth, (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employee_id;
    if (!employeeId) {
      res.status(400).json({ error: 'No employee linked to current account' });
      return;
    }

    const { month } = req.query; // YYYY-MM
    let sql = 'SELECT * FROM attendance WHERE employee_id = ?';
    const params: any[] = [employeeId];

    if (month) {
      sql += ' AND date LIKE ?';
      params.push(`${month}%`);
    }

    sql += ' ORDER BY date DESC';
    const history = query<any>(sql, params);
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Get All Attendance (HR/Admin) with date, department, status filters
// -------------------------------------------------------------
attendanceRouter.get('/all', requireAuth, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { date, departmentId, status, employeeId } = req.query;
    let whereClauses = ['1=1'];
    const params: any[] = [];

    if (date) {
      whereClauses.push('a.date = ?');
      params.push(date);
    }
    if (departmentId) {
      whereClauses.push('e.department_id = ?');
      params.push(departmentId);
    }
    if (status) {
      whereClauses.push('a.status = ?');
      params.push(status);
    }
    if (employeeId) {
      whereClauses.push('a.employee_id = ?');
      params.push(employeeId);
    }

    const sql = `
      SELECT a.*, e.employee_code, e.first_name, e.last_name, d.name as department_name, des.title as designation_title
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY a.date DESC, a.check_in_time DESC
    `;

    const records = query<any>(sql, params);
    res.json({ attendance: records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Attendance Correction (HR/Admin only with mandatory reason)
// -------------------------------------------------------------
attendanceRouter.post('/correction', requireAuth, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      date,
      newStatus,
      newCheckIn,
      newCheckOut,
      reason,
    } = req.body;

    if (!employeeId || !date || !newStatus || !reason || !reason.trim()) {
      res.status(400).json({
        error: 'Employee ID, date, corrected status, and a mandatory reason are required for corrections.',
      });
      return;
    }

    const existing = queryOne<any>(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, date]
    );

    const nowIso = new Date().toISOString();
    let attId = existing?.id;

    transaction(() => {
      if (existing) {
        // Calculate new working hours if both in and out provided
        let totalHours = existing.total_working_hours;
        if (newCheckIn && newCheckOut) {
          const [inH, inM] = newCheckIn.split(':').map(Number);
          const [outH, outM] = newCheckOut.split(':').map(Number);
          totalHours = Math.max(0, Math.round(((outH * 60 + outM - (inH * 60 + inM)) / 60) * 100) / 100);
        }

        run(
          `UPDATE attendance SET status = ?, check_in_time = ?, check_out_time = ?, total_working_hours = ?, is_corrected = 1, updated_at = ?
           WHERE id = ?`,
          [newStatus, newCheckIn || existing.check_in_time, newCheckOut || existing.check_out_time, totalHours, nowIso, existing.id]
        );
      } else {
        attId = crypto.randomUUID();
        let totalHours = 0;
        if (newCheckIn && newCheckOut) {
          const [inH, inM] = newCheckIn.split(':').map(Number);
          const [outH, outM] = newCheckOut.split(':').map(Number);
          totalHours = Math.max(0, Math.round(((outH * 60 + outM - (inH * 60 + inM)) / 60) * 100) / 100);
        }
        run(
          `INSERT INTO attendance (id, employee_id, date, check_in_time, check_out_time, total_working_hours, status, is_corrected, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [attId, employeeId, date, newCheckIn || null, newCheckOut || null, totalHours, newStatus, nowIso, nowIso]
        );
      }

      // Record in attendance_corrections audit table
      const corrId = crypto.randomUUID();
      run(
        `INSERT INTO attendance_corrections (id, attendance_id, employee_id, actor_id, original_status, new_status, original_check_in, new_check_in, original_check_out, new_check_out, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          corrId,
          attId,
          employeeId,
          req.user!.id,
          existing?.status || null,
          newStatus,
          existing?.check_in_time || null,
          newCheckIn || null,
          existing?.check_out_time || null,
          newCheckOut || null,
          reason.trim(),
          nowIso,
        ]
      );
    });

    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ATTENDANCE_CORRECTION',
      targetType: 'ATTENDANCE',
      targetId: attId,
      beforeState: existing,
      afterState: { newStatus, newCheckIn, newCheckOut, reason },
      ipAddress: req.ip,
    });

    const updated = queryOne<any>('SELECT * FROM attendance WHERE id = ?', [attId]);
    res.json({ message: 'Attendance correction recorded successfully', attendance: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
