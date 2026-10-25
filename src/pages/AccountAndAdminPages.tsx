import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Database,
  Lock,
  LogOut,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { ONBOARDING_GENRES } from '../constants/musicCatalog';
import { useAuth } from '../context/AuthContext';
import { adminApi, authApi, extractErrorMessage } from '../services/api';
import type { AdminOverviewData } from '../types';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedGenres, setSelectedGenres] = useState<string[]>(() =>
    Array.isArray(user?.musicPreferences) ? user.musicPreferences : []
  );
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      if (Array.isArray(user.musicPreferences)) {
        setSelectedGenres(user.musicPreferences);
      }
    }
  }, [user]);

  const togglePreferenceGenre = (genreId: string) => {
    setPrefsError(null);
    setPrefsMessage(null);
    setSelectedGenres((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSavePreferences = async () => {
    setPrefsError(null);
    setPrefsMessage(null);

    if (selectedGenres.length > 0 && selectedGenres.length < 3) {
      setPrefsError('Please select at least 3 genres to personalize your recommendations.');
      return;
    }

    setSavingPrefs(true);
    try {
      const res = await authApi.updatePreferences({
        musicPreferences: selectedGenres,
        onboardingCompleted: true,
        skip: selectedGenres.length === 0,
      });
      if (res.user) {
        setUser(res.user);
      }
      setPrefsMessage('Music preferences saved. Your Home recommendations have been updated.');
    } catch (err) {
      setPrefsError(extractErrorMessage(err, 'Could not save music preferences.'));
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (displayName.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      const payload: {
        displayName?: string;
        currentPassword?: string;
        newPassword?: string;
      } = {
        displayName: displayName.trim(),
      };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const updated = await authApi.updateProfile(payload);
      setUser(updated);
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Settings saved.');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Account Settings</h1>

      {/* Account Overview */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">
              {user?.displayName || ''}
            </h2>
            <p className="text-xs text-slate-400 truncate">
              {user?.email || ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-300 border border-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Music Preferences Section */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Music Preferences</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select at least 3 genres to customize your Home recommendations.
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-400">
            {selectedGenres.length} selected
          </span>
        </div>

        {prefsError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{prefsError}</span>
          </div>
        )}

        {prefsMessage && (
          <div
            role="status"
            className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{prefsMessage}</span>
          </div>
        )}

        <div
          role="group"
          aria-label="Music preference genres"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5"
        >
          {ONBOARDING_GENRES.map((genre) => {
            const isSelected = selectedGenres.includes(genre.id);
            return (
              <button
                key={genre.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => togglePreferenceGenre(genre.id)}
                className={`px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between gap-2 transition-all ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-400 text-white font-semibold'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span className="truncate">{genre.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-slate-400">
            {selectedGenres.length > 0 && selectedGenres.length < 3
              ? `Pick ${3 - selectedGenres.length} more ${3 - selectedGenres.length === 1 ? 'genre' : 'genres'} to save.`
              : 'Changes apply immediately to your Home mixes.'}
          </p>
          <button
            type="button"
            disabled={savingPrefs || (selectedGenres.length > 0 && selectedGenres.length < 3)}
            onClick={handleSavePreferences}
            className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-semibold text-xs transition-colors shrink-0"
          >
            {savingPrefs ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </section>

      {/* Update Profile & Password Form */}
      <form
        onSubmit={handleSave}
        className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5"
      >
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Profile & Password</span>
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

        {message && (
          <div
            role="status"
            className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="settings-name" className="block text-xs font-medium text-slate-300">
            Name
          </label>
          <input
            id="settings-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            required
            className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="pt-2 border-t border-slate-800/80 space-y-4">
          <p className="text-xs text-slate-400">
            Leave the password fields blank if you don&apos;t want to change your password.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="current-pass" className="block text-xs font-medium text-slate-300">
                Current Password
              </label>
              <input
                id="current-pass"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-pass" className="block text-xs font-medium text-slate-300">
                New Password
              </label>
              <input
                id="new-pass"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await adminApi.getOverview();
      setData(overview);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handleToggleUserActive = async (targetId: string, currentActive: boolean) => {
    setUpdatingUserId(targetId);
    setError(null);
    try {
      const updatedUser = await adminApi.updateUserStatus(targetId, !currentActive);
      setData((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) => (u.id === targetId ? updatedUser : u)),
            }
          : prev
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl bg-slate-900/50 animate-pulse" />
        <div className="h-64 rounded-2xl bg-slate-900/50 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          className="px-3 py-1.5 rounded bg-slate-800 text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <span>Admin Console</span>
        </h1>

        <button
          type="button"
          onClick={loadOverview}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-white whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Counts */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Users</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
            {data.counts.users}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Admins</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {data.counts.admins}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Playlists</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
            {data.counts.playlists}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Liked Songs</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
            {data.counts.favorites}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Plays</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
            {data.counts.historyEvents}
          </p>
        </div>
      </section>

      {/* Service Status */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Library Storage</span>
          </span>
          <span className="text-xs font-mono text-emerald-400">
            {data.services.database.connected ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Music Catalog</span>
          </span>
          <span
            className={`text-xs font-mono ${
              data.services.musicProvider.reachable ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {data.services.musicProvider.reachable ? 'Online' : 'Offline'}
          </span>
        </div>
      </section>

      {/* Users Table */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Accounts</h2>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            {data.users.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                <th className="py-3 px-4 font-medium">Name</th>
                <th className="py-3 px-4 font-medium">Email</th>
                <th className="py-3 px-4 font-medium">Role</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-medium text-white">{u.displayName}</td>
                  <td className="py-3 px-4 text-slate-300 font-mono">{u.email}</td>
                  <td className="py-3 px-4 text-slate-300 capitalize">{u.role}</td>
                  <td className="py-3 px-4">
                    <span className={u.isActive ? 'text-emerald-400' : 'text-rose-400'}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.role !== 'admin' && u.id !== user?.id ? (
                      <button
                        type="button"
                        disabled={updatingUserId === u.id}
                        onClick={() => handleToggleUserActive(u.id, u.isActive)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                      >
                        {u.isActive ? 'Suspend' : 'Reactivate'}
                      </button>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="py-16 text-center space-y-4">
      <p className="font-mono text-sm text-emerald-400">404</p>
      <h1 className="text-3xl font-bold text-white">Page not found</h1>
      <p className="text-xs text-slate-400 max-w-md mx-auto">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <div className="pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
