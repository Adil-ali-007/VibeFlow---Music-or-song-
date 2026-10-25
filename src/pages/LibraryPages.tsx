import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Edit3,
  Heart,
  History,
  ListMusic,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { extractErrorMessage, playlistApi } from '../services/api';
import type { Playlist } from '../types';
import { TrackRow } from '../components/TrackRow';

export function PlaylistsPage() {
  const { playlists, createPlaylist, deletePlaylist, loadingLibrary } = useLibrary();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Playlist name is required.');
      return;
    }
    setCreating(true);
    try {
      await createPlaylist(name.trim(), description.trim());
      setName('');
      setDescription('');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Playlists</h1>

      {/* Create Playlist Form */}
      <form
        onSubmit={handleCreate}
        className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>New Playlist</span>
        </h2>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="playlist-name" className="block text-xs font-medium text-slate-300">
              Name
            </label>
            <input
              id="playlist-name"
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Late Night Vibes"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="playlist-desc" className="block text-xs font-medium text-slate-300">
              Description (Optional)
            </label>
            <input
              id="playlist-desc"
              type="text"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short description"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{creating ? 'Creating...' : 'Create Playlist'}</span>
        </button>
      </form>

      {/* Playlists List */}
      {loadingLibrary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-900/50 animate-pulse" />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <ListMusic className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No playlists yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Create a playlist above to start saving your favorite songs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl._id}
              className="p-5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 transition-colors flex flex-col justify-between space-y-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/playlists/${pl._id}`}
                    className="text-base font-bold text-white hover:text-emerald-400 truncate"
                  >
                    {pl.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      deletePlaylist(pl._id).catch((err) => {
                        setError(extractErrorMessage(err));
                      });
                    }}
                    aria-label={`Delete playlist ${pl.name}`}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {pl.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{pl.description}</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <span className="font-mono tabular-nums">
                  {pl.tracks.length} {pl.tracks.length === 1 ? 'song' : 'songs'}
                </span>
                <Link
                  to={`/playlists/${pl._id}`}
                  className="text-emerald-400 hover:underline font-medium"
                >
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { renamePlaylist, deletePlaylist, removeTrackFromPlaylist } = useLibrary();
  const { playTrack } = usePlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const data = await playlistApi.getById(id!);
        if (active) {
          setPlaylist(data);
          setEditName(data.name);
          setEditDesc(data.description || '');
        }
      } catch (err) {
        if (active) setError(extractErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchDetail();
    return () => {
      active = false;
    };
  }, [id]);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlist || !editName.trim()) return;
    try {
      const updated = await renamePlaylist(playlist._id, editName.trim(), editDesc.trim());
      setPlaylist(updated);
      setEditing(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleRemoveTrack = async (providerId: string) => {
    if (!playlist) return;
    try {
      const updated = await removeTrackFromPlaylist(playlist._id, providerId);
      setPlaylist(updated);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    try {
      await deletePlaylist(playlist._id);
      navigate('/playlists');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  if (loading) {
    return <div className="h-40 rounded-2xl bg-slate-900/50 animate-pulse" />;
  }

  if (error || !playlist) {
    return (
      <div className="p-6 rounded-xl bg-slate-900/60 border border-rose-500/30 space-y-3">
        <div className="flex items-center gap-2 text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error || 'Playlist not found.'}</span>
        </div>
        <Link to="/playlists" className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Playlists</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/playlists"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>All Playlists</span>
      </Link>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        {editing ? (
          <form onSubmit={handleRename} className="space-y-3 max-w-lg">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={80}
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
            />
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              maxLength={300}
              placeholder="Description"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-400">
                Playlist ·{' '}
                <span className="font-mono tabular-nums">
                  {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
                </span>
              </p>
              <h1 className="text-2xl font-bold text-white">{playlist.name}</h1>
              {playlist.description && (
                <p className="text-xs text-slate-400">{playlist.description}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {playlist.tracks.length > 0 && (
                <button
                  type="button"
                  onClick={() => playTrack(playlist.tracks[0], playlist.tracks)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Play</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={handleDeletePlaylist}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-xs text-rose-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {playlist.tracks.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <p className="text-sm font-semibold text-white">This playlist is empty</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Search for songs and add them to this playlist.
          </p>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find Songs</span>
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2 space-y-0.5">
          {playlist.tracks.map((track, idx) => (
            <TrackRow
              key={`${track.providerId}-${idx}`}
              track={track}
              index={idx}
              queueContext={playlist.tracks}
              onRemoveFromPlaylist={handleRemoveTrack}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FavoritesPage() {
  const { favorites, loadingLibrary } = useLibrary();
  const { playTrack } = usePlayer();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Liked Songs</h1>
          <p className="text-xs text-slate-400">
            <span className="font-mono tabular-nums">{favorites.length}</span>{' '}
            {favorites.length === 1 ? 'song' : 'songs'}
          </p>
        </div>

        {favorites.length > 0 && (
          <button
            type="button"
            onClick={() => playTrack(favorites[0], favorites)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors shrink-0"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Play All</span>
          </button>
        )}
      </div>

      {loadingLibrary ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-900/50 animate-pulse" />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <Heart className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white">No liked songs yet</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Tap the heart icon on any song to save it here.
            </p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find Songs</span>
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2 space-y-0.5">
          {favorites.map((track, idx) => (
            <TrackRow
              key={track.providerId}
              track={track}
              index={idx}
              queueContext={favorites}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoryPage() {
  const { history, clearHistory, loadingLibrary } = useLibrary();
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearHistory();
    } catch {
      // Ignore transient clear error
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Recently Played</h1>
          <p className="text-xs text-slate-400">
            Songs you&apos;ve listened to recently
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={clearing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-xs font-medium text-rose-300 border border-slate-700 transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{clearing ? 'Clearing...' : 'Clear History'}</span>
          </button>
        )}
      </div>

      {loadingLibrary ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-900/50 animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <History className="w-8 h-8 text-slate-500 mx-auto" />
          <h2 className="text-sm font-semibold text-white">No recently played songs</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Songs you play will show up here.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2 space-y-0.5">
          {history.map((item, idx) => {
            const playedDate = new Date(item.playedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <TrackRow
                key={`${item._id}-${idx}`}
                track={item}
                index={idx}
                queueContext={history}
                subtitleOverride={`Played at ${playedDate}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
