import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Disc3, Sparkles } from 'lucide-react';
import { ONBOARDING_GENRES } from '../constants/musicCatalog';
import { useAuth } from '../context/AuthContext';
import { authApi, extractErrorMessage } from '../services/api';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [selected, setSelected] = useState<string[]>(() =>
    Array.isArray(user?.musicPreferences) ? user.musicPreferences : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Array.isArray(user?.musicPreferences) && user.musicPreferences.length > 0 && selected.length === 0) {
      setSelected(user.musicPreferences);
    }
  }, [user?.musicPreferences, selected.length]);

  const toggleGenre = (genreId: string) => {
    setError(null);
    setSelected((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const canContinue = selected.length >= 3;

  const handleContinue = async () => {
    if (!canContinue) {
      setError('Please select at least 3 genres to continue.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authApi.updatePreferences({
        musicPreferences: selected,
        onboardingCompleted: true,
      });
      if (res.user) {
        setUser(res.user);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save your preferences. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authApi.updatePreferences({
        musicPreferences: [],
        onboardingCompleted: true,
        skip: true,
      });
      if (res.user) {
        setUser(res.user);
      }
      navigate('/', { replace: true });
    } catch {
      navigate('/', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personalize Your Music</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            What do you love listening to?
          </h1>
          <p className="text-sm text-slate-300">
            Pick at least 3 genres to personalize your VibeFlow experience.
          </p>
        </div>

        {/* Live Selection Counter */}
        <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
          <div
            aria-live="polite"
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              canContinue
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            {selected.length} selected
            {!canContinue ? ` (${3 - selected.length} more needed)` : ''}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selectable Genre Grid */}
      <div
        role="group"
        aria-label="Music genres"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5"
      >
        {ONBOARDING_GENRES.map((genre) => {
          const isSelected = selected.includes(genre.id);
          return (
            <button
              key={genre.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggleGenre(genre.id)}
              className={`group relative overflow-hidden rounded-2xl p-4 sm:p-5 text-left transition-all duration-200 min-h-[104px] flex flex-col justify-between border ${
                isSelected
                  ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-[1.01] shadow-lg shadow-emerald-950/50'
                  : 'border-slate-800/80 hover:border-slate-600 hover:-translate-y-0.5'
              } bg-gradient-to-br ${genre.gradient}`}
            >
              <div className="flex items-start justify-between gap-2 w-full z-10">
                <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {genre.label}
                </span>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-emerald-400 text-slate-950 shadow-sm'
                      : 'bg-black/30 text-white/60 border border-white/20 group-hover:border-white/40'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </span>
              </div>

              <p className="text-[11px] text-white/75 line-clamp-1 z-10 mt-3">
                {genre.subtitle}
              </p>

              <Disc3 className="w-16 h-16 text-white/10 absolute -bottom-3 -right-3 rotate-12 group-hover:scale-110 transition-transform pointer-events-none" />
            </button>
          );
        })}
      </div>

      {/* Bottom Action Bar */}
      <div className="sticky bottom-20 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
        <div className="text-xs text-slate-300">
          {canContinue
            ? `Great taste! You've selected ${selected.length} genres.`
            : `Select ${3 - selected.length} more ${3 - selected.length === 1 ? 'genre' : 'genres'} to unlock personalized mixes.`}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSkip}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            Skip for now
          </button>

          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={handleContinue}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs sm:text-sm transition-colors"
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
