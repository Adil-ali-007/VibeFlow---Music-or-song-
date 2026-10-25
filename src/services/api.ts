import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AdminOverviewData,
  FavoriteItem,
  HistoryItem,
  Playlist,
  SearchResultData,
  Track,
  User,
} from '../types';

export type ErrorCategory =
  | 'TIMEOUT'
  | 'SERVICE_UNREACHABLE'
  | 'PROVIDER_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

const SESSION_TOKEN_STORAGE_KEY = 'vibeflow_session_token';
let memorySessionToken: string | null = null;

export function getStoredSessionToken(): string | null {
  if (memorySessionToken) return memorySessionToken;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      memorySessionToken = window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
      return memorySessionToken;
    } catch {
      return null;
    }
  }
  return null;
}

export function setStoredSessionToken(token: string | null): void {
  memorySessionToken = token;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (token) {
        window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota/iframe privacy errors
    }
  }
}

/**
 * Resolves the API base URL across unified full-stack mode (port 3000),
 * standalone Vite mode (port 5173 with proxy), and remote Cloud Run deployments.
 */
export function resolveApiBaseUrl(rawEnvUrl?: string): string {
  const configured = (rawEnvUrl ?? import.meta.env.VITE_API_URL ?? '').trim();
  if (!configured || configured === '/api') {
    return '/api';
  }

  const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured);

  if (typeof window !== 'undefined' && window.location) {
    const browserHost = window.location.hostname;
    const browserPort = window.location.port;
    const isBrowserLocal = browserHost === 'localhost' || browserHost === '127.0.0.1';

    // Remote browser (e.g. *.run.app) can never connect to container's localhost
    if (!isBrowserLocal && isLocalTarget) {
      return '/api';
    }

    // Unified full-stack dev/prod server on port 3000 or Vite proxy on 5173 serves /api on same origin
    if (isBrowserLocal && (browserPort === '3000' || browserPort === '5173') && isLocalTarget) {
      return '/api';
    }
  }

  const trimmed = configured.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

const baseURL = resolveApiBaseUrl();

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 12000,
});

// Attach Bearer token fallback for cross-origin iframe environments where third-party cookies are blocked
apiClient.interceptors.request.use((config) => {
  const token = getStoredSessionToken();
  if (token && config.headers && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatic fallback to same-origin '/api' if a custom baseURL fails with network error,
// and automatic session cleanup when a 401 response indicates an expired/revoked session.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: { code?: string; message?: string } }>) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retriedSameOrigin?: boolean }) | undefined;
    if (
      config &&
      !config._retriedSameOrigin &&
      config.baseURL &&
      config.baseURL !== '/api' &&
      !error.response &&
      error.code !== 'ECONNABORTED' &&
      error.code !== 'ERR_CANCELED'
    ) {
      config._retriedSameOrigin = true;
      config.baseURL = '/api';
      return apiClient.request(config);
    }

    const status = error.response?.status;
    const url = config?.url || '';
    const isAuthAttempt =
      url.includes('/auth/login') ||
      url.includes('/auth/register');

    if (status === 401 && !isAuthAttempt) {
      setStoredSessionToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vibeflow:session-expired'));
      }
    }

    return Promise.reject(error);
  }
);

export function extractErrorCategory(err: unknown): ErrorCategory {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<{ error?: { message?: string; code?: string } }>;
    const code = axiosErr.response?.data?.error?.code;
    const status = axiosErr.response?.status;

    if (axiosErr.code === 'ECONNABORTED' || status === 504 || code === 'PROVIDER_TIMEOUT') {
      return 'TIMEOUT';
    }
    if (status === 503 || code === 'MUSIC_SERVICE_UNREACHABLE') {
      return 'SERVICE_UNREACHABLE';
    }
    if (
      status === 502 ||
      code === 'PROVIDER_UNAVAILABLE' ||
      code === 'MUSIC_SERVICE_AUTH_ERROR' ||
      code === 'INVALID_PROVIDER_RESPONSE'
    ) {
      return 'PROVIDER_UNAVAILABLE';
    }
    if (status === 400 || code === 'VALIDATION_ERROR') {
      return 'VALIDATION_ERROR';
    }
    if (!axiosErr.response && (axiosErr.code === 'ERR_NETWORK' || axiosErr.message === 'Network Error')) {
      return 'NETWORK_ERROR';
    }
  }
  return 'UNKNOWN';
}

export function extractErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<{ error?: { message?: string; code?: string } }>;
    const status = axiosErr.response?.status;
    const code = axiosErr.response?.data?.error?.code;
    const rawMsg = axiosErr.response?.data?.error?.message;

    if (
      axiosErr.code === 'ECONNABORTED' ||
      status === 504 ||
      code === 'PROVIDER_TIMEOUT' ||
      code === 'MUSIC_PROVIDER_TIMEOUT'
    ) {
      return 'Music is temporarily unavailable. Please try again.';
    }
    if (
      code === 'MUSIC_SERVICE_UNREACHABLE' ||
      code === 'PROVIDER_UNAVAILABLE' ||
      code === 'MUSIC_PROVIDER_ERROR'
    ) {
      return 'Music is temporarily unavailable. Please try again.';
    }
    if (rawMsg) {
      if (
        /microservice|ytmusicapi|python|upstream|cors|127\.0\.0\.1|localhost|discovery service|music provider|unreachable/i.test(
          rawMsg
        )
      ) {
        return 'Music is temporarily unavailable. Please try again.';
      }
      return rawMsg;
    }
    if (status === 503 || status === 502) {
      return 'Music is temporarily unavailable. Please try again.';
    }
    if (!axiosErr.response && (axiosErr.code === 'ERR_NETWORK' || axiosErr.message === 'Network Error')) {
      return 'Connection lost. Please check your network and try again.';
    }
    if (status) {
      return fallback;
    }
  }
  if (err instanceof Error) {
    if (
      /microservice|ytmusicapi|python|upstream|discovery service|music provider|unreachable/i.test(
        err.message
      )
    ) {
      return 'Music is temporarily unavailable. Please try again.';
    }
    return err.message;
  }
  return fallback;
}

export function extractErrorCode(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<{ error?: { code?: string } }>;
    return axiosErr.response?.data?.error?.code || null;
  }
  return null;
}

export const authApi = {
  async register(payload: { email: string; displayName: string; password: string }): Promise<User> {
    const res = await apiClient.post('/auth/register', payload);
    if (res.data?.data?.token) {
      setStoredSessionToken(res.data.data.token);
    }
    return res.data.data.user;
  },
  async login(payload: { email: string; password: string }): Promise<User> {
    const res = await apiClient.post('/auth/login', payload);
    if (res.data?.data?.token) {
      setStoredSessionToken(res.data.data.token);
    }
    return res.data.data.user;
  },
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setStoredSessionToken(null);
    }
  },
  async getMe(): Promise<User> {
    const res = await apiClient.get('/auth/me');
    if (!res.data?.success || !res.data?.data?.authenticated || !res.data?.data?.user) {
      setStoredSessionToken(null);
      throw new Error('Not authenticated');
    }
    return res.data.data.user;
  },
  async updateProfile(payload: {
    displayName?: string;
    currentPassword?: string;
    newPassword?: string;
    musicPreferences?: string[];
    onboardingCompleted?: boolean;
  }): Promise<User> {
    const res = await apiClient.patch('/users/me', payload);
    return res.data.data.user;
  },
  async getPreferences(): Promise<{
    musicPreferences: string[];
    onboardingCompleted: boolean;
    user: User;
  }> {
    const res = await apiClient.get('/users/preferences');
    return res.data.data;
  },
  async updatePreferences(payload: {
    musicPreferences: string[];
    onboardingCompleted?: boolean;
    skip?: boolean;
  }): Promise<{
    musicPreferences: string[];
    onboardingCompleted: boolean;
    user: User;
  }> {
    const res = await apiClient.put('/users/preferences', payload);
    return res.data.data;
  },
};

export const musicApi = {
  async search(
    q: string,
    filter: 'songs' | 'albums' | 'artists' | 'all' = 'songs',
    limit = 15,
    signal?: AbortSignal
  ): Promise<SearchResultData> {
    const res = await apiClient.get('/search', {
      params: { q, filter, limit },
      ...(signal ? { signal } : {}),
    });
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.error?.message || 'Music search provider is unavailable.');
    }
    const d = res.data.data;
    return {
      query: d.query || q,
      filter: d.filter || filter,
      tracks: Array.isArray(d.tracks) ? d.tracks : [],
      albums: Array.isArray(d.albums) ? d.albums : [],
      artists: Array.isArray(d.artists) ? d.artists : [],
    };
  },
  async getTrack(providerId: string): Promise<Track> {
    const res = await apiClient.get(`/search/tracks/${encodeURIComponent(providerId)}`);
    if (!res.data?.success || !res.data?.data?.track) {
      throw new Error(res.data?.error?.message || 'Track details could not be loaded.');
    }
    return res.data.data.track;
  },
};

export const playlistApi = {
  async list(): Promise<Playlist[]> {
    const res = await apiClient.get('/playlists');
    return Array.isArray(res.data?.data?.playlists) ? res.data.data.playlists : [];
  },
  async getById(id: string): Promise<Playlist> {
    const res = await apiClient.get(`/playlists/${encodeURIComponent(id)}`);
    if (!res.data?.success || !res.data?.data?.playlist) {
      throw new Error('Playlist not found.');
    }
    return res.data.data.playlist;
  },
  async create(payload: { name: string; description?: string }): Promise<Playlist> {
    const res = await apiClient.post('/playlists', payload);
    return res.data.data.playlist;
  },
  async update(id: string, payload: { name?: string; description?: string }): Promise<Playlist> {
    const res = await apiClient.patch(`/playlists/${encodeURIComponent(id)}`, payload);
    return res.data.data.playlist;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/playlists/${encodeURIComponent(id)}`);
  },
  async addTrack(id: string, track: Track): Promise<Playlist> {
    const res = await apiClient.post(`/playlists/${encodeURIComponent(id)}/tracks`, {
      providerId: track.providerId,
      title: track.title,
      artistName: track.artistName,
      albumName: track.album?.name ?? track.albumName ?? null,
      durationSeconds: track.durationSeconds ?? null,
      durationFormatted: track.durationFormatted,
      thumbnailUrl: track.thumbnailUrl ?? null,
      playbackType: 'YOUTUBE_EMBED',
      embedUrl: track.embedUrl,
      externalUrl: track.externalUrl,
    });
    return res.data.data.playlist;
  },
  async removeTrack(id: string, providerId: string): Promise<Playlist> {
    const res = await apiClient.delete(
      `/playlists/${encodeURIComponent(id)}/tracks/${encodeURIComponent(providerId)}`
    );
    return res.data.data.playlist;
  },
};

export const favoriteApi = {
  async list(): Promise<FavoriteItem[]> {
    const res = await apiClient.get('/favorites');
    return Array.isArray(res.data?.data?.favorites) ? res.data.data.favorites : [];
  },
  async add(track: Track): Promise<FavoriteItem> {
    const res = await apiClient.post('/favorites', {
      providerId: track.providerId,
      title: track.title,
      artistName: track.artistName,
      albumName: track.album?.name ?? track.albumName ?? null,
      durationSeconds: track.durationSeconds ?? null,
      durationFormatted: track.durationFormatted,
      thumbnailUrl: track.thumbnailUrl ?? null,
      playbackType: 'YOUTUBE_EMBED',
      embedUrl: track.embedUrl,
      externalUrl: track.externalUrl,
    });
    return res.data.data.favorite;
  },
  async remove(providerId: string): Promise<void> {
    await apiClient.delete(`/favorites/${encodeURIComponent(providerId)}`);
  },
};

export const historyApi = {
  async list(): Promise<HistoryItem[]> {
    const res = await apiClient.get('/history');
    return Array.isArray(res.data?.data?.history) ? res.data.data.history : [];
  },
  async record(track: Track, listenedSeconds: number): Promise<HistoryItem> {
    const res = await apiClient.post('/history', {
      providerId: track.providerId,
      title: track.title,
      artistName: track.artistName,
      albumName: track.album?.name ?? track.albumName ?? null,
      durationSeconds: track.durationSeconds ?? null,
      durationFormatted: track.durationFormatted,
      thumbnailUrl: track.thumbnailUrl ?? null,
      playbackType: 'YOUTUBE_EMBED',
      embedUrl: track.embedUrl,
      externalUrl: track.externalUrl,
      listenedSeconds,
    });
    return res.data.data.entry;
  },
  async clear(): Promise<number> {
    const res = await apiClient.delete('/history');
    return res.data.data.deletedCount;
  },
};

export const adminApi = {
  async getOverview(): Promise<AdminOverviewData> {
    const res = await apiClient.get('/admin/overview');
    return res.data.data;
  },
  async updateUserStatus(userId: string, isActive: boolean): Promise<User> {
    const res = await apiClient.patch(`/admin/users/${encodeURIComponent(userId)}/status`, {
      isActive,
    });
    return res.data.data.user;
  },
};
