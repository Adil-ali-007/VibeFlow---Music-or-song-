import path from 'path';
import dotenv from 'dotenv';

// Load root .env and backend/.env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

export interface AppEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  PUBLIC_URL: string;
  MONGODB_URI: string;
  JWT_SECRET: string;
  COOKIE_NAME: string;
  FRONTEND_URL: string;
  ALLOWED_ORIGINS: string[];
  MUSIC_SERVICE_URL: string;
  INTERNAL_SERVICE_TOKEN: string;
  ADMIN_EMAIL: string;
  ADMIN_INITIAL_PASSWORD: string;
}

const DEV_FALLBACK_JWT_SECRET = 'dev-only-ephemeral-jwt-secret-change-in-production-32chars';

const nodeEnvRaw = (
  process.env.VITEST ? 'test' : process.env.NODE_ENV || 'development'
).trim();
const NODE_ENV: AppEnv['NODE_ENV'] =
  nodeEnvRaw === 'production' || nodeEnvRaw === 'test' ? nodeEnvRaw : 'development';

function resolveServerPort(): number {
  if (process.env.BACKEND_PORT) {
    return Number(process.env.BACKEND_PORT);
  }
  if (process.env.DEFAULT_APP_PORT) {
    return Number(process.env.DEFAULT_APP_PORT);
  }
  const rawPort = Number(process.env.PORT || 3000);
  // Port 8080 is used by the container reverse proxy in Cloud Run / AI Studio
  return rawPort === 8080 ? 3000 : rawPort;
}

function parseAllowedOrigins(frontendUrl: string, rawOrigins?: string): string[] {
  const origins = new Set<string>();
  if (frontendUrl) {
    origins.add(frontendUrl.replace(/\/+$/, ''));
  }
  if (rawOrigins) {
    for (const part of rawOrigins.split(',')) {
      const trimmed = part.trim().replace(/\/+$/, '');
      if (trimmed) origins.add(trimmed);
    }
  }
  if (NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://127.0.0.1:5173');
  }
  return Array.from(origins);
}

const frontendUrl = (
  process.env.FRONTEND_URL ||
  process.env.APP_URL ||
  (NODE_ENV === 'production' ? '' : 'http://localhost:3000')
)
  .trim()
  .replace(/\/+$/, '');

const publicUrl = (
  process.env.PUBLIC_URL ||
  process.env.APP_URL ||
  frontendUrl ||
  'http://localhost:3000'
)
  .trim()
  .replace(/\/+$/, '');

const jwtSecretFromEnv = (process.env.JWT_SECRET || '').trim();

export const env: AppEnv = {
  NODE_ENV,
  PORT: resolveServerPort(),
  PUBLIC_URL: publicUrl,
  MONGODB_URI: (process.env.MONGODB_URI || '').trim(),
  JWT_SECRET: jwtSecretFromEnv || DEV_FALLBACK_JWT_SECRET,
  COOKIE_NAME: 'vibeflow_session',
  FRONTEND_URL: frontendUrl || 'http://localhost:3000',
  ALLOWED_ORIGINS: parseAllowedOrigins(frontendUrl, process.env.ALLOWED_ORIGINS),
  MUSIC_SERVICE_URL: (process.env.MUSIC_SERVICE_URL || 'http://127.0.0.1:5001')
    .trim()
    .replace(/\/+$/, ''),
  INTERNAL_SERVICE_TOKEN: (process.env.INTERNAL_SERVICE_TOKEN || '').trim(),
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD || '',
};

/**
 * Validates required production configuration and secrets.
 * Fails fast and clearly when mandatory production variables are missing or insecure.
 */
export function validateProductionEnv(targetEnv: Pick<
  AppEnv,
  'NODE_ENV' | 'JWT_SECRET' | 'MONGODB_URI' | 'FRONTEND_URL'
> = env): void {
  if (targetEnv.NODE_ENV !== 'production') {
    return;
  }

  const secret = (targetEnv.JWT_SECRET || '').trim();
  if (!secret || secret.length < 32 || secret === DEV_FALLBACK_JWT_SECRET) {
    throw new Error(
      'CRITICAL: JWT_SECRET must be explicitly set to a strong secret of at least 32 characters in production.'
    );
  }

  const mongoUri = (targetEnv.MONGODB_URI || '').trim();
  if (!mongoUri || !/^mongodb(\+srv)?:\/\//i.test(mongoUri)) {
    throw new Error(
      'CRITICAL: MONGODB_URI must be explicitly configured with a valid mongodb:// or mongodb+srv:// connection string in production.'
    );
  }
}

if (NODE_ENV === 'production') {
  validateProductionEnv(env);
}
