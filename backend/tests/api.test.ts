import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiApp } from '../src/app';
import { db } from '../src/config/database';
import { env, validateProductionEnv } from '../src/config/env';
import { musicProviderAdapter } from '../src/services/musicProviderAdapter';
import { AppError } from '../src/utils/apiResponse';

const app = createApiApp();

describe('VibeFlow Backend API Integration & Security Suite', () => {
  beforeAll(async () => {
    await db.connect();
  });

  beforeEach(async () => {
    await db.clearAllForTests();
    vi.restoreAllMocks();
  });

  it('1. confirms no Google OAuth routes remain active (/api/auth/google/* returns 404)', async () => {
    const googleEndpoints = [
      () => request(app).get('/api/auth/google/config'),
      () => request(app).get('/api/auth/google/url'),
      () => request(app).get('/api/auth/google/callback'),
      () => request(app).post('/api/auth/google/verify').send({ idToken: 'test' }),
      () => request(app).post('/api/auth/google/link').send({ idToken: 'test' }),
    ];

    for (const callEndpoint of googleEndpoints) {
      const res = await callEndpoint();
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('API_ROUTE_NOT_FOUND');
    }
  });

  it('2. starts a first-time visitor as logged-out guest and never auto-creates a default user', async () => {
    const meRes = await request(app).get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.authenticated).toBe(false);
    expect(meRes.body.data.user).toBeNull();

    const counts = await db.getSystemCounts();
    expect(counts.users).toBe(0);
  });

  it('3. rejects unauthenticated requests to all protected endpoints with 401 UNAUTHORIZED', async () => {
    const endpoints = [
      () => request(app).get('/api/playlists'),
      () => request(app).post('/api/playlists').send({ name: 'Unauthorized Mix' }),
      () => request(app).get('/api/favorites'),
      () => request(app).get('/api/history'),
      () => request(app).patch('/api/users/me').send({ displayName: 'Hacker' }),
      () => request(app).get('/api/users/preferences'),
      () =>
        request(app)
          .put('/api/users/preferences')
          .send({ musicPreferences: ['lofi', 'pop', 'rock'] }),
      () => request(app).get('/api/admin/overview'),
    ];

    for (const callEndpoint of endpoints) {
      const res = await callEndpoint();
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('4. registers a user with bcrypt password hashing, blocks plaintext persistence, and blocks role escalation', async () => {
    const escalationAttempt = await request(app).post('/api/auth/register').send({
      email: 'escalate@vibeflow.test',
      displayName: 'Escalation User',
      password: 'Password123!',
      role: 'admin',
    });
    expect(escalationAttempt.status).toBe(400);
    expect(escalationAttempt.body.error.code).toBe('VALIDATION_ERROR');

    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'listener@vibeflow.test',
      displayName: 'Alex Listener',
      password: 'Password123!',
    });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data.user.email).toBe('listener@vibeflow.test');
    expect(registerRes.body.data.user.role).toBe('user');
    expect(registerRes.body.data.user.authProviders).toEqual(['local']);
    expect(registerRes.body.data.user.passwordHash).toBeUndefined();

    const storedRecord = await db.findUserByEmail('listener@vibeflow.test', true);
    expect(storedRecord).not.toBeNull();
    expect(storedRecord?.passwordHash).toBeDefined();
    expect(storedRecord?.passwordHash).not.toBe('Password123!');
    expect(storedRecord?.passwordHash?.startsWith('$2')).toBe(true);
  });

  it('5. rejects duplicate email registration with 409 DUPLICATE_ACCOUNT', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'dup@vibeflow.test',
      displayName: 'First User',
      password: 'Password123!',
    });

    const dupRes = await request(app).post('/api/auth/register').send({
      email: 'DUP@vibeflow.test',
      displayName: 'Second User',
      password: 'Password123!',
    });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('DUPLICATE_ACCOUNT');
  });

  it('6. rejects invalid login credentials or unknown accounts and creates legitimate session on valid login', async () => {
    // Unknown email must NOT auto-create a user
    const unknownRes = await request(app).post('/api/auth/login').send({
      email: 'ghost@vibeflow.test',
      password: 'Password123!',
    });
    expect(unknownRes.status).toBe(401);
    expect(unknownRes.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(await db.findUserByEmail('ghost@vibeflow.test')).toBeNull();

    // NoSQL operator injection payload must be stripped and rejected
    const injectionRes = await request(app).post('/api/auth/login').send({
      email: { $ne: null },
      password: { $gt: '' },
    });
    expect(injectionRes.status).toBe(400);
    expect(injectionRes.body.error.code).toBe('VALIDATION_ERROR');

    await request(app).post('/api/auth/register').send({
      email: 'login@vibeflow.test',
      displayName: 'Login User',
      password: 'ValidPassword99',
    });

    const badRes = await request(app).post('/api/auth/login').send({
      email: 'login@vibeflow.test',
      password: 'WrongPassword99',
    });
    expect(badRes.status).toBe(401);
    expect(badRes.body.error.code).toBe('INVALID_CREDENTIALS');

    const goodRes = await request(app).post('/api/auth/login').send({
      email: 'login@vibeflow.test',
      password: 'ValidPassword99',
    });
    expect(goodRes.status).toBe(200);
    const cookies = goodRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('vibeflow_session=');
    expect(cookies[0]).toContain('HttpOnly');
  });

  it('7. invalidates session on logout and rejects expired, forged, or revoked tokens', async () => {
    const agent = request.agent(app);
    const regRes = await agent.post('/api/auth/register').send({
      email: 'session@vibeflow.test',
      displayName: 'Session Tester',
      password: 'Password123!',
    });
    expect(regRes.status).toBe(201);
    const issuedToken: string = regRes.body.data.token;

    // Authenticated access works before logout
    const beforeLogout = await agent.get('/api/playlists');
    expect(beforeLogout.status).toBe(200);

    // Logout increments tokenVersion on the server and clears cookie
    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    // Subsequent agent request is rejected
    const afterLogout = await agent.get('/api/playlists');
    expect(afterLogout.status).toBe(401);

    // Replaying the previously issued Bearer token is rejected with SESSION_REVOKED
    const replayRes = await request(app)
      .get('/api/playlists')
      .set('Authorization', `Bearer ${issuedToken}`);
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('SESSION_REVOKED');

    // Forged or expired JWT is rejected with SESSION_EXPIRED
    const expiredToken = jwt.sign(
      { sub: regRes.body.data.user.id, role: 'user', tokenVersion: 1 },
      env.JWT_SECRET,
      { expiresIn: -10, issuer: 'vibeflow-api', audience: 'vibeflow-client' }
    );
    const expiredRes = await request(app)
      .get('/api/playlists')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('8. prevents cross-user playlist access and mutation (ownership isolation)', async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    await agentA.post('/api/auth/register').send({
      email: 'usera@vibeflow.test',
      displayName: 'User A',
      password: 'Password123!',
    });

    await agentB.post('/api/auth/register').send({
      email: 'userb@vibeflow.test',
      displayName: 'User B',
      password: 'Password123!',
    });

    const createRes = await agentA.post('/api/playlists').send({
      name: 'User A Private Mix',
      description: 'Strictly private',
    });
    expect(createRes.status).toBe(201);
    const playlistId = createRes.body.data.playlist._id;

    // User B attempts to read, update, or delete User A's playlist
    const readRes = await agentB.get(`/api/playlists/${playlistId}`);
    expect(readRes.status).toBe(403);
    expect(readRes.body.error.code).toBe('FORBIDDEN_NOT_OWNER');

    const updateRes = await agentB.patch(`/api/playlists/${playlistId}`).send({
      name: 'Hijacked Playlist',
    });
    expect(updateRes.status).toBe(403);

    const deleteRes = await agentB.delete(`/api/playlists/${playlistId}`);
    expect(deleteRes.status).toBe(403);
  });

  it('9. deduplicates favorites per user and enforces listening history privacy', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({
      email: 'fav@vibeflow.test',
      displayName: 'Fav Tester',
      password: 'Password123!',
    });

    const sampleTrack = {
      providerId: 'dQw4w9WgXcQ',
      title: 'Digital Love',
      artistName: 'Daft Punk',
      albumName: 'Discovery',
      durationSeconds: 301,
      durationFormatted: '5:01',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      playbackType: 'YOUTUBE_EMBED' as const,
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      externalUrl: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    };

    const fav1 = await agent.post('/api/favorites').send(sampleTrack);
    expect(fav1.status).toBe(201);

    const favDup = await agent.post('/api/favorites').send(sampleTrack);
    expect(favDup.status).toBe(409);
    expect(favDup.body.error.code).toBe('DUPLICATE_FAVORITE');

    const hist = await agent.post('/api/history').send({
      ...sampleTrack,
      listenedSeconds: 120,
    });
    expect(hist.status).toBe(201);

    const histList = await agent.get('/api/history');
    expect(histList.status).toBe(200);
    expect(histList.body.data.history).toHaveLength(1);
  });

  it('10. enforces RBAC on /api/admin/* and blocks non-admin access', async () => {
    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/register').send({
      email: 'normal@vibeflow.test',
      displayName: 'Normal User',
      password: 'Password123!',
    });

    const deniedRes = await userAgent.get('/api/admin/overview');
    expect(deniedRes.status).toBe(403);
    expect(deniedRes.body.error.code).toBe('FORBIDDEN_ADMIN_ONLY');

    const adminUser = await db.createUser({
      email: 'admin@vibeflow.test',
      displayName: 'Site Admin',
      passwordHash: '$2a$12$dummyUnusedBecauseWeSignTokenDirectly',
      authProviders: ['local'],
      role: 'admin',
    });

    const adminToken = jwt.sign(
      { sub: adminUser._id, role: 'admin', tokenVersion: 0 },
      env.JWT_SECRET,
      { expiresIn: '1h', issuer: 'vibeflow-api', audience: 'vibeflow-client' }
    );

    const adminOverviewRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminOverviewRes.status).toBe(200);
    expect(adminOverviewRes.body.data.counts.admins).toBe(1);
  });

  it('11. fails safely when required production secrets or MongoDB URI are missing', () => {
    expect(() =>
      validateProductionEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'too-short',
        MONGODB_URI: 'mongodb+srv://cluster.example.com/vibeflow',
        FRONTEND_URL: 'https://vibeflow.example.com',
      })
    ).toThrow(/JWT_SECRET must be explicitly set/i);

    expect(() =>
      validateProductionEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'a-very-strong-production-jwt-secret-key-at-least-32-chars',
        MONGODB_URI: '',
        FRONTEND_URL: 'https://vibeflow.example.com',
      })
    ).toThrow(/MONGODB_URI must be explicitly configured/i);

    expect(() =>
      validateProductionEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'a-very-strong-production-jwt-secret-key-at-least-32-chars',
        MONGODB_URI: 'mongodb+srv://cluster.example.com/vibeflow',
        FRONTEND_URL: 'https://vibeflow.example.com',
      })
    ).not.toThrow();
  });

  it('12. validates and proxies /api/search requests and handles provider outages without fake data', async () => {
    const emptyQueryRes = await request(app).get('/api/search?q=');
    expect(emptyQueryRes.status).toBe(400);
    expect(emptyQueryRes.body.error.code).toBe('VALIDATION_ERROR');

    vi.spyOn(musicProviderAdapter, 'search').mockResolvedValueOnce({
      query: 'Daft Punk',
      filter: 'songs',
      tracks: [
        {
          providerId: 'FGBhQbmPwH8',
          title: 'One More Time',
          artistName: 'Daft Punk',
          artists: [{ id: 'UC_daft', name: 'Daft Punk' }],
          album: { id: 'MPREb_disc', name: 'Discovery' },
          durationSeconds: 320,
          durationFormatted: '5:20',
          thumbnailUrl: 'https://i.ytimg.com/vi/FGBhQbmPwH8/hqdefault.jpg',
          isExplicit: false,
          playbackType: 'YOUTUBE_EMBED',
          embedUrl: 'https://www.youtube.com/embed/FGBhQbmPwH8?enablejsapi=1',
          externalUrl: 'https://music.youtube.com/watch?v=FGBhQbmPwH8',
        },
      ],
      albums: [],
      artists: [],
    });

    const searchRes = await request(app).get('/api/search?q=Daft+Punk&filter=songs&limit=5');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.success).toBe(true);
    expect(searchRes.body.data.tracks).toHaveLength(1);
    expect(searchRes.body.data.tracks[0].title).toBe('One More Time');

    vi.spyOn(musicProviderAdapter, 'search').mockRejectedValueOnce(
      new AppError(
        503,
        'MUSIC_SERVICE_UNREACHABLE',
        'Music discovery microservice is currently unreachable.'
      )
    );

    const unreachableRes = await request(app).get('/api/search?q=Radiohead');
    expect(unreachableRes.status).toBe(503);
    expect(unreachableRes.body.success).toBe(false);
    expect(unreachableRes.body.error.code).toBe('MUSIC_SERVICE_UNREACHABLE');
  });

  it('13. validates, persists, and isolates user music preferences and onboarding status', async () => {
    const agent = request.agent(app);
    const regRes = await agent.post('/api/auth/register').send({
      email: 'prefs@vibeflow.test',
      displayName: 'Genre Explorer',
      password: 'Password123!',
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.user.musicPreferences).toEqual([]);
    expect(regRes.body.data.user.onboardingCompleted).toBe(false);

    const tooFewRes = await agent.put('/api/users/preferences').send({
      musicPreferences: ['lofi', 'hindi'],
    });
    expect(tooFewRes.status).toBe(400);
    expect(tooFewRes.body.error.code).toBe('VALIDATION_ERROR');

    const saveRes = await agent.put('/api/users/preferences').send({
      musicPreferences: ['lofi', 'hindi', 'punjabi'],
    });
    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.musicPreferences).toEqual(['lofi', 'hindi', 'punjabi']);
    expect(saveRes.body.data.onboardingCompleted).toBe(true);
  });
});
