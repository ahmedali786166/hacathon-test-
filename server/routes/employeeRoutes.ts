import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne, run, transaction } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const employeeRouter = Router();

// -------------------------------------------------------------
// Get Employees Directory (Search, filter, paginate)
// -------------------------------------------------------------
employeeRouter.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const {
      search = '',
      departmentId = '',
      status = '',
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = ['1=1'];
    const params: any[] = [];

    if (search) {
      whereClauses.push('(e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ?)');
      const q = `%${(search as string).trim()}%`;
      params.push(q, q, q, q);
    }

    if (departmentId) {
      whereClauses.push('e.department_id = ?');
      params.push(departmentId);
    }

    if (status) {
      whereClauses.push('e.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.join(' AND ');

    const countRow = queryOne<any>(`SELECT count(1) as total FROM employees e WHERE ${whereSql}`, params);
    const total = countRow?.total || 0;

    const employees = query<any>(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone,
             e.department_id, e.designation_id, e.join_date, e.status, e.basic_salary,
             d.name as department_name, des.title as designation_title,
             u.id as user_id
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      LEFT JOIN users u ON u.employee_id = e.id
      WHERE ${whereSql}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    // Data confidentiality: Only ADMIN and HR can view salaries.
    const isCallerPrivileged = req.user!.role === 'ADMIN' || req.user!.role === 'HR';
    const sanitized = employees.map(emp => {
      const isSelf = req.user!.employee_id === emp.id;
      return {
        ...emp,
        basic_salary: (isCallerPrivileged || isSelf) ? emp.basic_salary : undefined,
      };
    });

    res.json({
      employees: sanitized,
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

// -------------------------------------------------------------
// Get Single Employee 360 Profile
// -------------------------------------------------------------
employeeRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isCallerPrivileged = req.user!.role === 'ADMIN' || req.user!.role === 'HR';
    const isSelf = req.user!.employee_id === id;

    if (!isCallerPrivileged && !isSelf) {
      res.status(403).json({ error: 'Access denied: You cannot view other employees confidential profiles.' });
      return;
    }

    const employee = queryOne<any>(`
      SELECT e.*, d.name as department_name, des.title as designation_title,
             u.id as user_id, u.email as user_email, u.role as user_role, u.is_active as user_active
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      LEFT JOIN users u ON u.employee_id = e.id
      WHERE e.id = ?
    `, [id]);

    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Leave balances
    const leaveBalances = query<any>(`
      SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.is_paid
      FROM leave_balances lb
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.employee_id = ?
      ORDER BY lt.name ASC
    `, [id]);

    // Recent attendance (last 10 days)
    const recentAttendance = query<any>(`
      SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 10
    `, [id]);

    // Locked payslips (if privileged or self)
    let payslips: any[] = [];
    if (isCallerPrivileged || isSelf) {
      payslips = query<any>(`
        SELECT p.*, pr.status as run_status 
        FROM payslips p
        JOIN payroll_runs pr ON pr.id = p.payroll_run_id
        WHERE p.employee_id = ? AND p.is_locked = 1
        ORDER BY p.month DESC
      `, [id]);
    }

    res.json({
      employee: {
        ...employee,
        basic_salary: (isCallerPrivileged || isSelf) ? employee.basic_salary : undefined,
      },
      leaveBalances,
      recentAttendance,
      payslips,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Create Employee (HR & Admin only)
// STRICT VALIDATION of Department, Designation, and their Relationship!
// -------------------------------------------------------------
employeeRouter.post('/', requireAuth, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const {
      employee_code,
      first_name,
      last_name,
      email,
      phone,
      department_id,
      designation_id,
      join_date,
      basic_salary = 0,
      status = 'ACTIVE',
    } = req.body;

    if (!employee_code || !first_name || !last_name || !email || !department_id || !designation_id || !join_date) {
      res.status(400).json({
        error: 'Employee code, first name, last name, email, department, designation, and join date are required.',
      });
      return;
    }

    const cleanCode = employee_code.toUpperCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // 1. Check duplicate code or email
    const duplicate = queryOne<any>(
      'SELECT id FROM employees WHERE employee_code = ? OR email = ?',
      [cleanCode, cleanEmail]
    );
    if (duplicate) {
      res.status(409).json({ error: 'An employee with this Employee Code or Email already exists.' });
      return;
    }

    // 2. Validate department exists
    const dept = queryOne<any>('SELECT id, name FROM departments WHERE id = ?', [department_id]);
    if (!dept) {
      res.status(400).json({ error: 'Selected Department does not exist. Please select a valid department.' });
      return;
    }

    // 3. Validate designation exists AND belongs to the selected department
    const desig = queryOne<any>('SELECT id, title, department_id FROM designations WHERE id = ?', [designation_id]);
    if (!desig) {
      res.status(400).json({ error: 'Selected Designation does not exist.' });
      return;
    }

    if (desig.department_id !== department_id) {
      res.status(400).json({
        error: `Validation Error: The designation "${desig.title}" does not belong to the selected department "${dept.name}". Please select a matching designation.`,
      });
      return;
    }

    const empId = crypto.randomUUID();
    const now = new Date().toISOString();
    const currentYear = new Date(join_date).getFullYear();

    transaction(() => {
      // Insert employee
      run(
        `INSERT INTO employees (id, employee_code, first_name, last_name, email, phone, department_id, designation_id, join_date, status, basic_salary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empId,
          cleanCode,
          first_name.trim(),
          last_name.trim(),
          cleanEmail,
          phone || '',
          department_id,
          designation_id,
          join_date,
          status,
          Number(basic_salary) || 0,
          now,
          now,
        ]
      );

      // Auto-initialize standard leave balances from active leave types
      const leaveTypes = query<any>('SELECT id, annual_days FROM leave_types');
      for (const lt of leaveTypes) {
        run(
          `INSERT INTO leave_balances (id, employee_id, leave_type_id, total_days, used_days, pending_days, year, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)`,
          [crypto.randomUUID(), empId, lt.id, lt.annual_days, currentYear, now, now]
        );
      }
    });

    const created = queryOne<any>(`
      SELECT e.*, d.name as department_name, des.title as designation_title 
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      WHERE e.id = ?
    `, [empId]);

    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_EMPLOYEE',
      targetType: 'EMPLOYEE',
      targetId: empId,
      afterState: created,
      ipAddress: req.ip,
    });

    res.status(201).json({ message: 'Employee registered successfully', employee: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Update Employee
// -------------------------------------------------------------
employeeRouter.put('/:id', requireAuth, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      phone,
      department_id,
      designation_id,
      join_date,
      basic_salary,
      status,
    } = req.body;

    const before = queryOne<any>('SELECT * FROM employees WHERE id = ?', [id]);
    if (!before) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const targetDeptId = department_id || before.department_id;
    const targetDesigId = designation_id || before.designation_id;

    // Validate department exists
    const dept = queryOne<any>('SELECT id, name FROM departments WHERE id = ?', [targetDeptId]);
    if (!dept) {
      res.status(400).json({ error: 'Selected Department does not exist.' });
      return;
    }

    // Validate designation belongs to department
    const desig = queryOne<any>('SELECT id, title, department_id FROM designations WHERE id = ?', [targetDesigId]);
    if (!desig) {
      res.status(400).json({ error: 'Selected Designation does not exist.' });
      return;
    }

    if (desig.department_id !== targetDeptId) {
      res.status(400).json({
        error: `Validation Error: The designation "${desig.title}" does not belong to the selected department "${dept.name}".`,
      });
      return;
    }

    const now = new Date().toISOString();
    run(
      `UPDATE employees SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        phone = COALESCE(?, phone),
        department_id = ?,
        designation_id = ?,
        join_date = COALESCE(?, join_date),
        basic_salary = COALESCE(?, basic_salary),
        status = COALESCE(?, status),
        updated_at = ?
       WHERE id = ?`,
      [
        first_name?.trim(),
        last_name?.trim(),
        phone,
        targetDeptId,
        targetDesigId,
        join_date,
        basic_salary !== undefined ? Number(basic_salary) : null,
        status,
        now,
        id,
      ]
    );

    const after = queryOne<any>(`
      SELECT e.*, d.name as department_name, des.title as designation_title 
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      WHERE e.id = ?
    `, [id]);

    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_EMPLOYEE',
      targetType: 'EMPLOYEE',
      targetId: id,
      beforeState: before,
      afterState: after,
      ipAddress: req.ip,
    });

    res.json({ message: 'Employee updated successfully', employee: after });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Provision User Account for Employee (HR/Admin)
// -------------------------------------------------------------
employeeRouter.post('/:id/create-account', requireAuth, requireRole(['ADMIN', 'HR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password, role = 'EMPLOYEE' } = req.body;

    const emp = queryOne<any>('SELECT * FROM employees WHERE id = ?', [id]);
    if (!emp) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const existingUser = queryOne<any>('SELECT id FROM users WHERE employee_id = ? OR email = ?', [id, emp.email]);
    if (existingUser) {
      res.status(409).json({ error: 'A login account already exists for this employee.' });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'A temporary password of at least 6 characters is required.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    run(
      `INSERT INTO users (id, email, password_hash, role, employee_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [userId, emp.email, passwordHash, role, emp.id, `${emp.first_name} ${emp.last_name}`, now, now]
    );

    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_EMPLOYEE_USER_ACCOUNT',
      targetType: 'USER',
      targetId: userId,
      afterState: { email: emp.email, role, employeeId: emp.id },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'Login account provisioned successfully',
      user: { id: userId, email: emp.email, role },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// CSV Import (Preview & Execute)
// -------------------------------------------------------------
employeeRouter.post('/import-csv', requireAuth, requireRole(['ADMIN', 'HR']), (req: Request, res: Response) => {
  try {
    const { rows, execute = false } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'No data rows provided for import.' });
      return;
    }

    const departments = query<any>('SELECT id, name, code FROM departments');
    const designations = query<any>('SELECT id, department_id, title, code FROM designations');
    const existingEmployees = query<any>('SELECT employee_code, email FROM employees');

    const deptMap = new Map<string, string>();
    departments.forEach(d => {
      deptMap.set(d.name.toLowerCase(), d.id);
      deptMap.set(d.code.toLowerCase(), d.id);
    });

    const desigMap = new Map<string, { id: string; departmentId: string }>();
    designations.forEach(d => {
      desigMap.set(d.title.toLowerCase(), { id: d.id, departmentId: d.department_id });
      desigMap.set(d.code.toLowerCase(), { id: d.id, departmentId: d.department_id });
    });

    const existingCodes = new Set(existingEmployees.map(e => e.employee_code.toUpperCase()));
    const existingEmails = new Set(existingEmployees.map(e => e.email.toLowerCase()));

    const validatedRows: any[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    rows.forEach((row: any, idx: number) => {
      const rowNum = idx + 1;
      const code = (row.employee_code || '').toUpperCase().trim();
      const firstName = (row.first_name || '').trim();
      const lastName = (row.last_name || '').trim();
      const email = (row.email || '').toLowerCase().trim();
      const deptName = (row.department || '').toLowerCase().trim();
      const desigName = (row.designation || '').toLowerCase().trim();
      const joinDate = (row.join_date || '2026-10-01').trim();
      const salary = Number(row.basic_salary) || 0;

      if (!code || !firstName || !lastName || !email) {
        errors.push({ row: rowNum, error: 'Missing mandatory fields (code, name, email)' });
        return;
      }

      if (existingCodes.has(code)) {
        errors.push({ row: rowNum, error: `Employee code ${code} already exists` });
        return;
      }

      if (existingEmails.has(email)) {
        errors.push({ row: rowNum, error: `Email ${email} already exists` });
        return;
      }

      const deptId = deptMap.get(deptName);
      if (!deptId) {
        errors.push({ row: rowNum, error: `Department "${row.department}" not found in database` });
        return;
      }

      const desigInfo = desigMap.get(desigName);
      if (!desigInfo) {
        errors.push({ row: rowNum, error: `Designation "${row.designation}" not found in database` });
        return;
      }

      if (desigInfo.departmentId !== deptId) {
        errors.push({ row: rowNum, error: `Designation "${row.designation}" does not belong to department "${row.department}"` });
        return;
      }

      validatedRows.push({
        id: crypto.randomUUID(),
        employee_code: code,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: row.phone || '',
        department_id: deptId,
        designation_id: desigInfo.id,
        join_date: joinDate,
        basic_salary: salary,
        status: 'ACTIVE',
      });
    });

    if (!execute) {
      res.json({
        totalSubmitted: rows.length,
        validCount: validatedRows.length,
        errorCount: errors.length,
        errors,
        preview: validatedRows.slice(0, 5),
      });
      return;
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: `Import aborted: ${errors.length} validation errors found. Please fix them before confirming import.`,
        errors,
      });
      return;
    }

    // Execute batch insert in transaction
    const now = new Date().toISOString();
    const leaveTypes = query<any>('SELECT id, annual_days FROM leave_types');

    transaction(() => {
      for (const emp of validatedRows) {
        run(
          `INSERT INTO employees (id, employee_code, first_name, last_name, email, phone, department_id, designation_id, join_date, status, basic_salary, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            emp.id,
            emp.employee_code,
            emp.first_name,
            emp.last_name,
            emp.email,
            emp.phone,
            emp.department_id,
            emp.designation_id,
            emp.join_date,
            emp.status,
            emp.basic_salary,
            now,
            now,
          ]
        );

        for (const lt of leaveTypes) {
          run(
            `INSERT INTO leave_balances (id, employee_id, leave_type_id, total_days, used_days, pending_days, year, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, 0, 2026, ?, ?)`,
            [crypto.randomUUID(), emp.id, lt.id, lt.annual_days, now, now]
          );
        }
      }
    });

    logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CSV_IMPORT_EMPLOYEES',
      targetType: 'EMPLOYEES',
      afterState: { importedCount: validatedRows.length },
      ipAddress: req.ip,
    });

    res.json({
      message: `Successfully imported ${validatedRows.length} employees.`,
      importedCount: validatedRows.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
