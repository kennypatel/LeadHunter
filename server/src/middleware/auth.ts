import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'CLIENT' | 'VIEWER';
  companyId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

/** Extract a JWT from cookie or Authorization header. */
function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[env.cookieName];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthUser;
    req.user = { id: payload.id, email: payload.email, role: payload.role, companyId: payload.companyId };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/** Restrict a route to specific roles. */
export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/**
 * Resolve which companyId the request may act on. Admins may target any
 * company (via query/body), clients/viewers are pinned to their own.
 */
export function scopedCompanyId(req: Request, requested?: string | null): string | null {
  if (req.user?.role === 'ADMIN') return requested ?? req.user.companyId ?? null;
  return req.user?.companyId ?? null;
}
