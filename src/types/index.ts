export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  authProviders: 'local'[];
  musicPreferences?: string[];
  onboardingCompleted?: boolean;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface Track {
  providerId: string;
  title: string;
  artists?: { id?: string | null; name: string }[];
  artistName: string;
  album?: { id?: string | null; name: string } | null;
  albumName?: string | null;
  durationSeconds?: number | null;
  durationFormatted: string;
  thumbnailUrl?: string | null;
  isExplicit?: boolean;
  playbackType: 'YOUTUBE_EMBED';
  embedUrl: string;
  externalUrl: string;
  viewCount?: string;
  addedAt?: string;
}

export interface AlbumSummary {
  providerId: string;
  title: string;
  artistName: string;
  year?: string | null;
  thumbnailUrl?: string | null;
  externalUrl: string;
}

export interface ArtistSummary {
  providerId: string;
  name: string;
  thumbnailUrl?: string | null;
  externalUrl: string;
}

export interface SearchResultData {
  query: string;
  filter: 'songs' | 'albums' | 'artists' | 'all';
  tracks: Track[];
  albums: AlbumSummary[];
  artists: ArtistSummary[];
}

export interface Playlist {
  _id: string;
  ownerId: string;
  name: string;
  description: string;
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteItem extends Track {
  _id: string;
  userId: string;
  createdAt: string;
}

export interface HistoryItem extends Track {
  _id: string;
  userId: string;
  listenedSeconds: number;
  playedAt: string;
}

export interface AdminOverviewData {
  counts: {
    users: number;
    admins: number;
    playlists: number;
    favorites: number;
    historyEvents: number;
  };
  services: {
    database: {
      connected: boolean;
      engine: 'mongodb' | 'mongoose-validated-local';
      uriConfigured: boolean;
    };
    musicProvider: {
      reachable: boolean;
      engine?: string;
      url: string;
    };
  };
  users: User[];
}
