# Database Schema — VibeFlow

VibeFlow uses four Mongoose models in `backend/src/models/`:

---

## 1. `User` (`backend/src/models/User.ts`)

| Field | Type | Required | Constraints & Indexes |
| :--- | :--- | :--- | :--- |
| `email` | `String` | Yes | `unique: true`, `lowercase: true`, `trim: true`, `maxlength: 254`, indexed |
| `displayName` | `String` | Yes | `minlength: 2`, `maxlength: 60` |
| `passwordHash` | `String` | Yes | `select: false` (never returned in default queries) |
| `authProviders` | `String[]` | Yes | Enum `['local']`, default `['local']` |
| `role` | `String` | Yes | Enum `['user', 'admin']`, default `'user'` |
| `musicPreferences` | `String[]` | Yes | Default `[]` |
| `onboardingCompleted` | `Boolean` | Yes | Default `false` |
| `tokenVersion` | `Number` | Yes | Default `0`; incremented on logout/password change/suspension |
| `isActive` | `Boolean` | Yes | Default `true` |
| `lastLoginAt` | `Date` | No | Updated on successful authentication |
| `createdAt` / `updatedAt` | `Date` | Yes | Managed by Mongoose `timestamps: true` |

---

## 2. `Playlist` (`backend/src/models/Playlist.ts`)

- **Fields**: `ownerId` (indexed), `name` (1..80 chars), `description` (0..300 chars), `tracks` (embedded array of normalized track snapshots with `providerId`, `title`, `artistName`, `albumName`, `durationSeconds`, `durationFormatted`, `thumbnailUrl`, `playbackType`, `embedUrl`, `externalUrl`, `addedAt`).
- **Compound Index**: `{ ownerId: 1, updatedAt: -1 }` for fast user playlist listings.

---

## 3. `Favorite` (`backend/src/models/Favorite.ts`)

- **Architectural Trade-off**: Favorites are stored in a dedicated `Favorite` collection rather than an embedded array inside `User`. This prevents unbounded `User` document growth and allows MongoDB to enforce uniqueness atomically via a compound unique index:
  - `{ userId: 1, providerId: 1 }` (`unique: true`)

---

## 4. `ListeningHistory` (`backend/src/models/ListeningHistory.ts`)

- **Fields**: `userId`, `providerId`, `title`, `artistName`, `albumName`, `durationSeconds`, `durationFormatted`, `thumbnailUrl`, `playbackType`, `embedUrl`, `externalUrl`, `listenedSeconds` (`min: 5`), `playedAt` (`Date.now`).
- **Compound Index**: `{ userId: 1, playedAt: -1 }` for reverse-chronological history retrieval.
