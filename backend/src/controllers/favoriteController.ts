import { NextFunction, Request, Response } from 'express';
import { db } from '../config/database';
import { AppError, sendSuccess } from '../utils/apiResponse';
import { trackInputSchema } from '../validators/schemas';

export async function listFavorites(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const favorites = await db.listFavoritesByUser(req.user._id);
    sendSuccess(res, { favorites });
  } catch (err) {
    next(err);
  }
}

export async function addFavorite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const track = trackInputSchema.parse(req.body);
    const favorite = await db.addFavorite(req.user._id, {
      providerId: track.providerId,
      title: track.title,
      artistName: track.artistName,
      albumName: track.albumName ?? null,
      durationSeconds: track.durationSeconds ?? null,
      durationFormatted: track.durationFormatted ?? '0:00',
      thumbnailUrl:
        track.thumbnailUrl ?? `https://i.ytimg.com/vi/${track.providerId}/hqdefault.jpg`,
      playbackType: 'YOUTUBE_EMBED',
      embedUrl:
        track.embedUrl ??
        `https://www.youtube.com/embed/${track.providerId}?enablejsapi=1&rel=0`,
      externalUrl:
        track.externalUrl ?? `https://music.youtube.com/watch?v=${track.providerId}`,
    });
    sendSuccess(res, { favorite }, 201);
  } catch (err) {
    next(err);
  }
}

export async function removeFavorite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const providerId = (req.params.providerId || '').trim();
    const removed = await db.removeFavorite(req.user._id, providerId);
    if (!removed) {
      throw new AppError(404, 'FAVORITE_NOT_FOUND', 'Track is not in your Liked Songs.');
    }
    sendSuccess(res, { removed: true });
  } catch (err) {
    next(err);
  }
}
