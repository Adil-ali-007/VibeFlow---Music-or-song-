# System Design — VibeFlow

## 1. Component Topology

```mermaid
flowchart LR
    Browser["React SPA (src/)"] -->|HTTPS + HttpOnly Cookie| Express["Express API (backend/src/)"]
    Express -->|Mongoose ODM| MongoDB[("MongoDB")]
    Express -->|Internal HTTP (8.5s Timeout)| PythonSvc["Python Music Service (music-service/)"]
    PythonSvc -->|ytmusicapi| YTMusic["YouTube Music Catalog"]
    Browser -->|Authorized Embed| YTPlayer["YouTube IFrame Player API"]
```

## 2. Core Request Sequences

### Search & Discovery Sequence

```mermaid
sequenceDiagram
    participant U as React UI (SearchPage)
    participant E as Express (/api/search)
    participant A as MusicProviderAdapter
    participant P as Python Service (/search)
    participant Y as YouTube Music

    U->>E: GET /api/search?q=daft+punk&filter=songs
    E->>E: Validate query with searchQuerySchema (Zod)
    E->>A: search("daft punk", "songs", 15)
    A->>P: GET /search?q=daft+punk&filter=songs&limit=15
    P->>Y: Query catalog via ytmusicapi
    Y-->>P: Raw catalog items
    P->>P: Normalize tracks (providerId, durationSeconds, embedUrl)
    P-->>A: { success: true, data: { tracks, albums, artists } }
    A-->>E: Normalized SearchResponseData
    E-->>U: 200 OK { success: true, data }
```

## 3. Failure Handling & Timeouts

- **Python Provider Timeouts**: `musicProviderAdapter.ts` enforces an 8.5-second timeout and maps `ECONNABORTED` or upstream `504` to `504 MUSIC_PROVIDER_TIMEOUT`.
- **Service Unreachable**: If `music-service` is offline, Express returns `503 MUSIC_SERVICE_UNREACHABLE`, and the React UI displays an error banner with a **Retry** button—never fake results.
