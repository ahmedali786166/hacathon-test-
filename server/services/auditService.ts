import { run } from '../db/database.js';
import crypto from 'crypto';

export interface AuditParams {
  actorId?: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  beforeState?: any;
  afterState?: any;
  ipAddress?: string;
}

export function logAudit(params: AuditParams): void {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const beforeStr = params.beforeState ? JSON.stringify(params.beforeState) : null;
    const afterStr = params.afterState ? JSON.stringify(params.afterState) : null;

    run(
      `INSERT INTO audit_logs (id, actor_id, actor_email, actor_role, action, target_type, target_id, before_state, after_state, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.actorId || null,
        params.actorEmail,
        params.actorRole,
        params.action,
        params.targetType,
        params.targetId || null,
        beforeStr,
        afterStr,
        params.ipAddress || null,
        now,
      ]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
