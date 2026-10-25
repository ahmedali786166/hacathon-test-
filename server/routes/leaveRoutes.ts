import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, run, transaction } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { calculateWorkingDaysBetween } from '../services/workingDaysService.js';
import { parseSmartLeaveRequest } from '../services/geminiService.js';
import { logAudit } from '../services/auditService.js';

export const leaveRouter = Router();

// -------------------------------------------------------------
// Get Calling Employee's Leave Balances
// -------------------------------------------------------------
leaveRouter.get('/my-balances', requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employee_id;
    if (!employeeId) {
      res.json({ balances: [] });
      return;
    }

    const currentYear = new Date().getFullYear();
    const balances = await query<any>(`
      SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.is_paid,
             (lb.total_days - lb.used_days) as remaining_days
      FROM leave_balances lb
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.employee_id = ? AND lb.year = ?
      ORDER BY lt.name ASC
    `, [employeeId, currentYear]);

    res.json({ balances });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Get Calling Employee's Leave Requests History
// -------------------------------------------------------------
leaveRouter.get('/my-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employee_id;
    if (!employeeId) {
      res.json({ requests: [] });
      return;
    }

    const requests = await query<any>(`
      SELECT lr.*, lt.name as leave_type_name, lt.code as leave_type_code,
             u.full_name as reviewer_name
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN users u ON u.id = lr.reviewer_id
      WHERE lr.employee_id = ?
      ORDER BY lr.created_at DESC
    `, [employeeId]);

    res.json({ requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Smart Leave Interpretation (English & Roman Urdu)
// Returns structured parameters for user review. Never auto-submits.
// -------------------------------------------------------------
leaveRouter.post('/smart-parse', requireAuth, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      res.status(400).json({ error: 'Please enter a leave request description in Roman Urdu or English.' });
      return;
    }

    const result = await parseSmartLeaveRequest(prompt.trim(), {
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.full_name,
      userRole: req.user!.role,
      employeeId: req.user!.employee_id,
    });

    res.json({
      parsed: result,
      instructions: 'Please review the interpreted leave details below and click Submit to confirm your application.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Apply for Leave (Working day calculation, overlap & balance validation)
// -------------------------------------------------------------
leaveRouter.post('/apply', requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employee_id;
    if (!employeeId) {
      res.status(403).json({ error: 'No employee record linked to current account. Cannot apply for leave.' });
      return;
    }

    const { leaveTypeId, startDate, endDate, reason } = req.body;
    if (!leaveTypeId || !startDate || !endDate || !reason) {
      res.status(400).json({ error: 'Leave type, start date, end date, and reason are required.' });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      res.status(422).json({ error: 'Invalid date range: Start date cannot be after end date.' });
      return;
    }

    // 1. Calculate working days (excluding weekends and company holidays)
    const { workingDays } = await calculateWorkingDaysBetween(startDate, endDate);
    if (workingDays <= 0) {
      res.status(422).json({
        error: 'The selected dates contain only weekends or company holidays. No working days need leave.',
      });
      return;
    }

    // 2. Reject overlapping active requests (PENDING or APPROVED) with HTTP 422
    const overlap = await queryOne<any>(`
      SELECT id, start_date, end_date, status FROM leave_requests
      WHERE employee_id = ?
        AND status IN ('PENDING', 'APPROVED')
        AND (
          (start_date <= ? AND end_date >= ?) OR
          (start_date <= ? AND end_date >= ?) OR
          (start_date >= ? AND end_date <= ?)
        )
      LIMIT 1
    `, [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]);

    if (overlap) {
      res.status(422).json({
        error: `Overlapping leave request: You already have a ${overlap.status} leave request from ${overlap.start_date} to ${overlap.end_date}.`,
      });
      return;
    }

    // 3. Validate leave balance if paid leave
    const leaveType = await queryOne<any>('SELECT * FROM leave_types WHERE id = ?', [leaveTypeId]);
    if (!leaveType) {
      res.status(400).json({ error: 'Invalid leave type.' });
      return;
    }

    const currentYear = new Date(startDate).getFullYear();
    if (leaveType.is_paid === 1) {
      const balance = await queryOne<any>(
        'SELECT total_days, used_days, pending_days FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
        [employeeId, leaveTypeId, currentYear]
      );

      const available = balance ? (balance.total_days - balance.used_days - balance.pending_days) : 0;
      if (available < workingDays) {
        res.status(422).json({
          error: `Insufficient paid leave balance: You requested ${workingDays} working days, but only have ${available} day(s) available for ${leaveType.name}.`,
        });
        return;
      }
    }

    const reqId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await transaction(async () => {
      // Create request
      await run(
        `INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, reviewer_id, review_timestamp, review_comment, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?, ?)`,
        [reqId, employeeId, leaveTypeId, startDate, endDate, workingDays, reason.trim(), nowIso, nowIso]
      );

      // If paid, increment pending_days in balance
      if (leaveType.is_paid === 1) {
        await run(
          `UPDATE leave_balances SET pending_days = pending_days + ?, updated_at = ?
           WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
          [workingDays, nowIso, employeeId, leaveTypeId, currentYear]
        );
      }
    });

    await logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'SUBMIT_LEAVE_REQUEST',
      targetType: 'LEAVE_REQUEST',
      targetId: reqId,
      afterState: { startDate, endDate, workingDays, leaveType: leaveType.name },
      ipAddress: req.ip,
    });

    const created = await queryOne<any>('SELECT * FROM leave_requests WHERE id = ?', [reqId]);
    res.status(201).json({
      message: `Leave request for ${workingDays} working day(s) submitted successfully.`,
      leaveRequest: created,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// HR/Admin Approval Queue
// -------------------------------------------------------------
leaveRouter.get('/queue', requireAuth, requireRole(['ADMIN', 'HR']), async (req: Request, res: Response) => {
  try {
    const queue = await query<any>(`
      SELECT lr.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.is_paid,
             e.employee_code, e.first_name, e.last_name, d.name as department_name, des.title as designation_title,
             u.full_name as reviewer_name
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      LEFT JOIN users u ON u.id = lr.reviewer_id
      ORDER BY CASE WHEN lr.status = 'PENDING' THEN 0 ELSE 1 END, lr.created_at DESC
    `);

    res.json({ queue });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// HR/Admin Approve or Reject Leave Request
// -------------------------------------------------------------
leaveRouter.post('/:id/review', requireAuth, requireRole(['ADMIN', 'HR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, comment = '' } = req.body; // action: 'APPROVE' | 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      res.status(400).json({ error: 'Action must be APPROVE or REJECT.' });
      return;
    }

    const leaveReq = await queryOne<any>('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!leaveReq) {
      res.status(404).json({ error: 'Leave request not found.' });
      return;
    }

    if (leaveReq.status !== 'PENDING') {
      res.status(400).json({ error: `Cannot review request: Already ${leaveReq.status}.` });
      return;
    }

    const leaveType = await queryOne<any>('SELECT * FROM leave_types WHERE id = ?', [leaveReq.leave_type_id]);
    const currentYear = new Date(leaveReq.start_date).getFullYear();
    const nowIso = new Date().toISOString();
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await transaction(async () => {
      // 1. Update request
      await run(
        `UPDATE leave_requests SET status = ?, reviewer_id = ?, review_timestamp = ?, review_comment = ?, updated_at = ?
         WHERE id = ?`,
        [newStatus, req.user!.id, nowIso, comment, nowIso, id]
      );

      // 2. Adjust leave balances
      if (leaveType?.is_paid === 1) {
        if (action === 'APPROVE') {
          // move from pending to used
          await run(
            `UPDATE leave_balances SET
              used_days = used_days + ?,
              pending_days = MAX(0, pending_days - ?),
              updated_at = ?
             WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
            [leaveReq.total_days, leaveReq.total_days, nowIso, leaveReq.employee_id, leaveReq.leave_type_id, currentYear]
          );
        } else {
          // release pending
          await run(
            `UPDATE leave_balances SET
              pending_days = MAX(0, pending_days - ?),
              updated_at = ?
             WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
            [leaveReq.total_days, nowIso, leaveReq.employee_id, leaveReq.leave_type_id, currentYear]
          );
        }
      }

      // 3. Notify employee
      const empUser = await queryOne<any>('SELECT id FROM users WHERE employee_id = ?', [leaveReq.employee_id]);
      if (empUser) {
        await run(
          `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
           VALUES (?, ?, ?, ?, 'LEAVE', 0, ?)`,
          [
            crypto.randomUUID(),
            empUser.id,
            `Leave Request ${newStatus}`,
            `Your ${leaveType?.name || 'leave'} request from ${leaveReq.start_date} to ${leaveReq.end_date} has been ${newStatus.toLowerCase()}. ${comment ? 'Comment: ' + comment : ''}`,
            nowIso,
          ]
        );
      }
    });

    await logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: action === 'APPROVE' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      targetType: 'LEAVE_REQUEST',
      targetId: id,
      beforeState: { status: 'PENDING' },
      afterState: { status: newStatus, comment },
      ipAddress: req.ip,
    });

    res.json({ message: `Leave request ${newStatus.toLowerCase()} successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Team Leave Calendar (All approved leaves in month)
// -------------------------------------------------------------
leaveRouter.get('/calendar', requireAuth, async (req: Request, res: Response) => {
  try {
    const { month } = req.query; // YYYY-MM
    const currentMonth = month || new Date().toISOString().substring(0, 7);

    const leaves = await query<any>(`
      SELECT lr.*, lt.name as leave_type_name, lt.code as leave_type_code,
             e.employee_code, e.first_name, e.last_name, d.name as department_name
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE lr.status = 'APPROVED'
        AND (lr.start_date LIKE ? OR lr.end_date LIKE ?)
      ORDER BY lr.start_date ASC
    `, [`${currentMonth}%`, `${currentMonth}%`]);

    res.json({ leaves });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
