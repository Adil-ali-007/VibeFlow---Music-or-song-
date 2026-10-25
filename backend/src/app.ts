import express, { Express, NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { apiRouter } from './routes';
import { csrfProtection } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { sendError } from './utils/apiResponse';

/**
 * Recursively strips keys starting with `$` or containing `.` to prevent
 * MongoDB NoSQL operator injection (`$gt`, `$ne`, `$where`) and prototype pollution.
 */
function sanitizeNoSqlInput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeNoSqlInput);
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (
        key.startsWith('$') ||
        key.includes('.') ||
        key === '__proto__' ||
        key === 'constructor' ||
        key === 'prototype'
      ) {
        continue;
      }
      clean[key] = sanitizeNoSqlInput(val);
    }
    return clean;
  }
  return value;
}

function noSqlSanitizerMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeNoSqlInput(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeNoSqlInput(req.params) as Record<string, string>;
  }
  next();
}

export function createApiApp(): Express {
  const app = express();

  // Trust reverse proxy (Cloud Run / nginx) so req.ip and rate limiters resolve client IP accurately
  app.set('trust proxy', 1);

  // Security headers with allowance for YouTube IFrame Player embeds
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Explicit CORS configuration using environment-configured origins
  const allowedOrigins = new Set(env.ALLOWED_ORIGINS);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        const cleanOrigin = origin.replace(/\/+$/, '');
        if (allowedOrigins.has(cleanOrigin) || cleanOrigin.endsWith('.run.app')) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    })
  );

  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use(noSqlSanitizerMiddleware);
  app.use('/api', csrfProtection, apiRouter);

  // Return JSON 404 for unknown /api/* routes
  app.use('/api/*', (_req, res) => {
    sendError(res, 404, 'API_ROUTE_NOT_FOUND', 'The requested API endpoint does not exist.');
  });

  app.use(errorHandler);

  return app;
}
