import { NextFunction, Request, Response } from 'express';
import { db } from '../config/database';
import { AppError, sendSuccess } from '../utils/apiResponse';
import {
  createPlaylistSchema,
  trackInputSchema,
  updatePlaylistSchema,
} from '../validators/schemas';

export async function listPlaylists(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const playlists = await db.listPlaylistsByOwner(req.user._id);
    sendSuccess(res, { playlists });
  } catch (err) {
    next(err);
  }
}

export async function getPlaylistById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const playlist = await db.findPlaylistById(req.params.id);
    if (!playlist) {
      throw new AppError(404, 'PLAYLIST_NOT_FOUND', 'Playlist was not found.');
    }
    // Enforce strict server-side ownership check (IDOR protection)
    if (playlist.ownerId !== req.user._id) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_OWNER',
        'You do not have permission to access this playlist.'
      );
    }
    sendSuccess(res, { playlist });
  } catch (err) {
    next(err);
  }
}

export async function createPlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const parsed = createPlaylistSchema.parse(req.body);
    const playlist = await db.createPlaylist({
      ownerId: req.user._id,
      name: parsed.name,
      description: parsed.description,
    });
    sendSuccess(res, { playlist }, 201);
  } catch (err) {
    next(err);
  }
}

export async function updatePlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const parsed = updatePlaylistSchema.parse(req.body);
    const existing = await db.findPlaylistById(req.params.id);
    if (!existing) {
      throw new AppError(404, 'PLAYLIST_NOT_FOUND', 'Playlist was not found.');
    }
    if (existing.ownerId !== req.user._id) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_OWNER',
        'You do not have permission to modify this playlist.'
      );
    }

    const updated = await db.updatePlaylist(existing._id, {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
    });

    sendSuccess(res, { playlist: updated });
  } catch (err) {
    next(err);
  }
}

export async function deletePlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const existing = await db.findPlaylistById(req.params.id);
    if (!existing) {
      throw new AppError(404, 'PLAYLIST_NOT_FOUND', 'Playlist was not found.');
    }
    if (existing.ownerId !== req.user._id) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_OWNER',
        'You do not have permission to delete this playlist.'
      );
    }

    await db.deletePlaylist(existing._id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function addTrackToPlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const track = trackInputSchema.parse(req.body);
    const existing = await db.findPlaylistById(req.params.id);
    if (!existing) {
      throw new AppError(404, 'PLAYLIST_NOT_FOUND', 'Playlist was not found.');
    }
    if (existing.ownerId !== req.user._id) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_OWNER',
        'You do not have permission to modify this playlist.'
      );
    }

    if (existing.tracks.some((t) => t.providerId === track.providerId)) {
      throw new AppError(
        409,
        'DUPLICATE_PLAYLIST_TRACK',
        'This track is already in the selected playlist.'
      );
    }

    const nextTracks = [
      ...existing.tracks,
      {
        providerId: track.providerId,
        title: track.title,
        artistName: track.artistName,
        albumName: track.albumName ?? null,
        durationSeconds: track.durationSeconds ?? null,
        durationFormatted: track.durationFormatted ?? '0:00',
        thumbnailUrl:
          track.thumbnailUrl ?? `https://i.ytimg.com/vi/${track.providerId}/hqdefault.jpg`,
        playbackType: 'YOUTUBE_EMBED' as const,
        embedUrl:
          track.embedUrl ??
          `https://www.youtube.com/embed/${track.providerId}?enablejsapi=1&rel=0`,
        externalUrl:
          track.externalUrl ?? `https://music.youtube.com/watch?v=${track.providerId}`,
        addedAt: new Date(),
      },
    ];

    const updated = await db.updatePlaylist(existing._id, { tracks: nextTracks });
    sendSuccess(res, { playlist: updated }, 201);
  } catch (err) {
    next(err);
  }
}

export async function removeTrackFromPlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    const existing = await db.findPlaylistById(req.params.id);
    if (!existing) {
      throw new AppError(404, 'PLAYLIST_NOT_FOUND', 'Playlist was not found.');
    }
    if (existing.ownerId !== req.user._id) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_OWNER',
        'You do not have permission to modify this playlist.'
      );
    }

    const providerId = req.params.providerId;
    const nextTracks = existing.tracks.filter((t) => t.providerId !== providerId);
    const updated = await db.updatePlaylist(existing._id, { tracks: nextTracks });
    sendSuccess(res, { playlist: updated });
  } catch (err) {
    next(err);
  }
}
