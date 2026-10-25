import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { db } from '../config/database';
import { IUser } from '../models/User';
import { AppError } from '../utils/apiResponse';

export interface SessionJwtPayload {
  sub: string;
  role: 'user' | 'admin';
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export function signSessionToken(user: IUser): string {
  const payload: SessionJwtPayload = {
    sub: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'vibeflow-api',
    audience: 'vibeflow-client',
  });
}

function isHttpsContext(req?: Request): boolean {
  if (env.NODE_ENV === 'production') return true;
  if (!req) return false;
  if (req.secure) return true;
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim() === 'https') {
    return true;
  }
  return false;
}

export function setSessionCookie(res: Response, token: string, req?: Request): void {
  const useSecureCookie = isHttpsContext(req);
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: useSecureCookie,
    sameSite: useSecureCookie ? 'none' : 'lax',
    ...(useSecureCookie ? { partitioned: true } : {}),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, req?: Request): void {
  const useSecureCookie = isHttpsContext(req);
  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    secure: useSecureCookie,
    sameSite: useSecureCookie ? 'none' : 'lax',
    ...(useSecureCookie ? { partitioned: true } : {}),
    path: '/',
  });
}

function extractToken(req: Request): string | null {
  if (req.cookies && typeof req.cookies[env.COOKIE_NAME] === 'string') {
    const cookieVal = req.cookies[env.COOKIE_NAME].trim();
    if (cookieVal) return cookieVal;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerVal = authHeader.slice(7).trim();
    if (bearerVal) return bearerVal;
  }
  return null;
}

/**
 * Resolves the authenticated user if a valid session cookie or Bearer token is present.
 * Never auto-creates a user or falls back to a default account.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      req.user = undefined;
      return next();
    }

    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'vibeflow-api',
      audience: 'vibeflow-client',
    }) as SessionJwtPayload;

    if (!decoded || typeof decoded.sub !== 'string') {
      req.user = undefined;
      return next();
    }

    const user = await db.findUserById(decoded.sub, false);
    if (user && user.isActive && user.tokenVersion === decoded.tokenVersion) {
      req.user = user;
    } else {
      req.user = undefined;
    }
    next();
  } catch {
    req.user = undefined;
    next();
  }
}

/**
 * Strictly requires a valid, non-expired, non-revoked session across all environments.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required to access this resource.');
    }

    let decoded: SessionJwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'vibeflow-api',
        audience: 'vibeflow-client',
      }) as SessionJwtPayload;
    } catch {
      throw new AppError(
        401,
        'SESSION_EXPIRED',
        'Your session is invalid or has expired. Please sign in again.'
      );
    }

    if (!decoded || typeof decoded.sub !== 'string') {
      throw new AppError(401, 'SESSION_EXPIRED', 'Invalid session payload. Please sign in again.');
    }

    const user = await db.findUserById(decoded.sub, false);
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Account no longer exists. Please sign in again.');
    }
    if (!user.isActive) {
      throw new AppError(
        403,
        'ACCOUNT_SUSPENDED',
        'Your account has been suspended by an administrator.'
      );
    }
    if (user.tokenVersion !== decoded.tokenVersion) {
      throw new AppError(
        401,
        'SESSION_REVOKED',
        'Session has been logged out or invalidated. Please sign in again.'
      );
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required.'));
  }
  // Always enforce role from server-loaded database user, never client payload
  if (req.user.role !== 'admin') {
    return next(
      new AppError(
        403,
        'FORBIDDEN_ADMIN_ONLY',
        'Administrator privileges are required for this action.'
      )
    );
  }
  next();
}

/**
 * CSRF defense middleware for state-changing HTTP methods when using cookie-based sessions.
 * Verifies Origin header when present and rejects cross-site form submissions that lack
 * JSON content-type or custom request headers.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(req.method.toUpperCase())) {
    return next();
  }

  const origin = req.headers.origin;
  if (origin) {
    const cleanOrigin = origin.replace(/\/+$/, '');
    const isAllowed =
      env.ALLOWED_ORIGINS.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.run.app') ||
      (env.NODE_ENV !== 'production' &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin));

    if (!isAllowed) {
      return next(
        new AppError(
          403,
          'CSRF_ORIGIN_DENIED',
          'Cross-origin state-changing request from untrusted origin was blocked.'
        )
      );
    }
  }

  // If the request carries a session cookie, ensure it wasn't sent by a simple HTML form
  const hasSessionCookie = Boolean(req.cookies && req.cookies[env.COOKIE_NAME]);
  if (hasSessionCookie) {
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    const requestedWith = req.headers['x-requested-with'];
    const hasBearer = Boolean(req.headers.authorization);
    const isJsonOrCustomHeader =
      contentType.includes('application/json') ||
      Boolean(requestedWith) ||
      hasBearer ||
      contentType === '';

    if (
      !isJsonOrCustomHeader &&
      (contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data') ||
        contentType.includes('text/plain'))
    ) {
      return next(
        new AppError(
          403,
          'CSRF_PROTECTION_TRIGGERED',
          'Cross-site form submission blocked by CSRF protection.'
        )
      );
    }
  }

  next();
}
