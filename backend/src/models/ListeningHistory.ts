import mongoose, { Document, Schema } from 'mongoose';

export interface IListeningHistory {
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
  listenedSeconds: number;
  playedAt: Date;
}

export interface IListeningHistoryDocument extends Omit<IListeningHistory, '_id'>, Document {}

const listeningHistorySchema = new Schema<IListeningHistoryDocument>(
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
    listenedSeconds: {
      type: Number,
      required: true,
      min: [5, 'Playback event requires at least 5 seconds of actual playback'],
    },
    playedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

listeningHistorySchema.index({ userId: 1, playedAt: -1 });

export const ListeningHistoryModel =
  mongoose.models.ListeningHistory ||
  mongoose.model<IListeningHistoryDocument>('ListeningHistory', listeningHistorySchema);
