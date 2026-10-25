import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Disc,
  Disc3,
  ListMusic,
  Mic2,
  Music2,
  RefreshCw,
  Search as SearchIcon,
  X,
} from 'lucide-react';
import axios from 'axios';
import { BROWSE_CATEGORIES, type GenreDefinition } from '../constants/musicCatalog';
import { useLibrary } from '../context/LibraryContext';
import { extractErrorMessage, musicApi } from '../services/api';
import type { SearchResultData } from '../types';
import { TrackRow } from '../components/TrackRow';

type FilterType = 'songs' | 'albums' | 'artists' | 'all' | 'playlists';

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'songs', label: 'Songs' },
  { id: 'artists', label: 'Artists' },
  { id: 'albums', label: 'Albums' },
  { id: 'playlists', label: 'Playlists' },
];

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { playlists } = useLibrary();

  const initialQuery = searchParams.get('q') || '';
  const initialFilter = (searchParams.get('filter') as FilterType) || 'songs';

  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterType>(
    ['songs', 'albums', 'artists', 'all', 'playlists'].includes(initialFilter)
      ? initialFilter
      : 'songs'
  );
  const [activeCategory, setActiveCategory] = useState<GenreDefinition | null>(null);
  const [results, setResults] = useState<SearchResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic request sequence and AbortController to prevent stale responses from overwriting newer queries
  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeSearch = useCallback(async (qToRun: string, filterToRun: FilterType) => {
    const trimmed = qToRun.trim();
    if (!trimmed) {
      abortControllerRef.current?.abort();
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++requestSeqRef.current;

    setLoading(true);
    setError(null);
    try {
      const apiFilter: 'songs' | 'albums' | 'artists' | 'all' =
        filterToRun === 'playlists' ? 'all' : filterToRun;
      const data = await musicApi.search(trimmed, apiFilter, 20, controller.signal);
      if (seq !== requestSeqRef.current) return;
      setResults(data);
    } catch (err) {
      if (axios.isCancel(err) || (err instanceof Error && err.name === 'CanceledError')) {
        return;
      }
      if (seq !== requestSeqRef.current) return;
      setError(extractErrorMessage(err, "Couldn't load results. Try again."));
      setResults(null);
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Debounce user typing (350ms) and abort on unmount
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      abortControllerRef.current?.abort();
      setResults(null);
      setError(null);
      setLoading(false);
      setActiveCategory(null);
      return;
    }

    const timer = setTimeout(() => {
      const apiFilterParam = filter === 'playlists' ? 'all' : filter;
      setSearchParams({ q: trimmed, filter: apiFilterParam }, { replace: true });
      executeSearch(trimmed, filter);
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [query, filter, executeSearch, setSearchParams]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const apiFilterParam = filter === 'playlists' ? 'all' : filter;
      setSearchParams({ q: query.trim(), filter: apiFilterParam }, { replace: true });
      executeSearch(query.trim(), filter);
    }
  };

  const handleSelectCategory = (cat: GenreDefinition) => {
    setActiveCategory(cat);
    setQuery(cat.query);
    setSearchParams({ q: cat.query, filter: filter === 'playlists' ? 'all' : filter }, { replace: true });
    executeSearch(cat.query, filter);
  };

  const handleClearSearch = () => {
    setQuery('');
    setActiveCategory(null);
    setResults(null);
    setError(null);
    setSearchParams({}, { replace: true });
  };

  const matchingPlaylists = query.trim()
    ? playlists.filter(
        (pl) =>
          pl.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          pl.description.toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];

  const showSongs = filter === 'all' || filter === 'songs';
  const showAlbums = filter === 'all' || filter === 'albums';
  const showArtists = filter === 'all' || filter === 'artists';
  const showPlaylists = filter === 'all' || filter === 'playlists';

  const hasAnyResults =
    results &&
    ((showSongs && results.tracks.length > 0) ||
      (showAlbums && results.albums.length > 0) ||
      (showArtists && results.artists.length > 0) ||
      (showPlaylists && matchingPlaylists.length > 0));

  return (
    <div className="space-y-6">
      {/* Header & Search Input */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white tracking-tight">Search</h1>
          {activeCategory && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Browse All</span>
            </button>
          )}
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="relative">
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (activeCategory && e.target.value !== activeCategory.query) {
                  setActiveCategory(null);
                }
              }}
              placeholder="What do you want to listen to?"
              aria-label="Search music catalog"
              maxLength={120}
              className="w-full pl-11 pr-10 py-3.5 rounded-full bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search query"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div
              role="tablist"
              aria-label="Search result filter"
              className="flex items-center gap-2 overflow-x-auto pb-1"
            >
              {FILTER_TABS.map((tab) => {
                const isSelected = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setFilter(tab.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </div>

      {/* Active Category Banner when clicked from Browse All */}
      {activeCategory && query.trim() && (
        <div
          className={`rounded-2xl p-5 sm:p-6 bg-gradient-to-r ${activeCategory.gradient} border border-white/10 flex items-center justify-between gap-4`}
        >
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
              Category
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{activeCategory.label}</h2>
            <p className="text-xs text-white/80">{activeCategory.subtitle}</p>
          </div>
          <Music2 className="w-10 h-10 text-white/25 shrink-0" />
        </div>
      )}

      {/* States: Browse All (Idle), Loading, Error, No Results, Populated */}
      {!query.trim() ? (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <h2 className="text-lg font-bold text-white tracking-tight">Browse All</h2>
            <p className="text-xs text-slate-400">Find your next favorite track</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {BROWSE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat)}
                className={`group relative overflow-hidden rounded-2xl p-4 sm:p-5 h-28 sm:h-32 text-left bg-gradient-to-br ${cat.gradient} border border-white/10 hover:border-white/25 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between shadow-md`}
              >
                <span className="text-base sm:text-lg font-bold text-white tracking-tight z-10">
                  {cat.label}
                </span>
                <span className="text-[11px] text-white/75 line-clamp-1 z-10 max-w-[85%]">
                  {cat.subtitle}
                </span>
                <Disc3 className="w-16 h-16 text-white/15 absolute -bottom-3 -right-3 rotate-12 group-hover:scale-110 group-hover:rotate-45 transition-transform duration-300 pointer-events-none" />
              </button>
            ))}
          </div>
        </section>
      ) : loading ? (
        <div className="space-y-2" aria-label="Searching catalog">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-14 rounded-lg bg-slate-900/50 border border-slate-800/60 animate-pulse px-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-slate-800" />
                <div className="space-y-1.5">
                  <div className="w-44 h-3.5 rounded bg-slate-800" />
                  <div className="w-28 h-2.5 rounded bg-slate-800" />
                </div>
              </div>
              <div className="w-10 h-3 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="p-6 rounded-xl bg-slate-900/60 border border-rose-500/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">
                Couldn&apos;t load results. Try again.
              </h3>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => executeSearch(query, filter)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
        </div>
      ) : results && !hasAnyResults ? (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-200">No songs found</p>
          <p className="text-xs text-slate-400">
            Try a different search term or choose another filter.
          </p>
          <button
            type="button"
            onClick={handleClearSearch}
            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white"
          >
            <span>Browse all categories</span>
          </button>
        </div>
      ) : (
        results && (
          <div className="space-y-8">
            {showSongs && results.tracks.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-bold text-white">
                  Songs ({results.tracks.length})
                </h2>
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2 space-y-0.5">
                  {results.tracks.map((track, idx) => (
                    <TrackRow
                      key={track.providerId}
                      track={track}
                      index={idx}
                      queueContext={results.tracks}
                    />
                  ))}
                </div>
              </section>
            )}

            {showArtists && results.artists.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-bold text-white">
                  Artists ({results.artists.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {results.artists.map((artist) => (
                    <Link
                      key={artist.providerId}
                      to={`/catalog/artist/${encodeURIComponent(artist.name)}`}
                      className="p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 transition-colors flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center">
                        {artist.thumbnailUrl ? (
                          <img
                            src={artist.thumbnailUrl}
                            alt={artist.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Mic2 className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{artist.name}</p>
                        <p className="text-xs text-slate-400">Artist</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {showAlbums && results.albums.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-bold text-white">
                  Albums ({results.albums.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {results.albums.map((album) => (
                    <Link
                      key={album.providerId}
                      to={`/catalog/album/${encodeURIComponent(album.title)}`}
                      className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 transition-colors space-y-2.5"
                    >
                      <div className="aspect-square rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center">
                        {album.thumbnailUrl ? (
                          <img
                            src={album.thumbnailUrl}
                            alt={album.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Disc className="w-8 h-8 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white truncate">{album.title}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {album.artistName}
                          {album.year ? ` · ${album.year}` : ''}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {showPlaylists && matchingPlaylists.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-bold text-white">
                  Playlists ({matchingPlaylists.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {matchingPlaylists.map((pl) => (
                    <Link
                      key={pl._id}
                      to={`/playlists/${pl._id}`}
                      className="p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {pl.tracks.length} {pl.tracks.length === 1 ? 'song' : 'songs'}
                        </p>
                      </div>
                      <ListMusic className="w-5 h-5 text-emerald-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )
      )}
    </div>
  );
}
