import { z } from 'zod';

const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(72, 'Password cannot exceed 72 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address.')
      .max(254),
    displayName: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters.')
      .max(60, 'Display name cannot exceed 60 characters.'),
    password: passwordRule,
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Please provide a valid email address.'),
    password: z.string().min(1, 'Password is required.').max(128),
  })
  .strict();

export const ALLOWED_MUSIC_GENRES = [
  'lofi',
  'pop',
  'hip-hop',
  'rnb',
  'rock',
  'indie',
  'electronic',
  'classical',
  'jazz',
  'hindi',
  'bollywood',
  'punjabi',
  'romantic',
  'sad-songs',
  'workout',
  'chill',
  'party',
  'focus',
  'english',
  'trending',
] as const;

export const updateMusicPreferencesSchema = z
  .object({
    musicPreferences: z
      .array(z.enum(ALLOWED_MUSIC_GENRES))
      .max(20, 'Cannot select more than 20 genres.')
      .default([]),
    onboardingCompleted: z.boolean().optional().default(true),
    skip: z.boolean().optional().default(false),
  })
  .strict()
  .refine(
    (data) => {
      if (data.skip) return true;
      return data.musicPreferences.length >= 3;
    },
    {
      message: 'Please select at least 3 genres to personalize your VibeFlow experience.',
      path: ['musicPreferences'],
    }
  );

export const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters.')
      .max(60, 'Display name cannot exceed 60 characters.')
      .optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: passwordRule.optional(),
    musicPreferences: z.array(z.enum(ALLOWED_MUSIC_GENRES)).max(20).optional(),
    onboardingCompleted: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) {
        return false;
      }
      return true;
    },
    {
      message: 'Current password is required when setting a new password.',
      path: ['currentPassword'],
    }
  );

export const trackInputSchema = z.object({
  providerId: z
    .string()
    .trim()
    .min(3, 'Track providerId is required.')
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid track providerId format.'),
  title: z.string().trim().min(1, 'Track title is required.').max(200),
  artistName: z.string().trim().min(1, 'Artist name is required.').max(200),
  albumName: z.string().trim().max(200).nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  durationFormatted: z.string().trim().max(20).nullable().optional(),
  thumbnailUrl: z.string().url().max(500).nullable().optional(),
  playbackType: z.literal('YOUTUBE_EMBED').default('YOUTUBE_EMBED'),
  embedUrl: z.string().url().max(500).optional(),
  externalUrl: z.string().url().max(500).optional(),
});

export const createPlaylistSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Playlist name is required.')
      .max(80, 'Playlist name cannot exceed 80 characters.'),
    description: z
      .string()
      .trim()
      .max(300, 'Description cannot exceed 300 characters.')
      .optional()
      .default(''),
  })
  .strict();

export const updatePlaylistSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Playlist name cannot be empty.')
      .max(80, 'Playlist name cannot exceed 80 characters.')
      .optional(),
    description: z
      .string()
      .trim()
      .max(300, 'Description cannot exceed 300 characters.')
      .optional(),
  })
  .strict();

export const recordHistorySchema = trackInputSchema.extend({
  listenedSeconds: z
    .number()
    .min(5, 'A listening history event requires at least 5 seconds of actual playback.'),
});

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Search query parameter "q" cannot be empty.')
    .max(120, 'Search query cannot exceed 120 characters.'),
  filter: z.enum(['songs', 'albums', 'artists', 'all']).optional().default('songs'),
  limit: z.coerce.number().int().min(1).max(30).optional().default(15),
});

export const adminUpdateUserStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();
