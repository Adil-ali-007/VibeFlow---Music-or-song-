import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, extractErrorMessage } from '../services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();

  const fromPath = (location.state as { from?: string } | null)?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const isComplete =
        Boolean(user.onboardingCompleted) ||
        (Array.isArray(user.musicPreferences) && user.musicPreferences.length >= 3);
      navigate(isComplete ? fromPath : '/onboarding', { replace: true });
    }
  }, [user, navigate, fromPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedInUser = await authApi.login({
        email: email.trim().toLowerCase(),
        password,
      });
      setUser(loggedInUser);
      const isComplete =
        Boolean(loggedInUser.onboardingCompleted) ||
        (Array.isArray(loggedInUser.musicPreferences) && loggedInUser.musicPreferences.length >= 3);
      navigate(isComplete ? fromPath : '/onboarding', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Sign in</h1>
          <p className="text-xs text-slate-400">
            Access your playlists, liked songs, and listening history.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-rose-950/50 border border-rose-500/30 text-xs text-rose-200"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-xs font-medium text-slate-300">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-400 pt-1">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-emerald-400 hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const isComplete =
        Boolean(user.onboardingCompleted) ||
        (Array.isArray(user.musicPreferences) && user.musicPreferences.length >= 3);
      navigate(isComplete ? '/' : '/onboarding', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }

    setSubmitting(true);
    try {
      const createdUser = await authApi.register({
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setUser(createdUser);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not create account.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-xs text-slate-400">
            Save playlists, liked songs, and your personalized music mixes.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-rose-950/50 border border-rose-500/30 text-xs text-rose-200"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="block text-xs font-medium text-slate-300">
              Name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="reg-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-xs font-medium text-slate-300">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters with letter & number"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-400 pt-1">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
