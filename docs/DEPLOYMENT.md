# Deployment Guide — VibeFlow

## 1. Deployment Architecture Overview

VibeFlow consists of three runtime tiers:
1. **React SPA Frontend (`src/` -> `dist/`)**: Built with Vite.
2. **Express API & Session Server (`backend/` & `server.ts`)**: Handles email/password authentication, JWT `HttpOnly` cookies, CSRF protection, rate limiting, and MongoDB persistence.
3. **Python Music Discovery Service (`music-service/`)**: Runs Flask / WSGI with `ytmusicapi` to query live YouTube Music catalog data.

> **Important Note on Vercel / Serverless Hosting:**
> Do **not** assume Vercel static/serverless functions can run a persistent background Python Flask process on `127.0.0.1:5001` in the same way as a local development server.
> Choose one of the two supported production deployment topologies below:

### Option A: Unified Container Deployment (Google Cloud Run, Render, Railway, Fly.io, Docker VPS)
Run the unified Node.js + Python container where `server.ts` serves the built `dist/` SPA, mounts `/api/*`, and manages or communicates with the Python `music-service`.
- Install both Node.js 20+ and Python 3.10+ in the container image.
- Build frontend assets: `npm ci && npm run build`
- Install Python dependencies: `pip install -r music-service/requirements.txt`
- Start command: `npm start` (`NODE_ENV=production tsx server.ts`)

### Option B: Split-Service Deployment (Frontend on Vercel/Cloudflare + Backend & Python on Container Hosts)
1. **Python Music Service** (Private service on Render / Railway / Cloud Run):
   - Root directory: `music-service`
   - Build command: `pip install -r requirements.txt`
   - Start command: `python3 run.py` (or `gunicorn -w 2 -b 0.0.0.0:$PORT "app.routes:create_flask_app()"`)
   - Environment variables: `INTERNAL_SERVICE_TOKEN=<shared-secret>`, `REQUEST_TIMEOUT_SECONDS=8`
2. **Express API Backend** (Web service on Render / Railway / Cloud Run):
   - Build command: `npm ci`
   - Start command: `NODE_ENV=production npx tsx backend/src/server.ts`
   - Environment variables: `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `MUSIC_SERVICE_URL` (pointing to the deployed Python service URL), `INTERNAL_SERVICE_TOKEN` (matching Python service).
3. **React Frontend** (Vercel / Netlify / Cloudflare Pages):
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variable: `VITE_API_URL=https://your-express-backend.example.com/api`

---

## 2. Required Production Environment Variables

In `NODE_ENV=production`, the backend validates critical secrets at startup and refuses to start if they are missing or weak:

| Variable | Required in Prod | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | HTTP port (default `3000`) |
| `MONGODB_URI` | **Yes (Fail-Fast)** | Valid `mongodb://` or `mongodb+srv://` connection string |
| `JWT_SECRET` | **Yes (Fail-Fast)** | Cryptographically random secret $\ge 32$ characters |
| `FRONTEND_URL` | Yes | Canonical HTTPS origin of the frontend application |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated list of allowed CORS origins |
| `PUBLIC_URL` | Recommended | Public base URL of the backend server |
| `MUSIC_SERVICE_URL` | Yes | URL of the Python `music-service` (e.g. `http://127.0.0.1:5001` or internal service URL) |
| `INTERNAL_SERVICE_TOKEN` | Recommended | Shared secret sent in `X-Internal-Token` between Express and Python |
| `ADMIN_EMAIL` | Bootstrap only | Used only when running `npm run admin:bootstrap` |
| `ADMIN_INITIAL_PASSWORD` | Bootstrap only | Used only when running `npm run admin:bootstrap` |

---

## 3. Reverse Proxy, HTTPS & Cookie Security

- `app.set('trust proxy', 1)` is enabled in `backend/src/app.ts` so `req.secure`, `X-Forwarded-Proto`, and IP rate limiters work accurately behind Cloud Run, Nginx, or Cloudflare load balancers.
- In production (`NODE_ENV=production` or HTTPS proxy), session cookies (`vibeflow_session`) are set with `HttpOnly`, `Secure: true`, `SameSite: 'none'`, and `Partitioned: true`.

---

## 4. Health Checks

- Express API & Database/Provider Status: `GET /api/health`
- Python Music Service Health: `GET /health` on `MUSIC_SERVICE_URL`
