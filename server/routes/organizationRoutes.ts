import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, run } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const organizationRouter = Router();

// -------------------------------------------------------------
// Company Settings
// -------------------------------------------------------------
organizationRouter.get('/settings', requireAuth, (req: Request, res: Response) => {
  const settings = queryOne<any>('SELECT * FROM company_settings LIMIT 1');
  res.json({ settings });
});

organizationRouter.put('/settings', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const {
      name,
      legal_name,
      start_time,
      grace_minutes,
      half_day_hours,
      weekend_days,
      office_address,
      geofence_lat,
      geofence_lng,
      geofence_radius_meters,
    } = req.body;

    const before = queryOne<any>('SELECT * FROM company_settings LIMIT 1');
    const now = new Date().toISOString();

    run(
      `UPDATE company_settings SET
        name = COALESCE(?, name),
        legal_name = COALESCE(?, legal_name),
        start_time = COALESCE(?, start_time),
        grace_minutes = COALESCE(?, grace_minutes),
        half_day_hours = COALESCE(?, half_day_hours),
        weekend_days = COALESCE(?, weekend_days),
        office_address = COALESCE(?, office_address),
        geofence_lat = ?,
        geofence_lng = ?,
        geofence_radius_meters = COALESCE(?, geofence_radius_meters),
        updated_at = ?
       WHERE id = ?`,
      [
        name,
        legal_name,
        start_time,
        grace_minutes,
        half_day_hours,
        typeof weekend_days === 'string' ? weekend_days : JSON.stringify(weekend_days),
        office_address,
        geofence_lat,
        geofence_lng,
        geofence_radius_meters,
        now,
        before.id,
      ]
    );

    const after = queryOne<any>('SELECT * FROM company_settings LIMIT 1');
    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_COMPANY_SETTINGS',
      targetType: 'SETTINGS',
      targetId: before.id,
      beforeState: before,
      afterState: after,
      ipAddress: req.ip,
    });

    res.json({ message: 'Settings updated successfully', settings: after });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Departments CRUD (All authenticated users can read; Admin can manage)
// -------------------------------------------------------------
organizationRouter.get('/departments', requireAuth, (req: Request, res: Response) => {
  try {
    const departments = query<any>(`
      SELECT d.*, 
        (SELECT count(1) FROM employees e WHERE e.department_id = d.id AND e.status = 'ACTIVE') as active_employee_count,
        (SELECT count(1) FROM designations des WHERE des.department_id = d.id) as designation_count
      FROM departments d
      ORDER BY d.name ASC
    `);
    res.json({ departments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

organizationRouter.post('/departments', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      res.status(400).json({ error: 'Department name and unique code are required.' });
      return;
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = queryOne<any>('SELECT id FROM departments WHERE name = ? OR code = ?', [name.trim(), cleanCode]);
    if (existing) {
      res.status(409).json({ error: 'A department with this name or code already exists.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    run(
      `INSERT INTO departments (id, name, code, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), cleanCode, description || '', now, now]
    );

    const created = queryOne<any>('SELECT * FROM departments WHERE id = ?', [id]);
    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_DEPARTMENT',
      targetType: 'DEPARTMENT',
      targetId: id,
      afterState: created,
      ipAddress: req.ip,
    });

    res.status(201).json({ message: 'Department created successfully', department: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

organizationRouter.put('/departments/:id', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;

    const before = queryOne<any>('SELECT * FROM departments WHERE id = ?', [id]);
    if (!before) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    const now = new Date().toISOString();
    run(
      `UPDATE departments SET
        name = COALESCE(?, name),
        code = COALESCE(?, code),
        description = COALESCE(?, description),
        updated_at = ?
       WHERE id = ?`,
      [name?.trim(), code?.toUpperCase().trim(), description, now, id]
    );

    const after = queryOne<any>('SELECT * FROM departments WHERE id = ?', [id]);
    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_DEPARTMENT',
      targetType: 'DEPARTMENT',
      targetId: id,
      beforeState: before,
      afterState: after,
      ipAddress: req.ip,
    });

    res.json({ message: 'Department updated successfully', department: after });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

organizationRouter.delete('/departments/:id', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const employeeCount = queryOne<any>('SELECT count(1) as c FROM employees WHERE department_id = ?', [id])?.c || 0;
    if (employeeCount > 0) {
      res.status(400).json({ error: `Cannot delete department with ${employeeCount} assigned employees. Reassign them first.` });
      return;
    }

    const before = queryOne<any>('SELECT * FROM departments WHERE id = ?', [id]);
    if (!before) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    run('DELETE FROM designations WHERE department_id = ?', [id]);
    run('DELETE FROM departments WHERE id = ?', [id]);

    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_DEPARTMENT',
      targetType: 'DEPARTMENT',
      targetId: id,
      beforeState: before,
      ipAddress: req.ip,
    });

    res.json({ message: 'Department deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Designations CRUD (Linked to Departments)
// -------------------------------------------------------------
organizationRouter.get('/designations', requireAuth, (req: Request, res: Response) => {
  try {
    const { departmentId } = req.query;
    let sql = `
      SELECT des.*, d.name as department_name, d.code as department_code,
        (SELECT count(1) FROM employees e WHERE e.designation_id = des.id AND e.status = 'ACTIVE') as employee_count
      FROM designations des
      JOIN departments d ON d.id = des.department_id
    `;
    const params: any[] = [];

    if (departmentId) {
      sql += ' WHERE des.department_id = ?';
      params.push(departmentId);
    }

    sql += ' ORDER BY des.title ASC';
    const designations = query<any>(sql, params);
    res.json({ designations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

organizationRouter.post('/designations', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { department_id, title, code, description } = req.body;
    if (!department_id || !title || !code) {
      res.status(400).json({ error: 'Department ID, title, and code are required.' });
      return;
    }

    const dept = queryOne<any>('SELECT id, name FROM departments WHERE id = ?', [department_id]);
    if (!dept) {
      res.status(400).json({ error: 'Invalid department ID. Department does not exist.' });
      return;
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = queryOne<any>(
      'SELECT id FROM designations WHERE department_id = ? AND (title = ? OR code = ?)',
      [department_id, title.trim(), cleanCode]
    );
    if (existing) {
      res.status(409).json({ error: 'A designation with this title or code already exists in this department.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    run(
      `INSERT INTO designations (id, department_id, title, code, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, department_id, title.trim(), cleanCode, description || '', now, now]
    );

    const created = queryOne<any>(`
      SELECT des.*, d.name as department_name 
      FROM designations des 
      JOIN departments d ON d.id = des.department_id 
      WHERE des.id = ?
    `, [id]);

    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_DESIGNATION',
      targetType: 'DESIGNATION',
      targetId: id,
      afterState: created,
      ipAddress: req.ip,
    });

    res.status(201).json({ message: 'Designation created successfully', designation: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

organizationRouter.put('/designations/:id', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, code, description } = req.body;

    const before = queryOne<any>('SELECT * FROM designations WHERE id = ?', [id]);
    if (!before) {
      res.status(404).json({ error: 'Designation not found' });
      return;
    }

    const now = new Date().toISOString();
    run(
      `UPDATE designations SET
        title = COALESCE(?, title),
        code = COALESCE(?, code),
        description = COALESCE(?, description),
        updated_at = ?
       WHERE id = ?`,
      [title?.trim(), code?.toUpperCase().trim(), description, now, id]
    );

    const after = queryOne<any>('SELECT * FROM designations WHERE id = ?', [id]);
    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_DESIGNATION',
      targetType: 'DESIGNATION',
      targetId: id,
      beforeState: before,
      afterState: after,
      ipAddress: req.ip,
    });

    res.json({ message: 'Designation updated successfully', designation: after });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

organizationRouter.delete('/designations/:id', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const employeeCount = queryOne<any>('SELECT count(1) as c FROM employees WHERE designation_id = ?', [id])?.c || 0;
    if (employeeCount > 0) {
      res.status(400).json({ error: `Cannot delete designation with ${employeeCount} assigned employees.` });
      return;
    }

    const before = queryOne<any>('SELECT * FROM designations WHERE id = ?', [id]);
    if (!before) {
      res.status(404).json({ error: 'Designation not found' });
      return;
    }

    run('DELETE FROM designations WHERE id = ?', [id]);
    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_DESIGNATION',
      targetType: 'DESIGNATION',
      targetId: id,
      beforeState: before,
      ipAddress: req.ip,
    });

    res.json({ message: 'Designation deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Leave Types CRUD
// -------------------------------------------------------------
organizationRouter.get('/leave-types', requireAuth, (req: Request, res: Response) => {
  const leaveTypes = query<any>('SELECT * FROM leave_types ORDER BY name ASC');
  res.json({ leaveTypes });
});

organizationRouter.post('/leave-types', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { name, code, annual_days, is_paid = 1, description } = req.body;
    if (!name || !code) {
      res.status(400).json({ error: 'Leave type name and code are required.' });
      return;
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = queryOne<any>('SELECT id FROM leave_types WHERE name = ? OR code = ?', [name.trim(), cleanCode]);
    if (existing) {
      res.status(409).json({ error: 'Leave type already exists.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    run(
      `INSERT INTO leave_types (id, name, code, annual_days, is_paid, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), cleanCode, annual_days || 0, is_paid ? 1 : 0, description || '', now]
    );

    const created = queryOne<any>('SELECT * FROM leave_types WHERE id = ?', [id]);
    res.status(201).json({ message: 'Leave type created', leaveType: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Company Holidays CRUD
// -------------------------------------------------------------
organizationRouter.get('/holidays', requireAuth, (req: Request, res: Response) => {
  const holidays = query<any>('SELECT * FROM company_holidays ORDER BY date ASC');
  res.json({ holidays });
});

organizationRouter.post('/holidays', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { name, date, is_recurring = 0 } = req.body;
    if (!name || !date) {
      res.status(400).json({ error: 'Holiday name and date (YYYY-MM-DD) are required.' });
      return;
    }

    const existing = queryOne<any>('SELECT id FROM company_holidays WHERE date = ?', [date]);
    if (existing) {
      res.status(409).json({ error: 'A holiday on this date already exists.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    run(
      `INSERT INTO company_holidays (id, name, date, is_recurring, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name.trim(), date, is_recurring ? 1 : 0, now]
    );

    const created = queryOne<any>('SELECT * FROM company_holidays WHERE id = ?', [id]);
    res.status(201).json({ message: 'Holiday created', holiday: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

organizationRouter.delete('/holidays/:id', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    run('DELETE FROM company_holidays WHERE id = ?', [id]);
    res.json({ message: 'Holiday removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
