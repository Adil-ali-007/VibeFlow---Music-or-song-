import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LibraryProvider } from './context/LibraryContext';
import { PlayerProvider } from './context/PlayerContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { OnboardingPage } from './pages/OnboardingPage';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { TrackDetailPage } from './pages/TrackDetailPage';
import { CatalogDetailPage } from './pages/CatalogDetailPage';
import {
  FavoritesPage,
  HistoryPage,
  PlaylistDetailPage,
  PlaylistsPage,
} from './pages/LibraryPages';
import {
  AdminDashboardPage,
  NotFoundPage,
  SettingsPage,
} from './pages/AccountAndAdminPages';

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-slate-400">
        Verifying session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public Guest & Authenticated Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/tracks/:providerId" element={<TrackDetailPage />} />
        <Route path="/catalog/:type/:name" element={<CatalogDetailPage />} />

        {/* Authenticated User Routes */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/playlists"
          element={
            <ProtectedRoute>
              <PlaylistsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/playlists/:id"
          element={
            <ProtectedRoute>
              <PlaylistDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/favorites"
          element={
            <ProtectedRoute>
              <FavoritesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Server-Verified Administrator Route */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LibraryProvider>
          <PlayerProvider>
            <AppRoutes />
          </PlayerProvider>
        </LibraryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
