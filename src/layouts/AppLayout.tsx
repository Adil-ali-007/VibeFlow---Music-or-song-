import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Compass,
  Heart,
  History,
  ListMusic,
  LogIn,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { MusicPlayer } from '../components/MusicPlayer';

export function AppLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { playlists } = useLibrary();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
    }`;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col pb-20">
      {/* Top Bar following the strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-20 h-16 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          VibeFlow
        </Link>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                isActive ? 'text-emerald-400 underline underline-offset-8' : ''
              }`
            }
          >
            Discover
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                isActive ? 'text-emerald-400 underline underline-offset-8' : ''
              }`
            }
          >
            Search
          </NavLink>
          {user && (
            <>
              <NavLink
                to="/playlists"
                className={({ isActive }) =>
                  `hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'text-emerald-400 underline underline-offset-8' : ''
                  }`
                }
              >
                Playlists
              </NavLink>
              <NavLink
                to="/favorites"
                className={({ isActive }) =>
                  `hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'text-emerald-400 underline underline-offset-8' : ''
                  }`
                }
              >
                Liked Songs
              </NavLink>
              <NavLink
                to="/history"
                className={({ isActive }) =>
                  `hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'text-emerald-400 underline underline-offset-8' : ''
                  }`
                }
              >
                History
              </NavLink>
            </>
          )}
        </nav>

        {/* Zone 3: Auth Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {user ? (
            <>
              <Link
                to="/settings"
                className="px-3.5 py-2 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {user.displayName}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign Out"
                className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-rose-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Workspace Body: Sidebar + Main Discovery Viewport */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar Navigation (260px on desktop) */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-slate-800/80 bg-[#0B101B] p-4 justify-between">
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="px-3 text-xs font-medium text-slate-400 mb-2">Browse</p>
              <NavLink to="/" end className={navItemClass}>
                <Compass className="w-4 h-4 shrink-0" />
                <span>Home</span>
              </NavLink>
              <NavLink to="/search" className={navItemClass}>
                <Search className="w-4 h-4 shrink-0" />
                <span>Search</span>
              </NavLink>
            </div>

            <div className="space-y-1">
              <p className="px-3 text-xs font-medium text-slate-400 mb-2">Your Library</p>
              {user ? (
                <>
                  <NavLink to="/playlists" className={navItemClass}>
                    <ListMusic className="w-4 h-4 shrink-0" />
                    <span>Playlists</span>
                  </NavLink>
                  <NavLink to="/favorites" className={navItemClass}>
                    <Heart className="w-4 h-4 shrink-0" />
                    <span>Liked Songs</span>
                  </NavLink>
                  <NavLink to="/history" className={navItemClass}>
                    <History className="w-4 h-4 shrink-0" />
                    <span>History</span>
                  </NavLink>
                </>
              ) : (
                <div className="mx-1 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 space-y-2.5">
                  <p className="text-xs font-semibold text-white">Create your first playlist</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Sign in to save liked songs, build playlists, and get personalized genre mixes.
                  </p>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </Link>
                </div>
              )}
            </div>

            {user && playlists.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-slate-800/80">
                <p className="px-3 text-xs font-medium text-slate-400 mb-2">Recent Playlists</p>
                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {playlists.slice(0, 6).map((pl) => (
                    <NavLink
                      key={pl._id}
                      to={`/playlists/${pl._id}`}
                      className={({ isActive }) =>
                        `block px-3 py-1.5 rounded-md text-xs truncate transition-colors ${
                          isActive
                            ? 'text-emerald-400 bg-slate-800/80 font-medium'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`
                      }
                    >
                      {pl.name}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 space-y-1">
            {user ? (
              <>
                <NavLink to="/settings" className={navItemClass}>
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Account Settings</span>
                </NavLink>
                {user.role === 'admin' && (
                  <NavLink to="/admin" className={navItemClass}>
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Admin Console</span>
                  </NavLink>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navItemClass}>
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Sign In</span>
                </NavLink>
                <NavLink to="/register" className={navItemClass}>
                  <UserIcon className="w-4 h-4 shrink-0" />
                  <span>Create Account</span>
                </NavLink>
              </>
            )}
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Strip (above Player) */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-20 inset-x-0 z-20 h-12 bg-slate-950/95 border-t border-slate-800 flex items-center justify-around px-2 text-xs"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-2 py-1 rounded ${
              isActive ? 'text-emerald-400 font-medium' : 'text-slate-400'
            }`
          }
        >
          <Compass className="w-4 h-4" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-2 py-1 rounded ${
              isActive ? 'text-emerald-400 font-medium' : 'text-slate-400'
            }`
          }
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </NavLink>
        {user ? (
          <>
            <NavLink
              to="/playlists"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2 py-1 rounded ${
                  isActive ? 'text-emerald-400 font-medium' : 'text-slate-400'
                }`
              }
            >
              <ListMusic className="w-4 h-4" />
              <span>Playlists</span>
            </NavLink>
            <NavLink
              to="/favorites"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2 py-1 rounded ${
                  isActive ? 'text-emerald-400 font-medium' : 'text-slate-400'
                }`
              }
            >
              <Heart className="w-4 h-4" />
              <span>Liked</span>
            </NavLink>
          </>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2 py-1 rounded ${
                isActive ? 'text-emerald-400 font-medium' : 'text-slate-400'
              }`
            }
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </NavLink>
        )}
      </nav>

      {/* Persistent Music Player */}
      <MusicPlayer />
    </div>
  );
}
