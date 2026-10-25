import { Router } from 'express';
import {
  getMe,
  login,
  logout,
  register,
} from '../controllers/authController';
import {
  getPreferences,
  updatePreferences,
  updateProfile,
} from '../controllers/userController';
import { getTrackDetails, searchMusic } from '../controllers/searchController';
import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  listPlaylists,
  removeTrackFromPlaylist,
  updatePlaylist,
} from '../controllers/playlistController';
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from '../controllers/favoriteController';
import {
  clearHistory,
  listHistory,
  recordHistory,
} from '../controllers/historyController';
import {
  getAdminOverview,
  updateUserStatus,
} from '../controllers/adminController';
import { optionalAuth, requireAdmin, requireAuth } from '../middleware/auth';
import {
  apiRateLimiter,
  authRateLimiter,
  searchRateLimiter,
} from '../middleware/rateLimiter';
import { db } from '../config/database';
import { musicProviderAdapter } from '../services/musicProviderAdapter';
import { sendSuccess } from '../utils/apiResponse';

export const apiRouter = Router();

apiRouter.use(apiRateLimiter);

// Health check
apiRouter.get('/health', async (_req, res, next) => {
  try {
    const providerHealth = await musicProviderAdapter.checkHealth();
    const dbStatus = db.getStatus();
    sendSuccess(res, {
      status: 'ok',
      service: 'vibeflow-backend',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      musicProvider: providerHealth,
    });
  } catch (err) {
    next(err);
  }
});

// Authentication routes (/api/auth)
apiRouter.post('/auth/register', authRateLimiter, register);
apiRouter.post('/auth/login', authRateLimiter, login);
apiRouter.post('/auth/logout', optionalAuth, logout);
apiRouter.get('/auth/me', optionalAuth, getMe);

// User account & music preferences routes (/api/users)
apiRouter.patch('/users/me', requireAuth, updateProfile);
apiRouter.get('/users/preferences', requireAuth, getPreferences);
apiRouter.put('/users/preferences', requireAuth, updatePreferences);
apiRouter.patch('/users/preferences', requireAuth, updatePreferences);

// Music discovery & search routes (/api/search) — public discovery with rate limiting
apiRouter.get('/search', searchRateLimiter, searchMusic);
apiRouter.get('/search/tracks/:providerId', searchRateLimiter, getTrackDetails);

// Playlists routes (/api/playlists) — strictly authenticated & owner-isolated
apiRouter.get('/playlists', requireAuth, listPlaylists);
apiRouter.post('/playlists', requireAuth, createPlaylist);
apiRouter.get('/playlists/:id', requireAuth, getPlaylistById);
apiRouter.patch('/playlists/:id', requireAuth, updatePlaylist);
apiRouter.delete('/playlists/:id', requireAuth, deletePlaylist);
apiRouter.post('/playlists/:id/tracks', requireAuth, addTrackToPlaylist);
apiRouter.delete('/playlists/:id/tracks/:providerId', requireAuth, removeTrackFromPlaylist);

// Favorites routes (/api/favorites) — strictly authenticated
apiRouter.get('/favorites', requireAuth, listFavorites);
apiRouter.post('/favorites', requireAuth, addFavorite);
apiRouter.delete('/favorites/:providerId', requireAuth, removeFavorite);

// Listening history routes (/api/history) — strictly authenticated
apiRouter.get('/history', requireAuth, listHistory);
apiRouter.post('/history', requireAuth, recordHistory);
apiRouter.delete('/history', requireAuth, clearHistory);

// Administrator routes (/api/admin) — strictly enforced on server
apiRouter.get('/admin/overview', requireAuth, requireAdmin, getAdminOverview);
apiRouter.patch('/admin/users/:id/status', requireAuth, requireAdmin, updateUserStatus);
