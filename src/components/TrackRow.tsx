import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  ExternalLink,
  Heart,
  ListPlus,
  Music,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import type { Track } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { extractErrorMessage } from '../services/api';

interface TrackRowProps {
  track: Track;
  index: number;
  queueContext?: Track[];
  onRemoveFromPlaylist?: (providerId: string) => void;
  subtitleOverride?: string;
}

export function TrackRow({
  track,
  index,
  queueContext,
  onRemoveFromPlaylist,
  subtitleOverride,
}: TrackRowProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playlists, isFavorite, toggleFavorite, addTrackToPlaylist } = useLibrary();
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();

  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isCurrent = currentTrack?.providerId === track.providerId;
  const liked = isFavorite(track.providerId);

  const handlePlayClick = () => {
    if (isCurrent) {
      togglePlayPause();
    } else {
      playTrack(track, queueContext);
    }
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await toggleFavorite(track);
    } catch (err) {
      setStatusMessage(extractErrorMessage(err));
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await addTrackToPlaylist(playlistId, track);
      setMenuOpen(false);
      setStatusMessage('Added to playlist');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err) {
      setMenuOpen(false);
      setStatusMessage(extractErrorMessage(err));
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const albumLabel = track.album?.name || track.albumName || 'Single';

  return (
    <div
      className={`group relative grid grid-cols-[36px_1fr_auto] md:grid-cols-[40px_1.6fr_1fr_auto] items-center gap-4 px-3 py-2.5 rounded-lg border transition-colors ${
        isCurrent
          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
          : 'border-transparent hover:bg-slate-800/60 hover:border-slate-800 text-slate-200'
      }`}
    >
      {/* Index or Play Button */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={handlePlayClick}
          aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          className="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 group-hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-4 h-4 text-emerald-400 fill-emerald-400" />
          ) : (
            <>
              <span className="font-mono text-xs tabular-nums group-hover:hidden">
                {String(index + 1).padStart(2, '0')}
              </span>
              <Play className="w-4 h-4 hidden group-hover:block text-white fill-white" />
            </>
          )}
        </button>
      </div>

      {/* Artwork + Title + Artist */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center border border-slate-700/60">
          {track.thumbnailUrl && !imgError ? (
            <img
              src={track.thumbnailUrl}
              alt={track.title}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <Music className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/tracks/${encodeURIComponent(track.providerId)}`}
              state={{ track }}
              className={`text-sm font-medium truncate hover:underline ${
                isCurrent ? 'text-emerald-400' : 'text-slate-100'
              }`}
            >
              {track.title}
            </Link>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate mt-0.5">
            <Link
              to={`/catalog/artist/${encodeURIComponent(track.artistName)}`}
              className="hover:text-slate-200 hover:underline truncate"
            >
              {track.artistName}
            </Link>
            {subtitleOverride && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-400">{subtitleOverride}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Album column (Desktop) */}
      <div className="hidden md:flex items-center min-w-0 text-xs text-slate-400">
        <Link
          to={`/catalog/album/${encodeURIComponent(albumLabel)}`}
          className="truncate hover:text-slate-200 hover:underline"
        >
          {albumLabel}
        </Link>
      </div>

      {/* Actions + Duration */}
      <div className="flex items-center gap-2 shrink-0">
        {statusMessage && (
          <span className="text-xs text-emerald-400 flex items-center gap-1 whitespace-nowrap">
            <Check className="w-3.5 h-3.5" />
            {statusMessage}
          </span>
        )}

        <button
          type="button"
          onClick={handleFavoriteClick}
          aria-label={liked ? `Remove ${track.title} from Liked Songs` : `Save ${track.title} to Liked Songs`}
          title={user ? (liked ? 'Remove from Liked Songs' : 'Save to Liked Songs') : 'Sign in to like songs'}
          className={`p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            liked
              ? 'text-emerald-400 hover:text-emerald-300'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-emerald-400' : ''}`} />
        </button>

        {/* Add to playlist dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (!user) {
                navigate('/login');
                return;
              }
              setMenuOpen((prev) => !prev);
            }}
            aria-label={`Add ${track.title} to a playlist`}
            title={user ? 'Add to playlist' : 'Sign in to add to playlist'}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <ListPlus className="w-4 h-4" />
          </button>

          {menuOpen && user && (
            <div className="absolute right-0 mt-1 w-56 rounded-lg bg-slate-900 border border-slate-700 shadow-xl py-1.5 z-30">
              <div className="px-3 py-1 text-xs font-medium text-slate-400 border-b border-slate-800">
                Add to Playlist
              </div>
              {playlists.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400">
                  No playlists yet.{' '}
                  <Link
                    to="/playlists"
                    onClick={() => setMenuOpen(false)}
                    className="text-emerald-400 hover:underline"
                  >
                    Create one
                  </Link>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {playlists.map((pl) => (
                    <button
                      key={pl._id}
                      type="button"
                      onClick={() => handleAddToPlaylist(pl._id)}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 truncate block"
                    >
                      {pl.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {onRemoveFromPlaylist && (
          <button
            type="button"
            onClick={() => onRemoveFromPlaylist(track.providerId)}
            aria-label={`Remove ${track.title} from playlist`}
            title="Remove from playlist"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        <a
          href={track.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in YouTube Music"
          aria-label={`Open ${track.title} on YouTube Music`}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <span className="font-mono text-xs text-slate-400 tabular-nums w-11 text-right">
          {track.durationFormatted || '0:00'}
        </span>
      </div>
    </div>
  );
}
