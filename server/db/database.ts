import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: Database | null = null;
const DB_FILE = process.env.DATABASE_FILE || path.join(process.cwd(), 'hcm_lite.sqlite');

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Failed to read existing database file, creating fresh database:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Enforce foreign key constraints
  db.run('PRAGMA foreign_keys = ON;');
  initSchema(db);
  saveDb();
  return db;
}

export function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving database to disk:', err);
  }
}

function initSchema(database: Database): void {
  database.run(`
    -- Company Settings Table
    CREATE TABLE IF NOT EXISTS company_settings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      legal_name TEXT,
      currency TEXT NOT NULL DEFAULT 'PKR',
      timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
      start_time TEXT NOT NULL DEFAULT '09:00',
      grace_minutes INTEGER NOT NULL DEFAULT 15,
      half_day_hours REAL NOT NULL DEFAULT 5.0,
      weekend_days TEXT NOT NULL DEFAULT '["Saturday","Sunday"]',
      office_address TEXT,
      geofence_lat REAL,
      geofence_lng REAL,
      geofence_radius_meters INTEGER DEFAULT 100,
      is_setup_complete INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Users Table (Authentication)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'HR', 'EMPLOYEE')),
      employee_id TEXT,
      full_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Departments Table
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Designations Table (Linked to Departments)
    CREATE TABLE IF NOT EXISTS designations (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      UNIQUE(department_id, title)
    );

    -- Employees Table
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      employee_code TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      department_id TEXT NOT NULL,
      designation_id TEXT NOT NULL,
      join_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'TERMINATED')),
      basic_salary REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (designation_id) REFERENCES designations(id)
    );

    -- Leave Types Table
    CREATE TABLE IF NOT EXISTS leave_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      annual_days INTEGER NOT NULL DEFAULT 0,
      is_paid INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      created_at TEXT NOT NULL
    );

    -- Leave Balances Table
    CREATE TABLE IF NOT EXISTS leave_balances (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      leave_type_id TEXT NOT NULL,
      total_days REAL NOT NULL DEFAULT 0,
      used_days REAL NOT NULL DEFAULT 0,
      pending_days REAL NOT NULL DEFAULT 0,
      year INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
      UNIQUE(employee_id, leave_type_id, year)
    );

    -- Leave Requests Table
    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      leave_type_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_days REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
      reviewer_id TEXT,
      review_timestamp TEXT,
      review_comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id)
    );

    -- Attendance Records Table
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL, -- YYYY-MM-DD
      check_in_time TEXT, -- HH:mm:ss
      check_out_time TEXT, -- HH:mm:ss
      total_working_hours REAL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'WEEKEND', 'HOLIDAY')),
      is_corrected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, date)
    );

    -- Attendance Corrections Table (Audit trail)
    CREATE TABLE IF NOT EXISTS attendance_corrections (
      id TEXT PRIMARY KEY,
      attendance_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      original_status TEXT,
      new_status TEXT NOT NULL,
      original_check_in TEXT,
      new_check_in TEXT,
      original_check_out TEXT,
      new_check_out TEXT,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users(id)
    );

    -- Company Holidays Table
    CREATE TABLE IF NOT EXISTS company_holidays (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
      is_recurring INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Payroll Runs Table
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL UNIQUE, -- YYYY-MM
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'LOCKED')),
      total_gross REAL NOT NULL DEFAULT 0,
      total_net REAL NOT NULL DEFAULT 0,
      total_tax REAL NOT NULL DEFAULT 0,
      total_deductions REAL NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      locked_by TEXT,
      locked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (locked_by) REFERENCES users(id)
    );

    -- Payslips Table
    CREATE TABLE IF NOT EXISTS payslips (
      id TEXT PRIMARY KEY,
      payroll_run_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      month TEXT NOT NULL, -- YYYY-MM
      basic_salary REAL NOT NULL,
      gross_salary REAL NOT NULL,
      hra REAL NOT NULL,
      medical_allowance REAL NOT NULL,
      other_allowance REAL NOT NULL DEFAULT 0,
      working_days INTEGER NOT NULL,
      present_days REAL NOT NULL,
      absent_days REAL NOT NULL,
      half_days REAL NOT NULL,
      leave_days REAL NOT NULL,
      absent_deduction REAL NOT NULL DEFAULT 0,
      half_day_deduction REAL NOT NULL DEFAULT 0,
      tax_deduction REAL NOT NULL DEFAULT 0,
      other_deductions REAL NOT NULL DEFAULT 0,
      net_salary REAL NOT NULL,
      is_locked INTEGER NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL,
      FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(payroll_run_id, employee_id)
    );

    -- Announcements Table
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target_audience TEXT NOT NULL DEFAULT 'ALL',
      author_id TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    -- Notifications Table
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'SYSTEM',
      is_read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_email TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      before_state TEXT,
      after_state TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    -- AI Assistant Logs Table
    CREATE TABLE IF NOT EXISTS ai_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      prompt_summary TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      tools_called TEXT,
      outcome TEXT NOT NULL,
      latency_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_designations_dept ON designations(department_id);
    CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
    CREATE INDEX IF NOT EXISTS idx_employees_desig ON employees(designation_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);
    CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);
    CREATE INDEX IF NOT EXISTS idx_leave_balances_emp ON leave_balances(employee_id);
    CREATE INDEX IF NOT EXISTS idx_payslips_month ON payslips(month);
    CREATE INDEX IF NOT EXISTS idx_payslips_emp ON payslips(employee_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
  `);
}

// Synchronous query helper wrapping sql.js prepared statements
export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

let inTransaction = false;

export function run(sql: string, params: any[] = []): { changes: number } {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  if (!inTransaction) {
    saveDb();
  }
  return { changes: db.getRowsModified() };
}

export function transaction<T>(callback: () => T): T {
  if (!db) throw new Error('Database not initialized');
  if (inTransaction) {
    return callback();
  }
  inTransaction = true;
  db.run('BEGIN TRANSACTION;');
  try {
    const result = callback();
    db.run('COMMIT;');
    inTransaction = false;
    saveDb();
    return result;
  } catch (error) {
    inTransaction = false;
    try {
      db.run('ROLLBACK;');
    } catch {}
    throw error;
  }
}
