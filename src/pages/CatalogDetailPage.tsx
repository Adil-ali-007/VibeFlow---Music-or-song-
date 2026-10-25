import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Disc, Mic2 } from 'lucide-react';
import { extractErrorMessage, musicApi } from '../services/api';
import type { Track } from '../types';
import { TrackRow } from '../components/TrackRow';

export function CatalogDetailPage() {
  const { type, name } = useParams<{ type: string; name: string }>();
  const decodedName = decodeURIComponent(name || '');
  const isArtist = type === 'artist';

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!decodedName) return;
    let active = true;
    async function loadCatalog() {
      setLoading(true);
      setError(null);
      try {
        const res = await musicApi.search(decodedName, 'songs', 20);
        if (active) setTracks(res.tracks);
      } catch (err) {
        if (active) setError(extractErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadCatalog();
    return () => {
      active = false;
    };
  }, [decodedName]);

  return (
    <div className="space-y-6">
      <Link
        to="/search"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Search</span>
      </Link>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          {isArtist ? (
            <Mic2 className="w-7 h-7 text-emerald-400" />
          ) : (
            <Disc className="w-7 h-7 text-emerald-400" />
          )}
        </div>
        <div>
          <p className="text-xs text-slate-400">{isArtist ? 'Artist' : 'Album'}</p>
          <h1 className="text-2xl font-bold text-white">{decodedName}</h1>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-900/50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      ) : tracks.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
          No songs found
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2 space-y-0.5">
          {tracks.map((track, idx) => (
            <TrackRow
              key={track.providerId}
              track={track}
              index={idx}
              queueContext={tracks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
