import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Heart,
  Music,
  Pause,
  Play,
} from 'lucide-react';
import { extractErrorMessage, musicApi } from '../services/api';
import type { Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';

export function TrackDetailPage() {
  const { providerId } = useParams<{ providerId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useLibrary();
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();

  const stateTrack = (location.state as { track?: Track } | null)?.track || null;
  const [track, setTrack] = useState<Track | null>(stateTrack);
  const [loading, setLoading] = useState<boolean>(!stateTrack);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) return;
    let active = true;
    async function fetchTrack() {
      setLoading(true);
      setError(null);
      try {
        const fetched = await musicApi.getTrack(providerId!);
        if (active) setTrack(fetched);
      } catch (err) {
        if (active && !stateTrack) {
          setError(extractErrorMessage(err, 'Unable to load track details.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchTrack();
    return () => {
      active = false;
    };
  }, [providerId]);

  if (loading && !track) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse space-y-4">
        <div className="w-32 h-4 bg-slate-800 rounded" />
        <div className="flex items-center gap-6">
          <div className="w-36 h-36 bg-slate-800 rounded-xl" />
          <div className="space-y-3">
            <div className="w-64 h-7 bg-slate-800 rounded" />
            <div className="w-40 h-4 bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="p-6 rounded-xl bg-slate-900/60 border border-rose-500/30 space-y-4">
        <div className="flex items-center gap-2 text-rose-300 text-sm font-medium">
          <AlertCircle className="w-4 h-4" />
          <span>{error || 'Track not found.'}</span>
        </div>
        <Link
          to="/search"
          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Search</span>
        </Link>
      </div>
    );
  }

  const isCurrent = currentTrack?.providerId === track.providerId;
  const liked = isFavorite(track.providerId);

  return (
    <div className="space-y-8">
      <Link
        to="/search"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Search</span>
      </Link>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
          {track.thumbnailUrl ? (
            <img
              src={track.thumbnailUrl}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <Music className="w-10 h-10 text-slate-500" />
          )}
        </div>

        <div className="space-y-4 min-w-0 flex-1">
          <div className="space-y-1">
            <p className="text-xs text-slate-400">
              {track.album?.name || track.albumName || 'Song'}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{track.title}</h1>
            <p className="text-sm text-slate-300">
              <Link
                to={`/catalog/artist/${encodeURIComponent(track.artistName)}`}
                className="hover:underline"
              >
                {track.artistName}
              </Link>
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums">{track.durationFormatted}</span>
              {track.viewCount && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono tabular-nums">
                    {Number(track.viewCount).toLocaleString()} plays
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => (isCurrent ? togglePlayPause() : playTrack(track))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors"
            >
              {isCurrent && isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-slate-950" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                toggleFavorite(track).catch((err) => {
                  if (err instanceof Error && /sign in/i.test(err.message)) {
                    navigate('/login');
                    return;
                  }
                  setError(extractErrorMessage(err));
                });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-white transition-colors"
            >
              <Heart className={`w-4 h-4 ${liked ? 'text-emerald-400 fill-emerald-400' : ''}`} />
              <span>{liked ? 'Liked' : 'Like'}</span>
            </button>

            <a
              href={track.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors"
            >
              <span>Open in YouTube Music</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
