import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Compass,
  Disc3,
  Heart,
  History,
  Music,
  Pause,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  getGenreDefinition,
  ONBOARDING_GENRES,
  type GenreDefinition,
} from '../constants/musicCatalog';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { extractErrorMessage, musicApi } from '../services/api';
import type { Track } from '../types';
import { TrackRow } from '../components/TrackRow';

function MusicCard({
  track,
  queueContext,
}: {
  track: Track;
  queueContext: Track[];
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();
  const { isFavorite, toggleFavorite } = useLibrary();
  const [imgError, setImgError] = useState(false);

  const isCurrent = currentTrack?.providerId === track.providerId;
  const liked = isFavorite(track.providerId);

  const handlePlay = () => {
    if (isCurrent) {
      togglePlayPause();
    } else {
      playTrack(track, queueContext);
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    toggleFavorite(track).catch(() => {});
  };

  return (
    <div
      className={`group relative rounded-xl p-3 transition-all duration-200 border ${
        isCurrent
          ? 'bg-emerald-950/30 border-emerald-500/40'
          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
      } flex flex-col justify-between`}
    >
      <div className="space-y-3">
        <div
          onClick={handlePlay}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handlePlay();
            }
          }}
          aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          className="relative aspect-square rounded-lg overflow-hidden bg-slate-800 cursor-pointer"
        >
          {track.thumbnailUrl && !imgError ? (
            <img
              src={track.thumbnailUrl}
              alt={track.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-8 h-8 text-slate-500" />
            </div>
          )}

          <div
            className={`absolute inset-0 bg-black/30 flex items-end justify-end p-2.5 transition-opacity ${
              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <span className="w-10 h-10 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg transform translate-y-1 group-hover:translate-y-0 transition-transform">
              {isCurrent && isPlaying ? (
                <Pause className="w-4 h-4 fill-slate-950" />
              ) : (
                <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
              )}
            </span>
          </div>
        </div>

        <div className="min-w-0 space-y-0.5">
          <Link
            to={`/tracks/${encodeURIComponent(track.providerId)}`}
            state={{ track }}
            className={`block text-sm font-semibold truncate hover:underline ${
              isCurrent ? 'text-emerald-400' : 'text-white'
            }`}
          >
            {track.title}
          </Link>
          <Link
            to={`/catalog/artist/${encodeURIComponent(track.artistName)}`}
            className="block text-xs text-slate-400 truncate hover:text-slate-200 hover:underline"
          >
            {track.artistName}
          </Link>
        </div>
      </div>

      <div className="pt-2.5 mt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-mono tabular-nums">{track.durationFormatted || '—'}</span>
        <button
          type="button"
          onClick={handleFavorite}
          aria-label={liked ? `Remove ${track.title} from Liked Songs` : `Save ${track.title}`}
          title={user ? (liked ? 'Remove from Liked Songs' : 'Save to Liked Songs') : 'Sign in to like songs'}
          className={`p-1 rounded hover:bg-slate-800 transition-colors ${
            liked ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-emerald-400' : ''}`} />
        </button>
      </div>
    </div>
  );
}

interface GenreShelfData {
  genre: GenreDefinition;
  tracks: Track[];
}

export function HomePage() {
  const { user } = useAuth();
  const { history } = useLibrary();

  const savedPreferences = useMemo(() => {
    if (Array.isArray(user?.musicPreferences) && user.musicPreferences.length > 0) {
      return user.musicPreferences;
    }
    return [];
  }, [user?.musicPreferences]);

  const hasPersonalPreferences = Boolean(user && savedPreferences.length > 0);

  const activeGenres: GenreDefinition[] = useMemo(() => {
    if (hasPersonalPreferences) {
      return savedPreferences.map((id) => getGenreDefinition(id));
    }
    // General genre-based discovery shelves for guests or users who skipped onboarding
    return [
      getGenreDefinition('lofi'),
      getGenreDefinition('pop'),
      getGenreDefinition('indie'),
    ];
  }, [hasPersonalPreferences, savedPreferences]);

  const discoverGenre: GenreDefinition = useMemo(() => {
    const selectedIds = new Set(activeGenres.map((g) => g.id));
    const candidate = ONBOARDING_GENRES.find((g) => !selectedIds.has(g.id));
    return candidate || getGenreDefinition('electronic');
  }, [activeGenres]);

  const [madeForYouTracks, setMadeForYouTracks] = useState<Track[]>([]);
  const [genreShelves, setGenreShelves] = useState<GenreShelfData[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [discoverTracks, setDiscoverTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const primaryGenres = activeGenres.slice(0, 3);

      const [genreResults, trendingRes, discoverRes] = await Promise.all([
        Promise.allSettled(
          primaryGenres.map((g) => musicApi.search(g.query, 'songs', 10))
        ),
        musicApi.search('trending music hits popular songs', 'songs', 8).catch(() => null),
        musicApi.search(discoverGenre.query, 'songs', 8).catch(() => null),
      ]);

      const seenIds = new Set<string>();
      const mfy: Track[] = [];
      const shelves: GenreShelfData[] = [];

      genreResults.forEach((result, idx) => {
        const genreDef = primaryGenres[idx];
        if (result.status === 'fulfilled' && result.value.tracks.length > 0) {
          const allTracks = result.value.tracks;
          let addedToMfy = 0;
          const shelfTracks: Track[] = [];

          for (const t of allTracks) {
            if (addedToMfy < 2 && !seenIds.has(t.providerId)) {
              mfy.push(t);
              seenIds.add(t.providerId);
              addedToMfy++;
            } else if (!seenIds.has(t.providerId) && shelfTracks.length < 6) {
              shelfTracks.push(t);
              seenIds.add(t.providerId);
            }
          }

          if (shelfTracks.length > 0) {
            shelves.push({ genre: genreDef, tracks: shelfTracks });
          } else if (allTracks.length > 0) {
            shelves.push({ genre: genreDef, tracks: allTracks.slice(0, 6) });
          }
        }
      });

      const uniqueTrending = (trendingRes?.tracks || [])
        .filter((t) => {
          if (seenIds.has(t.providerId)) return false;
          seenIds.add(t.providerId);
          return true;
        })
        .slice(0, 6);

      const uniqueDiscover = (discoverRes?.tracks || [])
        .filter((t) => {
          if (seenIds.has(t.providerId)) return false;
          seenIds.add(t.providerId);
          return true;
        })
        .slice(0, 6);

      if (mfy.length === 0 && shelves.length === 0 && uniqueTrending.length === 0) {
        setError('Music is temporarily unavailable. Please try again.');
      } else {
        setMadeForYouTracks(mfy);
        setGenreShelves(shelves);
        setTrendingTracks(uniqueTrending);
        setDiscoverTracks(uniqueDiscover);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Music is temporarily unavailable.'));
    } finally {
      setLoading(false);
    }
  }, [activeGenres, discoverGenre.query]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Deduplicated recent history tracks (only shown when user is authenticated and has real history)
  const recentTracks = useMemo(() => {
    if (!user) return [];
    const seen = new Set<string>();
    const list: Track[] = [];
    for (const item of history) {
      if (!seen.has(item.providerId)) {
        seen.add(item.providerId);
        list.push(item);
      }
      if (list.length >= 6) break;
    }
    return list;
  }, [history, user]);

  return (
    <div className="space-y-8">
      {/* Top Hero Banner — Distinct Experience for Logged-Out Guests vs Authenticated Users */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <h1
            className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            {user ? `Welcome back, ${user.displayName}` : 'Stream & discover music'}
          </h1>
          <p className="text-sm text-slate-300">
            {user
              ? hasPersonalPreferences
                ? 'Personalized mixes and recommendations tuned to the genres you love.'
                : 'Explore songs, artists, and mixes tailored to every mood.'
              : 'Browse live songs, artists, and genres instantly—or sign in to save playlists, liked songs, and personalized recommendations.'}
          </p>

          {/* Active Taste Pills for Authenticated Users */}
          {user && (
            <div className="flex items-center flex-wrap gap-2 pt-1">
              {hasPersonalPreferences ? (
                <>
                  {activeGenres.map((g) => (
                    <Link
                      key={g.id}
                      to={`/search?q=${encodeURIComponent(g.query)}`}
                      className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-colors"
                    >
                      {g.label}
                    </Link>
                  ))}
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Edit taste</span>
                  </Link>
                </>
              ) : (
                <Link
                  to="/onboarding"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Choose your music taste</span>
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>Browse & Search</span>
          </Link>
        </div>
      </section>

      {/* Loading / Error States */}
      {loading ? (
        <div className="space-y-6" aria-label="Loading recommendations">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-xl p-3 bg-slate-900/50 border border-slate-800/60 animate-pulse space-y-3"
              >
                <div className="aspect-square rounded-lg bg-slate-800" />
                <div className="h-3.5 w-3/4 rounded bg-slate-800" />
                <div className="h-2.5 w-1/2 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="p-6 rounded-xl bg-slate-900/60 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">
                Music is temporarily unavailable
              </h3>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadRecommendations}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {/* 1. Made for You / Featured Picks */}
          {madeForYouTracks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <span>
                      {hasPersonalPreferences ? 'Made for You' : 'Featured Picks'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    {hasPersonalPreferences
                      ? `Curated from ${activeGenres.map((g) => g.label).join(', ')}`
                      : 'Popular tracks across top genres'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {madeForYouTracks.map((track) => (
                  <MusicCard
                    key={track.providerId}
                    track={track}
                    queueContext={madeForYouTracks}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 2. Genre Mixes */}
          {genreShelves.map((shelf) => (
            <section key={shelf.genre.id} className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Disc3 className="w-5 h-5 text-emerald-400" />
                    <span>{shelf.genre.mixTitle}</span>
                  </h2>
                  <p className="text-xs text-slate-400">{shelf.genre.subtitle}</p>
                </div>
                <Link
                  to={`/search?q=${encodeURIComponent(shelf.genre.query)}`}
                  className="text-xs font-medium text-emerald-400 hover:underline shrink-0"
                >
                  See all
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {shelf.tracks.map((track) => (
                  <MusicCard
                    key={track.providerId}
                    track={track}
                    queueContext={shelf.tracks}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* 3. Recently Played (ONLY shown when user is authenticated and has real history) */}
          {recentTracks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-400" />
                    <span>Recently Played</span>
                  </h2>
                  <p className="text-xs text-slate-400">Jump back into your recent sessions</p>
                </div>
                <Link
                  to="/history"
                  className="text-xs font-medium text-emerald-400 hover:underline shrink-0"
                >
                  View history
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {recentTracks.map((track) => (
                  <MusicCard
                    key={track.providerId}
                    track={track}
                    queueContext={recentTracks}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 4. Trending Music */}
          {trendingTracks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <span>Trending Music</span>
                  </h2>
                  <p className="text-xs text-slate-400">Tracks gaining momentum right now</p>
                </div>
                <Link
                  to="/search?q=trending+music+hits"
                  className="text-xs font-medium text-emerald-400 hover:underline shrink-0"
                >
                  Explore trending
                </Link>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2 space-y-0.5">
                {trendingTracks.map((track, idx) => (
                  <TrackRow
                    key={track.providerId}
                    track={track}
                    index={idx}
                    queueContext={trendingTracks}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 5. Discover Something New */}
          {discoverTracks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-emerald-400" />
                    <span>Discover Something New</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Step outside your routine with {discoverGenre.label}
                  </p>
                </div>
                <Link
                  to={`/search?q=${encodeURIComponent(discoverGenre.query)}`}
                  className="text-xs font-medium text-emerald-400 hover:underline shrink-0"
                >
                  More {discoverGenre.label}
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {discoverTracks.map((track) => (
                  <MusicCard
                    key={track.providerId}
                    track={track}
                    queueContext={discoverTracks}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
