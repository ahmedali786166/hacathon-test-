import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne, run } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const userRouter = Router();

// List users (Admin only)
userRouter.get('/', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const users = await query<any>(`
      SELECT u.id, u.email, u.role, u.full_name, u.is_active, u.created_at,
             e.employee_code, d.name as department_name, des.title as designation_title
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      ORDER BY u.created_at DESC
    `);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create HR or Admin Account (Admin only)
userRouter.post('/', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role } = req.body;
    if (!email || !password || !full_name || !role) {
      res.status(400).json({ error: 'Email, password, full name, and role are required.' });
      return;
    }

    if (!['ADMIN', 'HR'].includes(role)) {
      res.status(400).json({ error: 'Role must be ADMIN or HR.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await queryOne<any>('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await run(
      `INSERT INTO users (id, email, password_hash, role, employee_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, 1, ?, ?)`,
      [id, cleanEmail, passwordHash, role, full_name.trim(), nowIso, nowIso]
    );

    const created = await queryOne<any>('SELECT id, email, role, full_name, is_active, created_at FROM users WHERE id = ?', [id]);
    await logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_MANAGEMENT_USER',
      targetType: 'USER',
      targetId: id,
      afterState: { email: cleanEmail, role, full_name },
      ipAddress: req.ip,
    });

    res.status(201).json({ message: `${role} account created successfully`, user: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle user active status (Admin only)
userRouter.patch('/:id/status', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (id === req.user!.id) {
      res.status(400).json({ error: 'You cannot deactivate your own administrative account.' });
      return;
    }

    const user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const newActive = is_active ? 1 : 0;
    const nowIso = new Date().toISOString();
    await run('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?', [newActive, nowIso, id]);

    await logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: newActive === 1 ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      targetType: 'USER',
      targetId: id,
      beforeState: { is_active: user.is_active },
      afterState: { is_active: newActive },
      ipAddress: req.ip,
    });

    res.json({ message: `User account has been ${newActive === 1 ? 'activated' : 'deactivated'}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
