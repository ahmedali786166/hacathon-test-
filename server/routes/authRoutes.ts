import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { queryOne, run, transaction } from '../db/database.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

export const authRouter = Router();

// Check system setup status
authRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const adminUser = await queryOne<any>("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
    const settings = await queryOne<any>('SELECT is_setup_complete, name, currency, timezone FROM company_settings LIMIT 1');
    const isSetupComplete = Boolean(settings?.is_setup_complete === 1 && adminUser);

    res.json({
      isSetupComplete,
      company: isSetupComplete ? {
        name: settings.name,
        currency: settings.currency,
        timezone: settings.timezone,
      } : null,
      currentUser: req.user || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// First-run setup wizard: Creates company info + office rules + first Admin account.
// If the system is already initialized, the current admin password is required to
// re-run the wizard and update company settings + admin credentials.
authRouter.post('/setup', async (req: Request, res: Response) => {
  try {
    const adminUser = await queryOne<any>("SELECT id, password_hash FROM users WHERE role = 'ADMIN' LIMIT 1");
    const existing = await queryOne<any>('SELECT is_setup_complete FROM company_settings WHERE is_setup_complete = 1 LIMIT 1');
    const isInitialized = Boolean(existing && adminUser);

    if (isInitialized && !req.body.currentAdminPassword) {
      res.status(403).json({
        error: 'System already initialized. Enter the current admin password to update credentials.',
        requiresCurrentPassword: true,
      });
      return;
    }

    if (isInitialized) {
      const passwordMatches = await bcrypt.compare(req.body.currentAdminPassword, adminUser.password_hash);
      if (!passwordMatches) {
        res.status(403).json({ error: 'Current admin password is incorrect.', requiresCurrentPassword: true });
        return;
      }
    }

    const {
      companyName,
      legalName,
      officeAddress,
      startTime = '09:00',
      graceMinutes = 15,
      halfDayHours = 5.0,
      adminName,
      adminEmail,
      adminPassword,
    } = req.body;

    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      res.status(400).json({ error: 'Company Name, Admin Name, Admin Email, and Admin Password are required.' });
      return;
    }

    if (adminPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);
    const now = new Date().toISOString();
    const email = adminEmail.toLowerCase().trim();

    if (isInitialized) {
      await transaction(async () => {
        await run(
          `UPDATE company_settings
           SET name = ?, legal_name = ?, office_address = ?, start_time = ?, grace_minutes = ?, half_day_hours = ?, updated_at = ?
           WHERE is_setup_complete = 1`,
          [companyName, legalName || companyName, officeAddress || '', startTime, graceMinutes, halfDayHours, now]
        );
        await run(
          'UPDATE users SET email = ?, password_hash = ?, full_name = ?, updated_at = ? WHERE id = ?',
          [email, passwordHash, adminName, now, adminUser.id]
        );
      });

      await logAudit({
        actorId: adminUser.id,
        actorEmail: email,
        actorRole: 'ADMIN',
        action: 'SYSTEM_REINITIALIZATION',
        targetType: 'SYSTEM',
        targetId: adminUser.id,
        afterState: { companyName, adminEmail: email },
        ipAddress: req.ip,
      });

      const userObj = { id: adminUser.id, email, role: 'ADMIN' as const, full_name: adminName };
      const token = generateToken(userObj);
      res.cookie('hcm_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ message: 'Credentials updated successfully.', token, user: userObj });
      return;
    }

    const adminId = crypto.randomUUID();
    const settingsId = crypto.randomUUID();

    await transaction(async () => {
      // 1. Save company settings
      await run('DELETE FROM company_settings');
      await run(
        `INSERT INTO company_settings (id, name, legal_name, currency, timezone, start_time, grace_minutes, half_day_hours, weekend_days, office_address, is_setup_complete, created_at, updated_at)
         VALUES (?, ?, ?, 'PKR', 'Asia/Karachi', ?, ?, ?, '["Saturday","Sunday"]', ?, 1, ?, ?)`,
        [settingsId, companyName, legalName || companyName, startTime, graceMinutes, halfDayHours, officeAddress || '', now, now]
      );

      // 2. Create default standard company leave types (Rule defaults)
      const defaultLeaveTypes = [
        { name: 'Annual Leave', code: 'ANNUAL', days: 14, isPaid: 1, desc: 'Standard annual paid vacation quota' },
        { name: 'Sick Leave', code: 'SICK', days: 8, isPaid: 1, desc: 'Medical and sickness leave' },
        { name: 'Casual Leave', code: 'CASUAL', days: 10, isPaid: 1, desc: 'Short personal and urgent leave' },
        { name: 'Unpaid Leave', code: 'UNPAID', days: 0, isPaid: 0, desc: 'Leave without pay (unlimited)' },
      ];

      await run('DELETE FROM leave_types');
      for (const lt of defaultLeaveTypes) {
        const ltId = crypto.randomUUID();
        await run(
          `INSERT INTO leave_types (id, name, code, annual_days, is_paid, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ltId, lt.name, lt.code, lt.days, lt.isPaid, lt.desc, now]
        );
      }

      // 3. Create first Admin user (clear existing by email to avoid unique constraint)
      await run('DELETE FROM users WHERE email = ?', [adminEmail.toLowerCase().trim()]);
      await run(
        `INSERT INTO users (id, email, password_hash, role, employee_id, full_name, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 'ADMIN', NULL, ?, 1, ?, ?)`,
        [adminId, adminEmail.toLowerCase().trim(), passwordHash, adminName, now, now]
      );
    });

    await logAudit({
      actorId: adminId,
      actorEmail: adminEmail,
      actorRole: 'ADMIN',
      action: 'SYSTEM_INITIALIZATION',
      targetType: 'SYSTEM',
      targetId: settingsId,
      afterState: { companyName, adminEmail },
      ipAddress: req.ip,
    });

    const userObj = {
      id: adminId,
      email: adminEmail.toLowerCase().trim(),
      role: 'ADMIN' as const,
      full_name: adminName,
    };
    const token = generateToken(userObj);

    res.cookie('hcm_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Company initialized successfully.',
      token,
      user: userObj,
    });
  } catch (err: any) {
    console.error('Setup error:', err);
    res.status(500).json({ error: err.message || 'Failed to complete setup' });
  }
});

// Login endpoint
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await queryOne<any>(
      'SELECT id, email, password_hash, role, employee_id, full_name, is_active FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.is_active !== 1) {
      res.status(403).json({ error: 'Your account has been deactivated. Please contact HR or Administrator.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const userObj = {
      id: user.id,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id,
      full_name: user.full_name,
    };
    const token = generateToken(userObj);

    res.cookie('hcm_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGIN',
      targetType: 'USER',
      targetId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      message: 'Login successful',
      token,
      user: userObj,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logout endpoint
authRouter.post('/logout', async (req: Request, res: Response) => {
  res.clearCookie('hcm_token');
  res.json({ message: 'Signed out successfully' });
});

// Get current profile
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  let employeeDetails: any = null;

  if (user.employee_id) {
    employeeDetails = await queryOne<any>(`
      SELECT e.*, d.name as department_name, des.title as designation_title 
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      WHERE e.id = ?
    `, [user.employee_id]);
  }

  res.json({
    user,
    employee: employeeDetails,
  });
});

// Change password
authRouter.put('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Current password and valid new password (at least 6 chars) required.' });
      return;
    }

    const user = await queryOne<any>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      res.status(400).json({ error: 'Incorrect current password.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      newHash,
      new Date().toISOString(),
      req.user!.id,
    ]);

    await logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'PASSWORD_CHANGED',
      targetType: 'USER',
      targetId: req.user!.id,
      ipAddress: req.ip,
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
