import { NextFunction, Request, Response } from 'express';
import { db } from '../config/database';
import { AppError, sendSuccess } from '../utils/apiResponse';
import { recordHistorySchema } from '../validators/schemas';

export async function listHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const history = await db.listHistoryByUser(req.user._id);
    sendSuccess(res, { history });
  } catch (err) {
    next(err);
  }
}

export async function recordHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const parsed = recordHistorySchema.parse(req.body);
    const entry = await db.recordHistory(req.user._id, {
      providerId: parsed.providerId,
      title: parsed.title,
      artistName: parsed.artistName,
      albumName: parsed.albumName ?? null,
      durationSeconds: parsed.durationSeconds ?? null,
      durationFormatted: parsed.durationFormatted ?? '0:00',
      thumbnailUrl:
        parsed.thumbnailUrl ?? `https://i.ytimg.com/vi/${parsed.providerId}/hqdefault.jpg`,
      playbackType: 'YOUTUBE_EMBED',
      embedUrl:
        parsed.embedUrl ??
        `https://www.youtube.com/embed/${parsed.providerId}?enablejsapi=1&rel=0`,
      externalUrl:
        parsed.externalUrl ?? `https://music.youtube.com/watch?v=${parsed.providerId}`,
      listenedSeconds: parsed.listenedSeconds,
    });
    sendSuccess(res, { entry }, 201);
  } catch (err) {
    next(err);
  }
}

export async function clearHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const deletedCount = await db.clearHistoryByUser(req.user._id);
    sendSuccess(res, { cleared: true, deletedCount });
  } catch (err) {
    next(err);
  }
}
