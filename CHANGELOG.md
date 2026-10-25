# Changelog

All notable changes to the VibeFlow project are documented in this file.

## [0.1.0] - 2026-10-20

### Added
- **Python Music Discovery Service (`music-service/`)**: Built Flask / WSGI HTTP service integrating `ytmusicapi` (with standard-library YouTube Music InnerTube fallback), input validation, and normalized track/album/artist responses.
- **Express Backend (`backend/`)**: Implemented REST API (`/api/auth`, `/api/users`, `/api/search`, `/api/playlists`, `/api/favorites`, `/api/history`, `/api/admin`, `/api/health`) with Mongoose models, Zod validation, Helmet headers, CORS, and rate limiting.
- **Authentication & Admin Provisioning**: Added bcrypt password hashing, HTTP-only session cookies with `tokenVersion` revocation, server-side Google OIDC verification (`google-auth-library`) with explicit account linking, and idempotent `npm run admin:bootstrap` script.
- **React Frontend (`src/`)**: Implemented 14 pages with dark-first Spotify-inspired UI, persistent YouTube IFrame Player integration, and verified empty states.
- **Testing & Documentation**: Added Vitest backend/frontend test suites, Python `unittest` suite, `SECURITY.md`, and `docs/*.md`.
