import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import {
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
} from '../middleware/auth';
import { AppError, sendSuccess } from '../utils/apiResponse';
import { loginSchema, registerSchema } from '../validators/schemas';

// Precomputed bcrypt hash (12 rounds) used to mitigate timing-based user enumeration when email is not found
const DUMMY_BCRYPT_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

function sanitizeUser(user: {
  _id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  authProviders: 'local'[];
  musicPreferences?: string[];
  onboardingCompleted?: boolean;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
}) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    authProviders: user.authProviders,
    musicPreferences: Array.isArray(user.musicPreferences) ? user.musicPreferences : [],
    onboardingCompleted: Boolean(user.onboardingCompleted),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = registerSchema.parse(req.body);
    const existing = await db.findUserByEmail(parsed.email, false);
    if (existing) {
      throw new AppError(
        409,
        'DUPLICATE_ACCOUNT',
        'Unable to complete registration with the provided email address.'
      );
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);

    // Public registration MUST always assign the ordinary 'user' role on the server
    const createdUser = await db.createUser({
      email: parsed.email,
      displayName: parsed.displayName,
      passwordHash,
      authProviders: ['local'],
      role: 'user',
    });

    const token = signSessionToken(createdUser);
    setSessionCookie(res, token, req);

    sendSuccess(
      res,
      {
        user: sanitizeUser(createdUser),
        token,
      },
      201
    );
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await db.findUserByEmail(parsed.email, true);

    if (!user || !user.passwordHash) {
      await bcrypt.compare(parsed.password, DUMMY_BCRYPT_HASH);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const passwordValid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!passwordValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (!user.isActive) {
      throw new AppError(
        403,
        'ACCOUNT_SUSPENDED',
        'Your account has been suspended. Please contact support.'
      );
    }

    const updated =
      (await db.updateUser(user._id, { lastLoginAt: new Date() })) || user;

    const token = signSessionToken(updated);
    setSessionCookie(res, token, req);

    sendSuccess(res, {
      user: sanitizeUser(updated),
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user) {
      // Increment tokenVersion so any existing JWT cannot be replayed after logout
      await db.updateUser(req.user._id, {
        tokenVersion: (req.user.tokenVersion || 0) + 1,
      });
    }
    clearSessionCookie(res, req);
    sendSuccess(res, { loggedOut: true });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendSuccess(res, {
        authenticated: false,
        user: null,
      });
      return;
    }
    sendSuccess(res, {
      authenticated: true,
      user: sanitizeUser(req.user),
    });
  } catch (err) {
    next(err);
  }
}
