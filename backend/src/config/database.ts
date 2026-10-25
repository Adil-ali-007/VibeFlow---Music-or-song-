import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from './env';
import { IUser, UserModel } from '../models/User';
import { IPlaylist, PlaylistModel } from '../models/Playlist';
import { IFavorite, FavoriteModel } from '../models/Favorite';
import { IListeningHistory, ListeningHistoryModel } from '../models/ListeningHistory';
import { AppError } from '../utils/apiResponse';

interface LocalStoreData {
  users: IUser[];
  playlists: IPlaylist[];
  favorites: IFavorite[];
  history: IListeningHistory[];
}

/**
 * Database connection and repository layer.
 *
 * When `MONGODB_URI` is provided and reachable, all operations execute directly
 * against MongoDB using our Mongoose models (`UserModel`, `PlaylistModel`,
 * `FavoriteModel`, `ListeningHistoryModel`).
 *
 * When `MONGODB_URI` is not configured (e.g. in an unconfigured local preview
 * or isolated unit test run), operations still validate every document against
 * the exact Mongoose schemas (`new Model(doc).validateSync()`) and persist to an
 * empty-by-default local JSON store (or in-memory during tests).
 *
 * Importantly, the database ALWAYS starts empty (zero demo users, zero fake songs,
 * zero seeded playlists).
 */
class DatabaseManager {
  private isMongoConnected = false;
  private storeFilePath: string;
  private memoryStore: LocalStoreData = {
    users: [],
    playlists: [],
    favorites: [],
    history: [],
  };

  constructor() {
    const dataDir = path.resolve(process.cwd(), '.data');
    this.storeFilePath = path.join(dataDir, 'vibeflow-store.json');
    if (env.NODE_ENV !== 'test') {
      try {
        if (fs.existsSync(this.storeFilePath)) {
          const raw = fs.readFileSync(this.storeFilePath, 'utf-8');
          const parsed = JSON.parse(raw);
          this.memoryStore = {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
            favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
            history: Array.isArray(parsed.history) ? parsed.history : [],
          };
        }
      } catch {
        // Start with clean empty store if unreadable
      }
    }
  }

  private persistLocal(): void {
    if (env.NODE_ENV === 'test') return;
    try {
      const dir = path.dirname(this.storeFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storeFilePath, JSON.stringify(this.memoryStore, null, 2), 'utf-8');
    } catch {
      // Ignore write failures in read-only environments
    }
  }

  public async connect(): Promise<void> {
    if (!env.MONGODB_URI || env.NODE_ENV === 'test') {
      if (env.NODE_ENV === 'production') {
        throw new Error('CRITICAL: MONGODB_URI must be configured in production.');
      }
      this.isMongoConnected = false;
      return;
    }
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      this.isMongoConnected = true;
    } catch (err) {
      this.isMongoConnected = false;
      if (env.NODE_ENV === 'production') {
        throw new Error(
          `CRITICAL: Failed to connect to MongoDB in production: ${
            err instanceof Error ? err.message : 'Unknown connection error'
          }`
        );
      }
    }
  }

  public getStatus(): { connected: boolean; engine: 'mongodb' | 'mongoose-validated-local'; uriConfigured: boolean } {
    return {
      connected: this.isMongoConnected || env.NODE_ENV !== 'production',
      engine: this.isMongoConnected ? 'mongodb' : 'mongoose-validated-local',
      uriConfigured: Boolean(env.MONGODB_URI),
    };
  }

  public async clearAllForTests(): Promise<void> {
    if (env.NODE_ENV !== 'test') {
      throw new Error('clearAllForTests is restricted to NODE_ENV=test');
    }
    this.memoryStore = { users: [], playlists: [], favorites: [], history: [] };
    if (this.isMongoConnected) {
      await Promise.all([
        UserModel.deleteMany({}),
        PlaylistModel.deleteMany({}),
        FavoriteModel.deleteMany({}),
        ListeningHistoryModel.deleteMany({}),
      ]);
    }
  }

  // ---------------- USERS ----------------

  public async findUserByEmail(email: string, includePassword = false): Promise<IUser | null> {
    const normalized = email.trim().toLowerCase();
    if (this.isMongoConnected) {
      const query = UserModel.findOne({ email: normalized });
      if (includePassword) query.select('+passwordHash');
      const doc = await query.lean();
      return doc ? ({ ...doc, _id: String(doc._id) } as IUser) : null;
    }
    const found = this.memoryStore.users.find((u) => u.email === normalized);
    if (!found) return null;
    const copy = { ...found };
    if (!includePassword) {
      delete copy.passwordHash;
    }
    return copy;
  }

  public async findUserById(userId: string, includePassword = false): Promise<IUser | null> {
    if (this.isMongoConnected) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      const query = UserModel.findById(userId);
      if (includePassword) query.select('+passwordHash');
      const doc = await query.lean();
      return doc ? ({ ...doc, _id: String(doc._id) } as IUser) : null;
    }
    const found = this.memoryStore.users.find((u) => u._id === userId);
    if (!found) return null;
    const copy = { ...found };
    if (!includePassword) {
      delete copy.passwordHash;
    }
    return copy;
  }

  public async createUser(input: {
    email: string;
    displayName: string;
    passwordHash: string;
    authProviders?: 'local'[];
    role?: 'user' | 'admin';
    musicPreferences?: string[];
    onboardingCompleted?: boolean;
  }): Promise<IUser> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const candidate = new UserModel({
      email: normalizedEmail,
      displayName: input.displayName.trim(),
      passwordHash: input.passwordHash,
      authProviders: input.authProviders ?? ['local'],
      role: input.role ?? 'user',
      musicPreferences: Array.isArray(input.musicPreferences) ? input.musicPreferences : [],
      onboardingCompleted: Boolean(input.onboardingCompleted),
      tokenVersion: 0,
      isActive: true,
      lastLoginAt: new Date(),
    });

    try {
      await candidate.validate();
    } catch (validationError: unknown) {
      const msg =
        validationError instanceof Error ? validationError.message : 'Validation failed';
      throw new AppError(400, 'VALIDATION_ERROR', msg);
    }

    if (this.isMongoConnected) {
      try {
        const saved = await candidate.save();
        const obj = saved.toObject();
        delete obj.passwordHash;
        return { ...obj, _id: String(saved._id) } as IUser;
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
          throw new AppError(409, 'DUPLICATE_ACCOUNT', 'An account with those credentials already exists.');
        }
        throw err;
      }
    }

    if (this.memoryStore.users.some((u) => u.email === normalizedEmail)) {
      throw new AppError(409, 'DUPLICATE_ACCOUNT', 'An account with those credentials already exists.');
    }

    const now = new Date();
    const record: IUser = {
      _id: String(candidate._id),
      email: normalizedEmail,
      displayName: input.displayName.trim(),
      passwordHash: input.passwordHash,
      authProviders: input.authProviders ?? ['local'],
      role: input.role ?? 'user',
      musicPreferences: Array.isArray(input.musicPreferences) ? input.musicPreferences : [],
      onboardingCompleted: Boolean(input.onboardingCompleted),
      tokenVersion: 0,
      isActive: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.memoryStore.users.push(record);
    this.persistLocal();

    const safeCopy = { ...record };
    delete safeCopy.passwordHash;
    return safeCopy;
  }

  public async updateUser(
    userId: string,
    updates: Partial<
      Pick<
        IUser,
        | 'displayName'
        | 'passwordHash'
        | 'authProviders'
        | 'musicPreferences'
        | 'onboardingCompleted'
        | 'tokenVersion'
        | 'isActive'
        | 'lastLoginAt'
      >
    >
  ): Promise<IUser | null> {
    if (this.isMongoConnected) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      const updated = await UserModel.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
      return updated ? ({ ...updated, _id: String(updated._id) } as IUser) : null;
    }

    const idx = this.memoryStore.users.findIndex((u) => u._id === userId);
    if (idx === -1) return null;

    const current = this.memoryStore.users[idx];
    const next: IUser = {
      ...current,
      musicPreferences: Array.isArray(current.musicPreferences) ? current.musicPreferences : [],
      onboardingCompleted: Boolean(current.onboardingCompleted),
      ...updates,
      updatedAt: new Date(),
    };
    this.memoryStore.users[idx] = next;
    this.persistLocal();

    const safeCopy = { ...next };
    delete safeCopy.passwordHash;
    return safeCopy;
  }

  public async listUsersForAdmin(): Promise<IUser[]> {
    if (this.isMongoConnected) {
      const docs = await UserModel.find({}).sort({ createdAt: -1 }).lean();
      return docs.map((d) => ({ ...d, _id: String(d._id) } as IUser));
    }
    return [...this.memoryStore.users]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((u) => {
        const copy = { ...u };
        delete copy.passwordHash;
        return copy;
      });
  }

  public async getSystemCounts(): Promise<{
    users: number;
    admins: number;
    playlists: number;
    favorites: number;
    historyEvents: number;
  }> {
    if (this.isMongoConnected) {
      const [users, admins, playlists, favorites, historyEvents] = await Promise.all([
        UserModel.countDocuments({}),
        UserModel.countDocuments({ role: 'admin' }),
        PlaylistModel.countDocuments({}),
        FavoriteModel.countDocuments({}),
        ListeningHistoryModel.countDocuments({}),
      ]);
      return { users, admins, playlists, favorites, historyEvents };
    }
    return {
      users: this.memoryStore.users.length,
      admins: this.memoryStore.users.filter((u) => u.role === 'admin').length,
      playlists: this.memoryStore.playlists.length,
      favorites: this.memoryStore.favorites.length,
      historyEvents: this.memoryStore.history.length,
    };
  }

  // ---------------- PLAYLISTS ----------------

  public async listPlaylistsByOwner(ownerId: string): Promise<IPlaylist[]> {
    if (this.isMongoConnected) {
      const docs = await PlaylistModel.find({ ownerId }).sort({ updatedAt: -1 }).lean();
      return docs.map((d) => ({ ...d, _id: String(d._id) } as IPlaylist));
    }
    return this.memoryStore.playlists
      .filter((p) => p.ownerId === ownerId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async findPlaylistById(playlistId: string): Promise<IPlaylist | null> {
    if (this.isMongoConnected) {
      if (!mongoose.Types.ObjectId.isValid(playlistId)) return null;
      const doc = await PlaylistModel.findById(playlistId).lean();
      return doc ? ({ ...doc, _id: String(doc._id) } as IPlaylist) : null;
    }
    return this.memoryStore.playlists.find((p) => p._id === playlistId) || null;
  }

  public async createPlaylist(input: {
    ownerId: string;
    name: string;
    description?: string;
  }): Promise<IPlaylist> {
    const candidate = new PlaylistModel({
      ownerId: input.ownerId,
      name: input.name.trim(),
      description: (input.description || '').trim(),
      tracks: [],
    });

    try {
      await candidate.validate();
    } catch (validationError: unknown) {
      const msg =
        validationError instanceof Error ? validationError.message : 'Validation failed';
      throw new AppError(400, 'VALIDATION_ERROR', msg);
    }

    if (this.isMongoConnected) {
      const saved = await candidate.save();
      return { ...saved.toObject(), _id: String(saved._id) } as IPlaylist;
    }

    const now = new Date();
    const record: IPlaylist = {
      _id: String(candidate._id),
      ownerId: input.ownerId,
      name: input.name.trim(),
      description: (input.description || '').trim(),
      tracks: [],
      createdAt: now,
      updatedAt: now,
    };
    this.memoryStore.playlists.push(record);
    this.persistLocal();
    return record;
  }

  public async updatePlaylist(
    playlistId: string,
    updates: Partial<Pick<IPlaylist, 'name' | 'description' | 'tracks'>>
  ): Promise<IPlaylist | null> {
    if (this.isMongoConnected) {
      if (!mongoose.Types.ObjectId.isValid(playlistId)) return null;
      const updated = await PlaylistModel.findByIdAndUpdate(
        playlistId,
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
      return updated ? ({ ...updated, _id: String(updated._id) } as IPlaylist) : null;
    }

    const idx = this.memoryStore.playlists.findIndex((p) => p._id === playlistId);
    if (idx === -1) return null;
    const next: IPlaylist = {
      ...this.memoryStore.playlists[idx],
      ...updates,
      updatedAt: new Date(),
    };
    this.memoryStore.playlists[idx] = next;
    this.persistLocal();
    return next;
  }

  public async deletePlaylist(playlistId: string): Promise<boolean> {
    if (this.isMongoConnected) {
      if (!mongoose.Types.ObjectId.isValid(playlistId)) return false;
      const res = await PlaylistModel.findByIdAndDelete(playlistId);
      return Boolean(res);
    }
    const prevLen = this.memoryStore.playlists.length;
    this.memoryStore.playlists = this.memoryStore.playlists.filter((p) => p._id !== playlistId);
    const deleted = this.memoryStore.playlists.length < prevLen;
    if (deleted) this.persistLocal();
    return deleted;
  }

  // ---------------- FAVORITES ----------------

  public async listFavoritesByUser(userId: string): Promise<IFavorite[]> {
    if (this.isMongoConnected) {
      const docs = await FavoriteModel.find({ userId }).sort({ createdAt: -1 }).lean();
      return docs.map((d) => ({ ...d, _id: String(d._id) } as IFavorite));
    }
    return this.memoryStore.favorites
      .filter((f) => f.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async addFavorite(
    userId: string,
    track: Omit<IFavorite, '_id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<IFavorite> {
    const candidate = new FavoriteModel({
      userId,
      ...track,
    });

    try {
      await candidate.validate();
    } catch (validationError: unknown) {
      const msg =
        validationError instanceof Error ? validationError.message : 'Validation failed';
      throw new AppError(400, 'VALIDATION_ERROR', msg);
    }

    if (this.isMongoConnected) {
      try {
        const saved = await candidate.save();
        return { ...saved.toObject(), _id: String(saved._id) } as IFavorite;
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
          throw new AppError(409, 'DUPLICATE_FAVORITE', 'This track is already in your Liked Songs.');
        }
        throw err;
      }
    }

    const exists = this.memoryStore.favorites.some(
      (f) => f.userId === userId && f.providerId === track.providerId
    );
    if (exists) {
      throw new AppError(409, 'DUPLICATE_FAVORITE', 'This track is already in your Liked Songs.');
    }

    const now = new Date();
    const record: IFavorite = {
      _id: String(candidate._id),
      userId,
      ...track,
      createdAt: now,
      updatedAt: now,
    };
    this.memoryStore.favorites.push(record);
    this.persistLocal();
    return record;
  }

  public async removeFavorite(userId: string, providerId: string): Promise<boolean> {
    if (this.isMongoConnected) {
      const res = await FavoriteModel.findOneAndDelete({ userId, providerId });
      return Boolean(res);
    }
    const prevLen = this.memoryStore.favorites.length;
    this.memoryStore.favorites = this.memoryStore.favorites.filter(
      (f) => !(f.userId === userId && f.providerId === providerId)
    );
    const deleted = this.memoryStore.favorites.length < prevLen;
    if (deleted) this.persistLocal();
    return deleted;
  }

  // ---------------- LISTENING HISTORY ----------------

  public async listHistoryByUser(userId: string, limit = 50): Promise<IListeningHistory[]> {
    if (this.isMongoConnected) {
      const docs = await ListeningHistoryModel.find({ userId })
        .sort({ playedAt: -1 })
        .limit(limit)
        .lean();
      return docs.map((d) => ({ ...d, _id: String(d._id) } as IListeningHistory));
    }
    return this.memoryStore.history
      .filter((h) => h.userId === userId)
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
      .slice(0, limit);
  }

  public async recordHistory(
    userId: string,
    entry: Omit<IListeningHistory, '_id' | 'userId' | 'playedAt'>
  ): Promise<IListeningHistory> {
    const candidate = new ListeningHistoryModel({
      userId,
      ...entry,
      playedAt: new Date(),
    });

    try {
      await candidate.validate();
    } catch (validationError: unknown) {
      const msg =
        validationError instanceof Error ? validationError.message : 'Validation failed';
      throw new AppError(400, 'VALIDATION_ERROR', msg);
    }

    if (this.isMongoConnected) {
      const saved = await candidate.save();
      return { ...saved.toObject(), _id: String(saved._id) } as IListeningHistory;
    }

    const record: IListeningHistory = {
      _id: String(candidate._id),
      userId,
      ...entry,
      playedAt: new Date(),
    };
    this.memoryStore.history.push(record);
    this.persistLocal();
    return record;
  }

  public async clearHistoryByUser(userId: string): Promise<number> {
    if (this.isMongoConnected) {
      const res = await ListeningHistoryModel.deleteMany({ userId });
      return res.deletedCount || 0;
    }
    const before = this.memoryStore.history.length;
    this.memoryStore.history = this.memoryStore.history.filter((h) => h.userId !== userId);
    const removed = before - this.memoryStore.history.length;
    if (removed > 0) this.persistLocal();
    return removed;
  }
}

export const db = new DatabaseManager();
