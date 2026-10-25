import mongoose, { Document, Schema } from 'mongoose';

export interface IEmbeddedTrack {
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
  addedAt: Date;
}

export interface IPlaylist {
  _id: string;
  ownerId: string;
  name: string;
  description: string;
  tracks: IEmbeddedTrack[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPlaylistDocument extends Omit<IPlaylist, '_id'>, Document {}

const embeddedTrackSchema = new Schema<IEmbeddedTrack>(
  {
    providerId: { type: String, required: true, trim: true, maxlength: 64 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    artistName: { type: String, required: true, trim: true, maxlength: 200 },
    albumName: { type: String, default: null, maxlength: 200 },
    durationSeconds: { type: Number, default: null, min: 0 },
    durationFormatted: { type: String, default: '0:00', maxlength: 20 },
    thumbnailUrl: { type: String, default: null, maxlength: 500 },
    playbackType: { type: String, enum: ['YOUTUBE_EMBED'], default: 'YOUTUBE_EMBED' },
    embedUrl: { type: String, required: true, maxlength: 500 },
    externalUrl: { type: String, required: true, maxlength: 500 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const playlistSchema = new Schema<IPlaylistDocument>(
  {
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Playlist name is required'],
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    tracks: {
      type: [embeddedTrackSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

playlistSchema.index({ ownerId: 1, updatedAt: -1 });

export const PlaylistModel =
  mongoose.models.Playlist || mongoose.model<IPlaylistDocument>('Playlist', playlistSchema);
