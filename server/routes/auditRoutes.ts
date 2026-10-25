import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const auditRouter = Router();

// Only ADMIN can view audit logs
auditRouter.get('/', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { action, actorEmail, targetType, limit = '50', page = '1' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = ['1=1'];
    const params: any[] = [];

    if (action) {
      whereClauses.push('action LIKE ?');
      params.push(`%${action}%`);
    }
    if (actorEmail) {
      whereClauses.push('actor_email LIKE ?');
      params.push(`%${actorEmail}%`);
    }
    if (targetType) {
      whereClauses.push('target_type = ?');
      params.push(targetType);
    }

    const whereSql = whereClauses.join(' AND ');
    const countRow = await queryOne<any>(`SELECT count(1) as total FROM audit_logs WHERE ${whereSql}`, params);
    const total = countRow?.total || 0;

    const logs = await query<any>(`
      SELECT * FROM audit_logs
      WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
