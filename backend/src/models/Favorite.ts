import mongoose, { Document, Schema } from 'mongoose';

export interface IFavorite {
  _id: string;
  userId: string;
  providerId: string;
  title: string;
  artistName: string;
  albumName?: string | null;
  durationSeconds?: number | null;
  durationFormatted?: string | null;
  thumbnailUrl?: string | null;
  playbackType: 'YOUTUBE_EMBED';
  embedUrl: string;
  externalUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFavoriteDocument extends Omit<IFavorite, '_id'>, Document {}

const favoriteSchema = new Schema<IFavoriteDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    artistName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    albumName: {
      type: String,
      default: null,
      maxlength: 200,
    },
    durationSeconds: {
      type: Number,
      default: null,
      min: 0,
    },
    durationFormatted: {
      type: String,
      default: '0:00',
      maxlength: 20,
    },
    thumbnailUrl: {
      type: String,
      default: null,
      maxlength: 500,
    },
    playbackType: {
      type: String,
      enum: ['YOUTUBE_EMBED'],
      default: 'YOUTUBE_EMBED',
    },
    embedUrl: {
      type: String,
      required: true,
      maxlength: 500,
    },
    externalUrl: {
      type: String,
      required: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index prevents duplicate favorite tracks per user
favoriteSchema.index({ userId: 1, providerId: 1 }, { unique: true });

export const FavoriteModel =
  mongoose.models.Favorite || mongoose.model<IFavoriteDocument>('Favorite', favoriteSchema);
