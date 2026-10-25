# VibeFlow — Secure Full-Stack Music Streaming & Discovery Platform

VibeFlow is a full-stack music discovery and streaming web application built with **React**, **TypeScript**, **Express**, **MongoDB (Mongoose)**, and an isolated **Python (`ytmusicapi`)** discovery microservice.

Designed for clarity, security, and maintainability, VibeFlow contains **zero demo data**—starting with a clean database, querying live YouTube Music catalog metadata, and streaming through the official YouTube IFrame Player API.

---

## 1. Verified Features

- **Real Music Discovery & Search**: Live search across songs, albums, and artists powered by the Python `music-service` (`ytmusicapi` with standard-library InnerTube fallback).
- **Authorized Playback**: Persistent bottom music player synchronized with the official YouTube IFrame Player API (play/pause, seek bar, volume, mute, queue next/previous, shuffle, repeat, and honest rightsholder restriction handling).
- **Secure Email/Password Authentication**: Zod validation, bcrypt password hashing (12 salt rounds), HTTP-only JWT cookies, CSRF protection, and server-side session revocation (`tokenVersion`).
- **Personal Library (Playlists, Liked Songs, Listening History)**: Full CRUD with server-side IDOR ownership enforcement and a $\ge 5$-second genuine playback threshold before logging listening history.
- **Safe Admin Provisioning & Console**: Idempotent `npm run admin:bootstrap` command and server-protected `/admin` dashboard displaying real database counts, service health, and user status controls.

---

## 2. Technology Stack

- **Frontend (`src/`)**: React 19, Vite, TypeScript, React Router, Tailwind CSS, Axios, Lucide React
- **Backend (`backend/`)**: Node.js, Express, TypeScript, MongoDB & Mongoose, Zod, `bcryptjs`, `jsonwebtoken`, `helmet`, `express-rate-limit`
- **Music Service (`music-service/`)**: Python 3.10+, Flask / WSGI HTTP Server, `ytmusicapi`

---

## 3. Architecture & Request Flows

1. **Login Flow**:
   `src/pages/AuthPages.tsx` → `POST /api/auth/login` (`backend/src/routes/index.ts`) → `loginSchema` (`backend/src/validators/schemas.ts`) → `authController.login` (`backend/src/controllers/authController.ts`) → `db.findUserByEmail` (`backend/src/config/database.ts`) → `setSessionCookie` (`HttpOnly`) → `AuthContext.tsx`.
2. **Search Flow**:
   `src/pages/SearchPage.tsx` → `GET /api/search` → `searchController.searchMusic` → `musicProviderAdapter.search` (`backend/src/services/musicProviderAdapter.ts`) → Python `music-service` (`music-service/app/routes.py` & `music_provider.py`) → YouTube Music → normalized JSON → React `TrackRow.tsx`.
3. **Playlist Flow**:
   `src/pages/LibraryPages.tsx` → `POST /api/playlists/:id/tracks` → `requireAuth` (`backend/src/middleware/auth.ts`) → `playlistController.addTrackToPlaylist` (verifies `playlist.ownerId === req.user._id`) → Mongoose `PlaylistModel` validation & persistence → updated UI.

---

## 4. Setup Instructions (Windows PowerShell & Unix)

### Prerequisites
- Node.js 20+ and npm
- Python 3.10+
- MongoDB Community Server or MongoDB Atlas URI (optional in local development; falls back to an empty Mongoose-validated local store if `MONGODB_URI` is unset)

### Windows PowerShell Setup

```powershell
# 1. Install Node dependencies
npm install

# 2. Set up Python virtual environment for music-service
python -m venv music-service/.venv
.\music-service\.venv\Scripts\Activate.ps1
pip install -r music-service/requirements.txt
deactivate

# 3. Create environment file
Copy-Item .env.example .env
```

### Unix / macOS / Linux Setup

```bash
npm install
python3 -m venv music-service/.venv
source music-service/.venv/bin/activate
pip install -r music-service/requirements.txt
deactivate
cp .env.example .env
```

---

## 5. Administrator Bootstrap Procedure

Never place real passwords in `.env.example` or committed files. To provision the initial administrator privately in Windows PowerShell:

```powershell
$env:ADMIN_EMAIL = "admin@yourdomain.com"
$sec = Read-Host "Enter new initial admin password" -AsSecureString
$env:ADMIN_INITIAL_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
)
npm run admin:bootstrap
Remove-Item Env:\ADMIN_INITIAL_PASSWORD
```

*Note: Clear terminal history or use a local secret manager (such as 1Password CLI or `dotenvx`) to avoid leaving secrets in shell history.*

---

## 6. Running the Application & Tests

- **Start Full-Stack Application (Port 3000 + Python Music Service on Port 5001)**:
  ```bash
  npm run dev
  ```
- **Run All Backend & Frontend Tests (Vitest)**:
  ```bash
  npm test
  ```
- **Run Python Music Service Unit Tests**:
  ```bash
  npm run test:python
  ```
- **Type Check & Production Build**:
  ```bash
  npm run typecheck
  npm run build
  ```

---

## 7. Documentation Index

- [`SECURITY.md`](./SECURITY.md) — Threat model, authentication, IDOR prevention, and security controls
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Service boundaries and module responsibilities
- [`docs/SYSTEM_DESIGN.md`](./docs/SYSTEM_DESIGN.md) — Data flow, Mermaid diagrams, and scaling
- [`docs/API.md`](./docs/API.md) — REST API endpoint reference
- [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) — Mongoose schemas, indexes, and trade-offs
- [`docs/AUTHENTICATION.md`](./docs/AUTHENTICATION.md) — Local auth, Google OIDC, and account linking
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — Production deployment checklist
- [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) — Common errors and diagnostics
