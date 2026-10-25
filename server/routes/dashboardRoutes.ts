import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const todayStr = '2026-10-24';
    const currentMonth = '2026-10';

    if (user.role === 'EMPLOYEE') {
      // Employee personal metrics
      const employeeId = user.employee_id;
      let todayAttendance = null;
      let leaveBalances: any[] = [];
      let pendingLeavesCount = 0;
      let recentPayslipsCount = 0;

      if (employeeId) {
        todayAttendance = queryOne<any>(
          'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
          [employeeId, todayStr]
        );

        leaveBalances = query<any>(`
          SELECT lb.*, lt.name as leave_type_name, (lb.total_days - lb.used_days) as remaining_days
          FROM leave_balances lb
          JOIN leave_types lt ON lt.id = lb.leave_type_id
          WHERE lb.employee_id = ? AND lb.year = 2026
        `, [employeeId]);

        pendingLeavesCount = queryOne<any>(
          'SELECT count(1) as c FROM leave_requests WHERE employee_id = ? AND status = "PENDING"',
          [employeeId]
        )?.c || 0;

        recentPayslipsCount = queryOne<any>(
          'SELECT count(1) as c FROM payslips WHERE employee_id = ? AND is_locked = 1',
          [employeeId]
        )?.c || 0;
      }

      const recentAnnouncements = query<any>(`
        SELECT a.*, u.full_name as author_name 
        FROM announcements a
        JOIN users u ON u.id = a.author_id
        WHERE a.target_audience IN ('ALL', 'EMPLOYEE')
        ORDER BY a.created_at DESC
        LIMIT 5
      `);

      res.json({
        role: 'EMPLOYEE',
        todayAttendance,
        leaveBalances,
        pendingLeavesCount,
        recentPayslipsCount,
        announcements: recentAnnouncements,
      });
      return;
    }

    // HR and ADMIN Dashboard metrics - ALL LIVE REAL QUERIES!
    const totalEmployees = queryOne<any>('SELECT count(1) as c FROM employees')?.c || 0;
    const activeEmployees = queryOne<any>('SELECT count(1) as c FROM employees WHERE status = "ACTIVE"')?.c || 0;

    // Today's attendance counts
    const attRows = query<any>(
      'SELECT status, count(1) as c FROM attendance WHERE date = ? GROUP BY status',
      [todayStr]
    );
    const attCounts: Record<string, number> = {
      PRESENT: 0,
      LATE: 0,
      HALF_DAY: 0,
      ABSENT: 0,
      ON_LEAVE: 0,
    };
    attRows.forEach(r => {
      attCounts[r.status] = r.c;
    });

    const recordedAttendance = Object.values(attCounts).reduce((a, b) => a + b, 0);
    const unrecordedAbsent = Math.max(0, activeEmployees - recordedAttendance);
    const presentTotal = attCounts.PRESENT + attCounts.LATE;

    // Leaves
    const pendingLeaveRequests = queryOne<any>(
      'SELECT count(1) as c FROM leave_requests WHERE status = "PENDING"'
    )?.c || 0;

    const approvedOnLeaveToday = queryOne<any>(`
      SELECT count(1) as c FROM leave_requests 
      WHERE status = 'APPROVED' AND ? BETWEEN start_date AND end_date
    `, [todayStr])?.c || 0;

    // Headcount by department
    const departmentDistribution = query<any>(`
      SELECT d.name, count(e.id) as count 
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'ACTIVE'
      GROUP BY d.id
      ORDER BY count DESC
    `);

    // Payroll summary if available
    let latestPayroll: any = null;
    if (user.role === 'ADMIN' || user.role === 'HR') {
      latestPayroll = queryOne<any>(
        'SELECT month, status, total_gross, total_net, total_tax FROM payroll_runs ORDER BY month DESC LIMIT 1'
      );
    }

    // Recent activities (Audit & announcements)
    const recentAudits = query<any>(`
      SELECT action, actor_email, actor_role, created_at, target_type
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 6
    `);

    const announcements = query<any>(`
      SELECT a.*, u.full_name as author_name 
      FROM announcements a
      JOIN users u ON u.id = a.author_id
      ORDER BY a.created_at DESC
      LIMIT 5
    `);

    res.json({
      role: user.role,
      headcount: {
        total: totalEmployees,
        active: activeEmployees,
      },
      attendanceToday: {
        date: todayStr,
        present: presentTotal,
        onTime: attCounts.PRESENT,
        late: attCounts.LATE,
        halfDay: attCounts.HALF_DAY,
        onLeave: approvedOnLeaveToday,
        absent: attCounts.ABSENT + unrecordedAbsent,
      },
      leaves: {
        pending: pendingLeaveRequests,
        onLeaveToday: approvedOnLeaveToday,
      },
      departmentDistribution,
      latestPayroll,
      recentAudits,
      announcements,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
