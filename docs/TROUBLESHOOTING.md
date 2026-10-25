# Troubleshooting Guide — VibeFlow

## 1. "Music is temporarily unavailable" (`503 MUSIC_SERVICE_UNREACHABLE`)

- **Cause**: The Python microservice on `MUSIC_SERVICE_URL` (`http://127.0.0.1:5001`) is not running or blocked by a local firewall.
- **Fix**:
  - If running unified mode (`npm run dev`), `server.ts` automatically spawns `music-service/run.py`.
  - Verify Python 3.10+ is installed (`python3 --version`) and test the service directly:
    ```bash
    curl http://127.0.0.1:5001/health
    ```

## 2. Embedded Track Shows "This track can't be played right now"

- **Cause**: Certain record labels disable embedded playback outside of `music.youtube.com` (YouTube IFrame Player error codes `101` or `150`).
- **Fix**: Click the **Listen on YouTube Music** link displayed in the player bar to open the track directly on YouTube Music.

## 3. `admin:bootstrap` Exits with "Refusing to automatically promote existing non-admin account"

- **Cause**: An ordinary user account was already registered with `ADMIN_EMAIL` before running `npm run admin:bootstrap`.
- **Fix**: Delete the ordinary user account in MongoDB (or choose a dedicated administrator email) and re-run `npm run admin:bootstrap`.
