import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hcm-lite-saylani-hackathon-secure-secret-key-2026';

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'HR' | 'EMPLOYEE';
  employee_id?: string | null;
  full_name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id,
      full_name: user.full_name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.hcm_token) {
      token = req.cookies.hcm_token;
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    
    // Verify user is still active in database
    const dbUser = await queryOne<any>(
      'SELECT id, email, role, employee_id, full_name, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (dbUser && dbUser.is_active === 1) {
      req.user = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        employee_id: dbUser.employee_id,
        full_name: dbUser.full_name,
      };
    }
    next();
  } catch (error) {
    // Invalid token, proceed unauthenticated
    next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

export function requireRole(allowedRoles: ('ADMIN' | 'HR' | 'EMPLOYEE')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
      });
      return;
    }
    next();
  };
}

// In-memory sliding window rate limiter for sensitive endpoints
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req.user ? req.user.id : req.ip) + ':' + req.baseUrl + req.path;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (entry.count >= limit) {
      const waitSeconds = Math.ceil((entry.resetTime - now) / 1000);
      res.status(429).json({
        error: `Too many requests. Please wait ${waitSeconds} seconds before trying again.`,
      });
      return;
    }

    entry.count++;
    next();
  };
}
