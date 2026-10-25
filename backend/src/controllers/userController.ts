import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { setSessionCookie, signSessionToken } from '../middleware/auth';
import { AppError, sendSuccess } from '../utils/apiResponse';
import { updateMusicPreferencesSchema, updateProfileSchema } from '../validators/schemas';

function formatUserResponse(updated: {
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
    id: updated._id,
    email: updated.email,
    displayName: updated.displayName,
    role: updated.role,
    authProviders: updated.authProviders,
    musicPreferences: Array.isArray(updated.musicPreferences) ? updated.musicPreferences : [],
    onboardingCompleted: Boolean(updated.onboardingCompleted),
    isActive: updated.isActive,
    lastLoginAt: updated.lastLoginAt,
    createdAt: updated.createdAt,
  };
}

export async function getPreferences(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }
    const current = await db.findUserById(req.user._id, false);
    if (!current) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User account not found.');
    }
    sendSuccess(res, {
      musicPreferences: Array.isArray(current.musicPreferences) ? current.musicPreferences : [],
      onboardingCompleted: Boolean(current.onboardingCompleted),
      user: formatUserResponse(current),
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }
    const parsed = updateMusicPreferencesSchema.parse(req.body);
    const uniquePreferences = Array.from(new Set(parsed.musicPreferences));

    const updated = await db.updateUser(req.user._id, {
      musicPreferences: parsed.skip ? [] : uniquePreferences,
      onboardingCompleted: parsed.onboardingCompleted ?? true,
    });

    if (!updated) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User account not found.');
    }

    sendSuccess(res, {
      musicPreferences: Array.isArray(updated.musicPreferences) ? updated.musicPreferences : [],
      onboardingCompleted: Boolean(updated.onboardingCompleted),
      user: formatUserResponse(updated),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }

    // Strict schema validation prevents mass assignment of role, email, or googleSub
    const parsed = updateProfileSchema.parse(req.body);
    const fullUser = await db.findUserById(req.user._id, true);
    if (!fullUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User account not found.');
    }

    const updates: {
      displayName?: string;
      passwordHash?: string;
      tokenVersion?: number;
      musicPreferences?: string[];
      onboardingCompleted?: boolean;
    } = {};

    if (parsed.displayName !== undefined) {
      updates.displayName = parsed.displayName;
    }
    if (parsed.musicPreferences !== undefined) {
      updates.musicPreferences = Array.from(new Set(parsed.musicPreferences));
      updates.onboardingCompleted = true;
    }
    if (parsed.onboardingCompleted !== undefined) {
      updates.onboardingCompleted = parsed.onboardingCompleted;
    }

    if (parsed.newPassword) {
      if (!fullUser.passwordHash || !parsed.currentPassword) {
        throw new AppError(
          400,
          'CURRENT_PASSWORD_REQUIRED',
          'Current password is required to set a new password.'
        );
      }
      const validCurrent = await bcrypt.compare(parsed.currentPassword, fullUser.passwordHash);
      if (!validCurrent) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
      }
      updates.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
      updates.tokenVersion = (fullUser.tokenVersion || 0) + 1;
    }

    const updated = await db.updateUser(fullUser._id, updates);
    if (!updated) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User account not found.');
    }

    if (updates.tokenVersion !== undefined) {
      const freshToken = signSessionToken(updated);
      setSessionCookie(res, freshToken);
    }

    sendSuccess(res, {
      user: formatUserResponse(updated),
    });
  } catch (err) {
    next(err);
  }
}
