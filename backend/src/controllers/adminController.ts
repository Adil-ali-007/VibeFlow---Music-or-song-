import { NextFunction, Request, Response } from 'express';
import { db } from '../config/database';
import { musicProviderAdapter } from '../services/musicProviderAdapter';
import { AppError, sendSuccess } from '../utils/apiResponse';
import { adminUpdateUserStatusSchema } from '../validators/schemas';

export async function getAdminOverview(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [counts, users, providerHealth] = await Promise.all([
      db.getSystemCounts(),
      db.listUsersForAdmin(),
      musicProviderAdapter.checkHealth(),
    ]);

    const dbStatus = db.getStatus();

    sendSuccess(res, {
      counts,
      services: {
        database: dbStatus,
        musicProvider: providerHealth,
      },
      users: users.map((u) => ({
        id: u._id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        authProviders: u.authProviders,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }

    const targetId = req.params.id;
    if (targetId === req.user._id) {
      throw new AppError(
        400,
        'CANNOT_MODIFY_SELF',
        'Administrators cannot suspend their own active account.'
      );
    }

    const { isActive } = adminUpdateUserStatusSchema.parse(req.body);
    const targetUser = await db.findUserById(targetId, false);
    if (!targetUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Target user was not found.');
    }
    if (targetUser.role === 'admin') {
      throw new AppError(
        403,
        'CANNOT_MODIFY_ADMIN',
        'Other administrator accounts cannot be suspended from the web dashboard.'
      );
    }

    // Increment tokenVersion when suspending so existing sessions are immediately revoked
    const updated = await db.updateUser(targetId, {
      isActive,
      tokenVersion: (targetUser.tokenVersion || 0) + 1,
    });

    if (!updated) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Target user was not found.');
    }

    sendSuccess(res, {
      user: {
        id: updated._id,
        email: updated.email,
        displayName: updated.displayName,
        role: updated.role,
        authProviders: updated.authProviders,
        isActive: updated.isActive,
        lastLoginAt: updated.lastLoginAt,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}
