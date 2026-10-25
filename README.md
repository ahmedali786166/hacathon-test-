# HCM Lite - Human Capital Management System
**Saylani Hackathon Full-Stack Submission**

A complete, production-grade Human Capital Management (HCM) application built with React, TypeScript, Tailwind CSS, Express, a persistent relational database, and Google's Gemini AI Assistant (supporting fluent English and Roman Urdu).

---

## 🌟 Architecture & Features

### 1. Relational Database & Real Persistence
- Powered by persistent SQLite engine with full relational schemas, foreign keys, constraints, and ACID transactions.
- Zero fake/dummy business data seeded. First-run onboarding wizard allows creating company settings, office rules, and the initial Administrator account. Public Admin registration is locked immediately after initialization.

### 2. Department & Designation Hierarchical Combobox
- Solves the previous dropdown issue:
  - Fetches real departments from `/api/organization/departments`.
  - Designations are dynamically linked and filtered by the selected department.
  - Changes in department automatically refresh and reset the designation.
  - Built-in search, empty states with direct navigation to Organization Settings, and zero UI clipping.
  - Server-side validation guarantees designations belong to their assigned department.

### 3. Pakistan Income Tax & Payroll Engine
- Gross Salary = $1.5 \times$ Basic Salary.
- House Rent Allowance (HRA) = 40% of Basic Salary.
- Medical Allowance = 10% of Basic Salary.
- Daily Gross = Gross Salary / Configured Working Days in the Month.
- Deductions:
  - Absent Deductions = Absent Days $\times$ Daily Gross.
  - Half-Day Deductions = $0.5 \times$ Daily Gross $\times$ Half-Days.
- **Pakistan Annual Income Tax Slabs**:
  - Up to PKR 600,000: 0%
  - PKR 600,001 – 1,200,000: 5% of amount exceeding PKR 600,000.
  - PKR 1,200,001 – 2,400,000: PKR 30,000 + 15% exceeding PKR 1,200,000.
  - PKR 2,400,001 – 3,600,000: PKR 210,000 + 25% exceeding PKR 2,400,000.
  - Above PKR 3,600,000: PKR 510,000 + 35% exceeding PKR 3,600,000.
- Monthly Tax = Annual Tax / 12.
- HR prepares and reviews payroll drafts; **Admin alone** has authority to finalize and lock payroll.
- Downloadable computer-generated PDF payslips in PKR format using `jspdf`.

### 4. Gemini AI Assistant (Roman Urdu & English)
- Integrated on server-side using `@google/genai` and model `gemini-3.8-flash`.
- Speaks natural Roman Urdu (e.g., "Aaj kitne employees late hain?", "Meri kitni chuttiyan baqi hain?", "Aaj kon kon chutti par hai?") and professional English.
- Tool Calling with Role-Based Access Control:
  - `get_headcount`
  - `get_attendance_summary`
  - `get_late_comers`
  - `get_leave_summary`
  - `get_my_leave_balance`
  - `get_payroll_summary` (Admin/HR only)
  - `search_employees` (masks salary for unauthorized users)
- Smart Leave Assistant: parses unstructured Roman Urdu or English requests, verifies balance, and prefills the leave application for explicit employee review.

### 5. Role-Based Permissions (RBAC)
- **ADMIN**: Organization settings, user management, audit logs, payroll review & exclusive locking.
- **HR**: Employee directory & registration, attendance corrections with mandatory audit reasons, leave approval queue, payroll draft preparation.
- **EMPLOYEE**: Punch clock (check-in/out), own attendance history, leave applications & balances, finalized payslip downloads.

---

## 🚀 Running the Application

### Setup Environment
```bash
# Copy environment file
cp .env.example .env

# Configure GEMINI_API_KEY in Secrets or .env
```

### Development
```bash
npm run dev
```

### Automated Tests
Run the 12 comprehensive calculation and security tests:
```bash
npx vitest run
```

### Production Build
```bash
npm run build
npm start
```
