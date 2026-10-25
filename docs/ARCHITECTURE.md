# Architecture Overview — VibeFlow

VibeFlow is structured around three distinct tiers with strict dependency direction:

```text
React Frontend (src/)
        │
        ▼  HTTPS / JSON + HTTP-Only Session Cookie
Express API (backend/src/)
   ├──► MongoDB / Mongoose Models (User, Playlist, Favorite, ListeningHistory)
   └──► MusicProviderAdapter (backend/src/services/musicProviderAdapter.ts)
              │
              ▼  Internal HTTP + Timeout (8.5s)
        Python Music Service (music-service/)
              │
              ▼  ytmusicapi / InnerTube
        YouTube Music Catalog
```

## 1. Service Responsibilities

- **React Frontend (`src/`)**: Renders UI views, manages client-side navigation (`react-router-dom`), coordinates the official YouTube IFrame Player (`src/components/MusicPlayer.tsx`), and communicates exclusively with the Express `/api/*` endpoints.
- **Express Backend (`backend/src/`)**: Acts as the single policy enforcement point. Validates every incoming request with Zod, authenticates sessions, enforces admin and resource-ownership authorization, and persists data via Mongoose.
- **Python Music Service (`music-service/`)**: Isolated catalog discovery service. Accepts `/search` and `/tracks/<video_id>` requests from Express, queries YouTube Music via `ytmusicapi`, and normalizes raw responses into a stable schema. It has zero access to user accounts or MongoDB.

## 2. Playback vs. Metadata Architecture

Searching YouTube Music via `ytmusicapi` returns **catalog metadata** (videoId, title, artists, album, duration, thumbnail URLs)—not a raw MP3 stream. To respect copyright and platform terms:
- `music_provider.py` normalizes each song with `playbackType: "YOUTUBE_EMBED"` and an official `embedUrl` + `externalUrl`.
- `src/components/MusicPlayer.tsx` loads the `providerId` inside the official **YouTube IFrame Player API**, synchronizing play, pause, seek, volume, and buffering states with real player events.
