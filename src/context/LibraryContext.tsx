import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { favoriteApi, historyApi, playlistApi } from '../services/api';
import type { FavoriteItem, HistoryItem, Playlist, Track } from '../types';
import { useAuth } from './AuthContext';

interface LibraryContextValue {
  playlists: Playlist[];
  favorites: FavoriteItem[];
  history: HistoryItem[];
  loadingLibrary: boolean;
  isFavorite: (providerId: string) => boolean;
  toggleFavorite: (track: Track) => Promise<{ added: boolean }>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  renamePlaylist: (id: string, name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<Playlist>;
  removeTrackFromPlaylist: (playlistId: string, providerId: string) => Promise<Playlist>;
  recordListeningEvent: (track: Track, listenedSeconds: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState<boolean>(false);

  const refreshLibrary = useCallback(async () => {
    // Guests do not have personal library resources; clear any previous session state immediately
    if (!user) {
      setPlaylists([]);
      setFavorites([]);
      setHistory([]);
      setLoadingLibrary(false);
      return;
    }

    setLoadingLibrary(true);
    try {
      const [pl, fav, hist] = await Promise.all([
        playlistApi.list(),
        favoriteApi.list(),
        historyApi.list(),
      ]);
      setPlaylists(pl);
      setFavorites(fav);
      setHistory(hist);
    } catch {
      setPlaylists([]);
      setFavorites([]);
      setHistory([]);
    } finally {
      setLoadingLibrary(false);
    }
  }, [user]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const isFavorite = useCallback(
    (providerId: string) => favorites.some((f) => f.providerId === providerId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (track: Track) => {
      if (!user) {
        throw new Error('Please sign in to save songs to your Liked Songs.');
      }
      const currentlyLiked = favorites.some((f) => f.providerId === track.providerId);
      if (currentlyLiked) {
        await favoriteApi.remove(track.providerId);
        setFavorites((prev) => prev.filter((f) => f.providerId !== track.providerId));
        return { added: false };
      } else {
        const added = await favoriteApi.add(track);
        setFavorites((prev) => [added, ...prev]);
        return { added: true };
      }
    },
    [favorites, user]
  );

  const createPlaylist = useCallback(
    async (name: string, description?: string) => {
      if (!user) {
        throw new Error('Please sign in to create playlists.');
      }
      const created = await playlistApi.create({ name, description });
      setPlaylists((prev) => [created, ...prev]);
      return created;
    },
    [user]
  );

  const renamePlaylist = useCallback(
    async (id: string, name: string, description?: string) => {
      if (!user) {
        throw new Error('Please sign in to edit playlists.');
      }
      const updated = await playlistApi.update(id, { name, description });
      setPlaylists((prev) => prev.map((p) => (p._id === id ? updated : p)));
      return updated;
    },
    [user]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      if (!user) {
        throw new Error('Please sign in to delete playlists.');
      }
      await playlistApi.remove(id);
      setPlaylists((prev) => prev.filter((p) => p._id !== id));
    },
    [user]
  );

  const addTrackToPlaylist = useCallback(
    async (playlistId: string, track: Track) => {
      if (!user) {
        throw new Error('Please sign in to add songs to a playlist.');
      }
      const updated = await playlistApi.addTrack(playlistId, track);
      setPlaylists((prev) => prev.map((p) => (p._id === playlistId ? updated : p)));
      return updated;
    },
    [user]
  );

  const removeTrackFromPlaylist = useCallback(
    async (playlistId: string, providerId: string) => {
      if (!user) {
        throw new Error('Please sign in to modify playlists.');
      }
      const updated = await playlistApi.removeTrack(playlistId, providerId);
      setPlaylists((prev) => prev.map((p) => (p._id === playlistId ? updated : p)));
      return updated;
    },
    [user]
  );

  const recordListeningEvent = useCallback(
    async (track: Track, listenedSeconds: number) => {
      if (!user || listenedSeconds < 5) return;
      try {
        const entry = await historyApi.record(track, Math.round(listenedSeconds));
        setHistory((prev) => [entry, ...prev.slice(0, 49)]);
      } catch {
        // Ignore background telemetry recording failures
      }
    },
    [user]
  );

  const clearHistory = useCallback(async () => {
    if (!user) return;
    await historyApi.clear();
    setHistory([]);
  }, [user]);

  return (
    <LibraryContext.Provider
      value={{
        playlists,
        favorites,
        history,
        loadingLibrary,
        isFavorite,
        toggleFavorite,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        recordListeningEvent,
        clearHistory,
        refreshLibrary,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) {
    throw new Error('useLibrary must be used inside a LibraryProvider');
  }
  return ctx;
}
