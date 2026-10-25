import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import cookieParser from 'cookie-parser';
import { queryOne } from './server/db/database.js';
import { authenticate } from './server/middleware/auth.js';

// Route imports
import { authRouter } from './server/routes/authRoutes.js';
import { organizationRouter } from './server/routes/organizationRoutes.js';
import { employeeRouter } from './server/routes/employeeRoutes.js';
import { attendanceRouter } from './server/routes/attendanceRoutes.js';
import { leaveRouter } from './server/routes/leaveRoutes.js';
import { payrollRouter } from './server/routes/payrollRoutes.js';
import { dashboardRouter } from './server/routes/dashboardRoutes.js';
import { aiRouter, chatHandler } from './server/routes/aiRoutes.js';
import { communicationRouter } from './server/routes/communicationRoutes.js';
import { auditRouter } from './server/routes/auditRoutes.js';
import { userRouter } from './server/routes/userRoutes.js';

const app = express();

// CORS middleware to prevent cross-origin issues
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Core Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(authenticate);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const hasAiKey = Boolean(process.env.AI_API_KEY || process.env.GEMINI_API_KEY);
  let database = 'disconnected';
  try {
    await queryOne('SELECT 1 as ok');
    database = process.env.TURSO_DATABASE_URL ? 'Turso Cloud (libSQL)' : 'SQLite (local file)';
  } catch (err: any) {
    database = `error: ${err?.message || 'unavailable'}`;
  }
  res.json({
    status: 'healthy',
    app: 'HCM Lite - Saylani Hackathon',
    database,
    ai: hasAiKey,
    timestamp: new Date().toISOString(),
  });
});

// Mount API routers
app.use('/api/auth', authRouter);
app.use('/api/organization', organizationRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leave', leaveRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai', aiRouter);
app.post('/api/chat', chatHandler);
app.use('/api/communication', communicationRouter);
app.use('/api/audit', auditRouter);
app.use('/api/users', userRouter);

const isProduction = process.env.NODE_ENV === 'production';
const staticPath = path.join(process.cwd(), isProduction ? 'public' : 'dist');

if (isProduction) {
  app.use(express.static(staticPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'API endpoint not found.' });
      return;
    }
    const indexFile = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile);
      return;
    }
    res.redirect('/');
  });
}

export default app;
