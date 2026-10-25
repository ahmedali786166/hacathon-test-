import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, run } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const communicationRouter = Router();

// -------------------------------------------------------------
// Announcements
// -------------------------------------------------------------
communicationRouter.get('/announcements', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let sql = `
      SELECT a.*, u.full_name as author_name, u.role as author_role
      FROM announcements a
      JOIN users u ON u.id = a.author_id
    `;
    const params: any[] = [];

    if (user.role === 'EMPLOYEE') {
      sql += " WHERE a.target_audience IN ('ALL', 'EMPLOYEE')";
    } else if (user.role === 'HR') {
      sql += " WHERE a.target_audience IN ('ALL', 'HR', 'EMPLOYEE')";
    }

    sql += ' ORDER BY a.created_at DESC';
    const announcements = await query<any>(sql, params);
    res.json({ announcements });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

communicationRouter.post('/announcements', requireAuth, requireRole(['ADMIN', 'HR']), async (req: Request, res: Response) => {
  try {
    const { title, content, target_audience = 'ALL', priority = 'NORMAL' } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required for announcements.' });
      return;
    }

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await run(
      `INSERT INTO announcements (id, title, content, target_audience, author_id, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title.trim(), content.trim(), target_audience, req.user!.id, priority, nowIso, nowIso]
    );

    // Also dispatch notification to targeted audience
    let userSql = 'SELECT id FROM users';
    if (target_audience === 'EMPLOYEE') userSql += " WHERE role = 'EMPLOYEE'";
    else if (target_audience === 'HR') userSql += " WHERE role = 'HR'";

    const targetUsers = await query<any>(userSql);
    for (const u of targetUsers) {
      if (u.id !== req.user!.id) {
        await run(
          `INSERT INTO notifications (id, user_id, title, message, type, is_read, link, created_at)
           VALUES (?, ?, ?, ?, 'ANNOUNCEMENT', 0, '/announcements', ?)`,
          [crypto.randomUUID(), u.id, `New Announcement: ${title}`, content.substring(0, 100), nowIso]
        );
      }
    }

    await logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'PUBLISH_ANNOUNCEMENT',
      targetType: 'ANNOUNCEMENT',
      targetId: id,
      afterState: { title, target_audience, priority },
      ipAddress: req.ip,
    });

    const created = await queryOne<any>('SELECT * FROM announcements WHERE id = ?', [id]);
    res.status(201).json({ message: 'Announcement published successfully', announcement: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Notifications
// -------------------------------------------------------------
communicationRouter.get('/notifications', requireAuth, async (req: Request, res: Response) => {
  try {
    const notifications = await query<any>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user!.id]
    );
    const unreadCount = (await queryOne<any>(
      'SELECT count(1) as c FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user!.id]
    ))?.c || 0;

    res.json({ notifications, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

communicationRouter.patch('/notifications/mark-read', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (id) {
      await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user!.id]);
    } else {
      await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user!.id]);
    }
    res.json({ message: 'Notifications marked as read' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
