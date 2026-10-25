# Security Design & Threat Model — VibeFlow

This document describes the security controls implemented in VibeFlow, the architectural trust boundaries, and the known limitations that require attention during production deployment.

---

## 1. Security Goals and Application Boundaries

- **Confidentiality**: Protect user credentials, session tokens, private playlists, liked songs, and listening history from unauthorized access.
- **Integrity**: Prevent privilege escalation, unauthorized playlist tampering (IDOR), and mass-assignment attacks.
- **Availability**: Protect authentication and API routes against brute-force and request flooding via rate limiting and upstream request timeouts.
- **Boundaries**:
  1. **Browser (Untrusted)**: React SPA (`src/`). Any role flags or route guards in React are strictly for UX convenience; all security decisions happen on the backend.
  2. **Express API (Policy Enforcement Point)**: `backend/src/`. Handles input validation, authentication, role authorization, ownership verification, and database operations.
  3. **Python Music Service (Internal Upstream Adapter)**: `music-service/`. Queries public YouTube Music catalog metadata (`ytmusicapi` / InnerTube). Never accesses user accounts or MongoDB.
  4. **Database (Persistence)**: MongoDB via Mongoose (`User`, `Playlist`, `Favorite`, `ListeningHistory`).

---

## 2. Threat Model and Assets to Protect

| Asset | Threat | Implemented Mitigation |
| :--- | :--- | :--- |
| Password hashes | Database leak / credential stuffing | Bcrypt with 12 salt rounds; `select: false` on Mongoose schema; rate limiting on `/api/auth/*`. |
| Session cookies | XSS theft / replay after logout | `HttpOnly` cookie attribute; `SameSite=Lax` (dev) / `None; Secure` (prod); server-side `tokenVersion` incremented on logout and password change. |
| Admin privileges | Client-side role tampering / auto-promotion | Public registration hardcodes `role: 'user'`; `npm run admin:bootstrap` refuses to promote existing ordinary accounts; `requireAdmin` verifies `req.user.role === 'admin'` from DB. |
| Private playlists & history | Insecure Direct Object Reference (IDOR) | Every playlist, favorite, and history operation verifies `resource.ownerId === req.user._id` on the server. |

---

## 3. Authentication and Session Strategy

- VibeFlow uses **HTTP-only signed JWT session cookies** (`vibeflow_session`) combined with a database-backed **`tokenVersion`** counter on each `User` document.
- Every authenticated request (`requireAuth` in `backend/src/middleware/auth.ts`) verifies the JWT signature, issuer (`vibeflow-api`), and audience (`vibeflow-client`), loads the current user from the database, verifies `user.isActive === true`, and checks `decoded.tokenVersion === user.tokenVersion`.
- When a user logs out (`POST /api/auth/logout`), changes their password (`PATCH /api/users/me`), or is suspended by an admin (`PATCH /api/admin/users/:id/status`), `tokenVersion` is incremented in the database, immediately revoking all previously issued tokens.

---

## 4. Password Handling

- Passwords are validated with Zod (`backend/src/validators/schemas.ts`): 8 to 72 characters (72-byte ceiling prevents bcrypt truncation issues), requiring at least one letter and one number.
- Passwords are hashed using `bcryptjs` with **12 salt rounds** (`backend/src/controllers/authController.ts`).
- Plaintext passwords are never logged or stored, and `passwordHash` is stripped from all API responses.
- Failed login attempts against non-existent emails execute a dummy bcrypt comparison (`DUMMY_BCRYPT_HASH`) to reduce timing side-channels and return a generic `401 INVALID_CREDENTIALS` message.

---

## 5. Admin Bootstrap and Role Authorization

- Initial administrator provisioning is handled via `npm run admin:bootstrap` (`backend/src/scripts/adminBootstrap.ts`), reading `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` from the environment.
- The script is idempotent: if the admin already exists, it exits cleanly without overwriting the password. If a regular user already registered `ADMIN_EMAIL`, it refuses to promote the account automatically.
- All `/api/admin/*` routes enforce `requireAuth` followed by `requireAdmin`.

---

## 6. Request Validation

- All request bodies and query parameters are validated using **Zod** schemas (`backend/src/validators/schemas.ts`) with `.strict()` on update payloads to reject unexpected fields and prevent mass assignment.
- The Python service (`music-service/app/music_provider.py`) independently validates query length ($\le 120$ chars), filter values (`songs`, `albums`, `artists`, `all`), numeric limits ($1..30$), and regex-checked video IDs (`^[A-Za-z0-9_\-]{3,64}$`).

---

## 7. Authentication and API Rate Limiting

- Configured in `backend/src/middleware/rateLimiter.ts` using `express-rate-limit`:
  - `authRateLimiter`: 25 requests per 15-minute window per IP on `/api/auth/register` and `/api/auth/login`.
  - `searchRateLimiter`: 60 requests per 1-minute window per IP on `/api/search*`.
  - `apiRateLimiter`: 120 requests per 1-minute window per IP across `/api/*`.

---

## 9. CORS and CSRF Considerations

- CORS (`backend/src/app.ts`) restricts `Access-Control-Allow-Origin` to the configured `FRONTEND_URL` and local development origins, with `credentials: true`.
- State-changing requests (`POST`, `PATCH`, `DELETE`) require `Content-Type: application/json`, which browsers do not send cross-origin without a CORS preflight check, combined with `SameSite=Lax` cookies in same-site deployments.

---

## 10. Cookie Settings

- Cookie name: `vibeflow_session`
- `HttpOnly: true` (inaccessible to `document.cookie`)
- `Secure: true` when `NODE_ENV === 'production'`
- `SameSite: 'lax'` (or `'none'` with `Secure: true` when cross-origin in production)
- `Max-Age`: 7 days (`604800000` ms)

---

## 11. XSS and Output Handling

- React automatically escapes dynamic text content rendered in JSX.
- `dangerouslySetInnerHTML` is never used anywhere in the codebase.
- Track playback uses the official YouTube IFrame Player API with validated `[A-Za-z0-9_-]` video IDs.

---

## 12. MongoDB / Mongoose Injection Prevention

- Inputs are validated as primitive strings/numbers/booleans by Zod before reaching Mongoose queries, preventing `$gt` / `$ne` object injection in query filters.

---

## 13. IDOR and Ownership Checks

- Every playlist (`GET /api/playlists/:id`, `PATCH /api/playlists/:id`, `DELETE /api/playlists/:id`, track additions/removals) verifies `playlist.ownerId === req.user._id` on the server (`backend/src/controllers/playlistController.ts`).
- Favorites and listening history queries are strictly scoped by `{ userId: req.user._id }` derived from the verified server session.

---

## 14. Secret Management

- `.env` files are excluded via `.gitignore`.
- `.env.example`, `backend/.env.example`, and `music-service/.env.example` contain placeholders only.
- In production (`NODE_ENV=production`), `backend/src/config/env.ts` refuses to start if `JWT_SECRET` is missing or shorter than 32 characters.

---

## 15. Internal Python Service Protection

- The Python microservice binds to `127.0.0.1:5001` by default and supports shared-secret verification via the `X-Internal-Token` header (`INTERNAL_SERVICE_TOKEN` in `.env`).

---

## 16. SSRF and Unsafe URL Handling

- The backend never fetches arbitrary client-supplied URLs. Outbound requests from `musicProviderAdapter.ts` go exclusively to the configured `MUSIC_SERVICE_URL` with path-encoded, regex-validated track identifiers.

---

## 17. Error Handling and Safe Logging

- `backend/src/middleware/errorHandler.ts` maps errors to structured `{ success: false, error: { code, message } }` payloads and never returns stack traces, Mongoose internal error objects, or environment values to the client.

---

## 18. Dependency Security and Updates

- Run `npm audit` and `pip check` regularly during CI/CD builds to identify vulnerable transitive packages.

---

## 19. Security Headers and HTTPS

- `helmet` middleware is enabled in `backend/src/app.ts` to set `X-Content-Type-Options: nosniff`, `X-Frame-Options`, and `Referrer-Policy`.
- Production deployments must terminate TLS (HTTPS) at the reverse proxy or cloud load balancer.

---

## 20. Data Privacy and Retention

- Users can view and permanently clear their own listening history (`DELETE /api/history`) and delete their playlists at any time.
- Admin user listings expose only operational account metadata (`id`, `email`, `displayName`, `role`, `authProviders`, `isActive`, `lastLoginAt`, `createdAt`) and never expose user playlists or private listening histories.

---

## 21. Production Deployment Security

- Set `NODE_ENV=production`, a strong `JWT_SECRET` ($\ge 32$ random bytes), a restricted MongoDB user (`readWrite` on the `vibeflow` database only), and keep port `5001` (`music-service`) on a private internal network.

---

## 22. Security Testing and Verification

- Automated tests in `backend/tests/api.test.ts` and `music-service/tests/test_music_service.py` verify password hashing, duplicate rejection, logout token revocation, Google OIDC email-collision protection, admin authorization, and IDOR ownership enforcement.

---

## 23. Incident Response and Responsible Vulnerability Reporting

- If a credential or session secret is suspected of compromise:
  1. Rotate `JWT_SECRET`, `ADMIN_INITIAL_PASSWORD`, and `GOOGLE_CLIENT_SECRET`.
  2. Increment `tokenVersion` across affected user documents in MongoDB to force immediate re-authentication.

---

## 24. Known Limitations and Remaining Risks

- **Rate Limiter Storage**: `express-rate-limit` uses in-memory storage by default; multi-instance horizontal deployments should configure a shared Redis store.
- **YouTube Embed Restrictions**: Some music labels disable embedded playback (`onError` codes `101`/`150`). VibeFlow detects this honestly and provides a direct link to YouTube Music rather than attempting unauthorized stream extraction.
