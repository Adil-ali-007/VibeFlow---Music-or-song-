import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../config/database';
import { env } from '../config/env';

const bootstrapEnvSchema = z.object({
  email: z.string().trim().toLowerCase().email('ADMIN_EMAIL must be a valid email address.'),
  password: z
    .string()
    .min(8, 'ADMIN_INITIAL_PASSWORD must be at least 8 characters long.')
    .max(72, 'ADMIN_INITIAL_PASSWORD cannot exceed 72 characters.')
    .regex(/[A-Za-z]/, 'ADMIN_INITIAL_PASSWORD must contain at least one letter.')
    .regex(/[0-9]/, 'ADMIN_INITIAL_PASSWORD must contain at least one number.'),
});

export interface BootstrapResult {
  status: 'created' | 'already_admin' | 'refused_existing_user' | 'invalid_config';
  message: string;
}

export async function runAdminBootstrap(
  rawEmail = env.ADMIN_EMAIL,
  rawPassword = env.ADMIN_INITIAL_PASSWORD
): Promise<BootstrapResult> {
  if (!rawEmail || !rawPassword) {
    return {
      status: 'invalid_config',
      message:
        'Missing ADMIN_EMAIL or ADMIN_INITIAL_PASSWORD in environment. Set both variables privately before running admin:bootstrap.',
    };
  }

  const parsed = bootstrapEnvSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || 'Invalid admin bootstrap configuration.';
    return {
      status: 'invalid_config',
      message: `Admin configuration validation failed: ${firstIssue}`,
    };
  }

  await db.connect();

  const existing = await db.findUserByEmail(parsed.data.email, false);
  if (existing) {
    if (existing.role === 'admin') {
      return {
        status: 'already_admin',
        message: `Administrator account (${parsed.data.email}) already exists. Skipping without overwriting password.`,
      };
    }
    return {
      status: 'refused_existing_user',
      message: `An ordinary user account with email (${parsed.data.email}) already exists. Refusing to automatically promote or overwrite password.`,
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.createUser({
    email: parsed.data.email,
    displayName: 'System Administrator',
    passwordHash,
    authProviders: ['local'],
    role: 'admin',
  });

  return {
    status: 'created',
    message: `Initial administrator account (${parsed.data.email}) provisioned successfully.`,
  };
}

// Execute when invoked via `npm run admin:bootstrap`
if (process.argv[1] && process.argv[1].includes('adminBootstrap')) {
  runAdminBootstrap()
    .then((result) => {
      console.log(`[admin:bootstrap] ${result.message}`);
      if (result.status === 'invalid_config' || result.status === 'refused_existing_user') {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[admin:bootstrap] Unexpected error during bootstrap:', err instanceof Error ? err.message : 'Unknown error');
      process.exit(1);
    });
}
