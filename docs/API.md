# REST API Reference — VibeFlow

All API endpoints are mounted under `/api` and return a consistent JSON envelope:

- **Success**: `{ "success": true, "data": { ... } }`
- **Error**: `{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable explanation" } }`

---

## 1. Health (`/api/health`)

- **`GET /api/health`** (Public)
  - Returns backend, database, and Python `music-service` health status.

---

## 2. Authentication (`/api/auth`)

- **`POST /api/auth/register`** (Public, Rate-Limited)
  - Body: `{ "email": "user@example.com", "displayName": "Alex", "password": "Password123" }`
  - Side Effects: Hashes password with bcrypt (12 rounds), creates ordinary user (`role: "user"`), sets `vibeflow_session` `HttpOnly` cookie.
  - Status: `201 Created`, `400 VALIDATION_ERROR`, `409 DUPLICATE_ACCOUNT`.
- **`POST /api/auth/login`** (Public, Rate-Limited)
  - Body: `{ "email": "user@example.com", "password": "Password123" }`
  - Status: `200 OK`, `401 INVALID_CREDENTIALS`, `403 ACCOUNT_SUSPENDED`.
- **`POST /api/auth/logout`** (`optionalAuth`)
  - Side Effects: Increments `user.tokenVersion` in database to revoke the session token server-side and clears `vibeflow_session` cookie.
- **`GET /api/auth/me`** (`optionalAuth`)
  - Returns `{ "authenticated": boolean, "user": User | null }`.

---

## 3. User Profile & Music Preferences (`/api/users`)

- **`PATCH /api/users/me`** (`requireAuth`)
  - Body: `{ "displayName"?: "New Name", "currentPassword"?: "...", "newPassword"?: "..." }` (strictly rejects unknown fields).
- **`GET /api/users/preferences`** (`requireAuth`)
- **`PUT /api/users/preferences`** (`requireAuth`)

---

## 4. Music Search (`/api/search`)

- **`GET /api/search?q=<query>&filter=<songs|albums|artists|all>&limit=<1..30>`** (Public, Rate-Limited)
- **`GET /api/search/tracks/:providerId`** (Public, Rate-Limited)

---

## 5. Playlists (`/api/playlists`)

- **`GET /api/playlists`** (`requireAuth`) — Lists caller's playlists.
- **`POST /api/playlists`** (`requireAuth`) — Body: `{ "name": "Focus", "description": "..." }`.
- **`GET /api/playlists/:id`** (`requireAuth` + Owner Check) — Returns `403 FORBIDDEN_NOT_OWNER` if not owned by caller.
- **`PATCH /api/playlists/:id`** (`requireAuth` + Owner Check)
- **`DELETE /api/playlists/:id`** (`requireAuth` + Owner Check)
- **`POST /api/playlists/:id/tracks`** (`requireAuth` + Owner Check) — Adds normalized track metadata; returns `409 DUPLICATE_PLAYLIST_TRACK` if already in playlist.
- **`DELETE /api/playlists/:id/tracks/:providerId`** (`requireAuth` + Owner Check)

---

## 6. Favorites (`/api/favorites`)

- **`GET /api/favorites`** (`requireAuth`)
- **`POST /api/favorites`** (`requireAuth`) — Saves track; returns `409 DUPLICATE_FAVORITE` if already liked.
- **`DELETE /api/favorites/:providerId`** (`requireAuth`)

---

## 7. Listening History (`/api/history`)

- **`GET /api/history`** (`requireAuth`)
- **`POST /api/history`** (`requireAuth`) — Requires `listenedSeconds >= 5`.
- **`DELETE /api/history`** (`requireAuth`) — Clears caller's listening history.

---

## 8. Administrator (`/api/admin`)

- **`GET /api/admin/overview`** (`requireAuth` + `requireAdmin`)
- **`PATCH /api/admin/users/:id/status`** (`requireAuth` + `requireAdmin`) — Body: `{ "isActive": boolean }`.
