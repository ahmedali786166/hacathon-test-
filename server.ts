import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { getDb } from './server/db/database.js';
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

async function bootstrap() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize SQLite WASM Database
  console.log('[HCM Lite] Initializing persistent relational database...');
  await getDb();
  console.log('[HCM Lite] Database initialized successfully.');

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
  app.get('/api/health', (req, res) => {
    const hasAiKey = Boolean(process.env.AI_API_KEY || process.env.GEMINI_API_KEY);
    res.json({
      status: 'healthy',
      app: 'HCM Lite - Saylani Hackathon',
      database: 'SQLite (Persistent Relational)',
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

  // Vite Integration
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HCM Lite] Server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('[HCM Lite] Fatal startup error:', err);
  process.exit(1);
});
