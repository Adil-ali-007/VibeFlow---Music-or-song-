import { NextFunction, Request, Response } from 'express';
import { musicProviderAdapter } from '../services/musicProviderAdapter';
import { AppError, sendSuccess } from '../utils/apiResponse';
import { searchQuerySchema } from '../validators/schemas';

export async function searchMusic(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = searchQuerySchema.parse(req.query);
    const data = await musicProviderAdapter.search(parsed.q, parsed.filter, parsed.limit);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getTrackDetails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const providerId = (req.params.providerId || '').trim();
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(providerId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid track provider identifier.');
    }
    const track = await musicProviderAdapter.getTrack(providerId);
    sendSuccess(res, { track });
  } catch (err) {
    next(err);
  }
}
