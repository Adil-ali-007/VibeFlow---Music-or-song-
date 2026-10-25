// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../App';
import { SearchPage } from '../pages/SearchPage';
import { LoginPage, RegisterPage } from '../pages/AuthPages';
import { OnboardingPage } from '../pages/OnboardingPage';
import { MusicPlayer } from '../components/MusicPlayer';
import { authApi, musicApi, resolveApiBaseUrl } from '../services/api';
import type { Track, User } from '../types';

afterEach(() => {
  cleanup();
});

let mockAuthState = {
  user: null as User | null,
  loading: false,
  setUser: vi.fn(),
  refreshUser: vi.fn(),
  logout: vi.fn(),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../context/LibraryContext', () => ({
  useLibrary: () => ({
    playlists: [],
    favorites: [],
    history: [],
    loadingLibrary: false,
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
    createPlaylist: vi.fn(),
    deletePlaylist: vi.fn(),
    addTrackToPlaylist: vi.fn(),
    removeTrackFromPlaylist: vi.fn(),
    recordListeningEvent: vi.fn(),
    clearHistory: vi.fn(),
    refreshLibrary: vi.fn(),
  }),
}));

const mockTrack: Track = {
  providerId: 'FGBhQbmPwH8',
  title: 'One More Time',
  artistName: 'Daft Punk',
  artists: [{ id: 'UC_daft', name: 'Daft Punk' }],
  album: { id: 'MPREb_discovery', name: 'Discovery' },
  durationSeconds: 320,
  durationFormatted: '5:20',
  thumbnailUrl: 'https://i.ytimg.com/vi/FGBhQbmPwH8/hqdefault.jpg',
  isExplicit: false,
  playbackType: 'YOUTUBE_EMBED',
  embedUrl: 'https://www.youtube.com/embed/FGBhQbmPwH8?enablejsapi=1',
  externalUrl: 'https://music.youtube.com/watch?v=FGBhQbmPwH8',
};

let mockPlayerState = {
  currentTrack: null as Track | null,
  queue: [] as Track[],
  currentIndex: -1,
  isPlaying: false,
  isBuffering: false,
  playbackError: null as string | null,
  repeatMode: 'off' as 'off' | 'all' | 'one',
  shuffle: false,
  playTrack: vi.fn(),
  togglePlayPause: vi.fn(),
  playNext: vi.fn(),
  playPrevious: vi.fn(),
  setRepeatMode: vi.fn(),
  setShuffle: vi.fn(),
  setIsPlaying: vi.fn(),
  setIsBuffering: vi.fn(),
  setPlaybackError: vi.fn(),
};

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => mockPlayerState,
}));

describe('VibeFlow Frontend Component & Security Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthState = {
      user: null,
      loading: false,
      setUser: vi.fn(),
      refreshUser: vi.fn(),
      logout: vi.fn(),
    };
    mockPlayerState = {
      ...mockPlayerState,
      currentTrack: null,
      playbackError: null,
      isPlaying: false,
    };
  });

  it('normalizes API base URL safely across local, unified, and remote origins', () => {
    expect(resolveApiBaseUrl('')).toBe('/api');
    expect(resolveApiBaseUrl('/api')).toBe('/api');
    expect(resolveApiBaseUrl('https://api.vibeflow.example.com')).toBe(
      'https://api.vibeflow.example.com/api'
    );
  });

  it('redirects unauthenticated guests from ProtectedRoute to /login', () => {
    mockAuthState.user = null;

    render(
      <MemoryRouter initialEntries={['/playlists']}>
        <Routes>
          <Route
            path="/playlists"
            element={
              <ProtectedRoute>
                <div>Private Playlists Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page Redirect Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Private Playlists Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page Redirect Target')).toBeInTheDocument();
  });

  it('blocks non-admin authenticated users from requireAdmin routes', () => {
    mockAuthState.user = {
      id: 'u1',
      email: 'user@vibeflow.test',
      displayName: 'Normal Listener',
      role: 'user',
      authProviders: ['local'],
      musicPreferences: ['lofi', 'pop', 'rock'],
      onboardingCompleted: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <div>Secret Admin Console</div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>Public Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Secret Admin Console')).not.toBeInTheDocument();
    expect(screen.getByText('Public Home Page')).toBeInTheDocument();
  });

  it('renders SearchPage Browse All categories and executes debounced live search', async () => {
    const searchSpy = vi.spyOn(musicApi, 'search').mockResolvedValue({
      query: 'Daft Punk',
      filter: 'songs',
      tracks: [mockTrack],
      albums: [],
      artists: [],
    });

    render(
      <MemoryRouter initialEntries={['/search']}>
        <SearchPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Browse All/i)).toBeInTheDocument();
    expect(screen.getByText(/Find your next favorite track/i)).toBeInTheDocument();
    expect(screen.getByText('Lo-fi')).toBeInTheDocument();
    expect(screen.getByText('Punjabi')).toBeInTheDocument();

    const input = screen.getByLabelText(/Search music catalog/i);
    fireEvent.change(input, { target: { value: 'Daft Punk' } });

    await waitFor(
      () => {
        expect(searchSpy).toHaveBeenCalledWith(
          'Daft Punk',
          'songs',
          20,
          expect.any(AbortSignal)
        );
      },
      { timeout: 1500 }
    );

    expect(await screen.findByText('One More Time')).toBeInTheDocument();
    expect(screen.getByText('Daft Punk')).toBeInTheDocument();
  });

  it('triggers a category search when clicking a Browse All category card', async () => {
    const searchSpy = vi.spyOn(musicApi, 'search').mockResolvedValue({
      query: 'lofi chill beats study',
      filter: 'songs',
      tracks: [mockTrack],
      albums: [],
      artists: [],
    });

    render(
      <MemoryRouter initialEntries={['/search']}>
        <SearchPage />
      </MemoryRouter>
    );

    const lofiCard = screen.getByRole('button', { name: /Lo-fi/i });
    fireEvent.click(lofiCard);

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith(
        'lofi chill beats study',
        'songs',
        20,
        expect.any(AbortSignal)
      );
    });
  });

  it('renders empty search results state when provider returns no matches', async () => {
    vi.spyOn(musicApi, 'search').mockResolvedValue({
      query: 'nonexistentxyz123',
      filter: 'songs',
      tracks: [],
      albums: [],
      artists: [],
    });

    render(
      <MemoryRouter initialEntries={['/search']}>
        <SearchPage />
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/Search music catalog/i);
    fireEvent.change(input, { target: { value: 'nonexistentxyz123' } });

    await waitFor(() => {
      expect(screen.getByText(/No songs found/i)).toBeInTheDocument();
    });
  });

  it('displays explicit error state on SearchPage when provider fails without fake results', async () => {
    vi.spyOn(musicApi, 'search').mockRejectedValue(
      new Error('Music discovery service is unreachable.')
    );

    render(
      <MemoryRouter initialEntries={['/search']}>
        <SearchPage />
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/Search music catalog/i);
    fireEvent.change(input, { target: { value: 'Nujabes' } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Couldn't load results\. Try again\./i);
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Music is temporarily unavailable/i
      );
    });
  });

  it('validates LoginPage and RegisterPage email/password forms and confirms no Google login button exists', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // Confirm no Google login button is present on LoginPage
    expect(screen.queryByText(/Continue with Google/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Google/i })).not.toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Please enter a valid email/i);

    unmount();

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Confirm no Google login button is present on RegisterPage
    expect(screen.queryByText(/Continue with Google/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Google/i })).not.toBeInTheDocument();

    const createBtn = screen.getByRole('button', { name: /Create Account/i });
    fireEvent.click(createBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Display name must be at least 2 characters/i
    );
  });

  it('enforces selecting at least 3 genres on OnboardingPage before enabling Continue', async () => {
    const updatePrefsSpy = vi.spyOn(authApi, 'updatePreferences').mockResolvedValue({
      musicPreferences: ['lofi', 'hindi', 'punjabi'],
      onboardingCompleted: true,
      user: {
        id: 'u1',
        email: 'listener@vibeflow.test',
        displayName: 'Alex',
        role: 'user',
        authProviders: ['local'],
        musicPreferences: ['lofi', 'hindi', 'punjabi'],
        onboardingCompleted: true,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    });

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <OnboardingPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/What do you love listening to\?/i)).toBeInTheDocument();
    const continueBtn = screen.getByRole('button', { name: /^Continue$/i });
    expect(continueBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Lo-fi/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hindi/i }));
    expect(continueBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Punjabi/i }));
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
    expect(continueBtn).not.toBeDisabled();

    fireEvent.click(continueBtn);
    await waitFor(() => {
      expect(updatePrefsSpy).toHaveBeenCalledWith({
        musicPreferences: ['lofi', 'hindi', 'punjabi'],
        onboardingCompleted: true,
      });
    });
  });

  it('renders MusicPlayer active track metadata and external YouTube Music fallback link on error', () => {
    mockPlayerState.currentTrack = mockTrack;
    mockPlayerState.playbackError = "This track can't be played right now";

    render(
      <MemoryRouter>
        <MusicPlayer />
      </MemoryRouter>
    );

    expect(screen.getByText('One More Time')).toBeInTheDocument();
    expect(screen.getByText(/This track can't be played right now/i)).toBeInTheDocument();
    const externalLink = screen.getByRole('link', { name: /Listen on YouTube Music/i });
    expect(externalLink).toHaveAttribute(
      'href',
      'https://music.youtube.com/watch?v=FGBhQbmPwH8'
    );
  });
});
