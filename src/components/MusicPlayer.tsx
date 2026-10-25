import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Heart,
  Loader2,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export function MusicPlayer() {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite, recordListeningEvent } = useLibrary();
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    playbackError,
    repeatMode,
    shuffle,
    togglePlayPause,
    playNext,
    playPrevious,
    setRepeatMode,
    setShuffle,
    setIsPlaying,
    setIsBuffering,
    setPlaybackError,
  } = usePlayer();

  const playerRef = useRef<YTPlayerInstance | null>(null);
  const containerId = 'vibeflow-yt-embed-container';
  const [apiReady, setApiReady] = useState<boolean>(Boolean(window.YT && window.YT.Player));
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(80);
  const [muted, setMuted] = useState<boolean>(false);
  const [showEmbedDrawer, setShowEmbedDrawer] = useState<boolean>(false);

  // Track cumulative genuinely played seconds for the active track before recording ListeningHistory
  const playedSecondsRef = useRef<number>(0);
  const recordedForTrackIdRef = useRef<string | null>(null);

  // Load official YouTube IFrame Player API script once
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }
    const existingScript = document.getElementById('yt-iframe-api-script');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.body.appendChild(tag);
    }
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      setApiReady(true);
    };
  }, []);

  // Initialize or update the YouTube IFrame Player when currentTrack changes
  useEffect(() => {
    if (!currentTrack || !apiReady || !window.YT?.Player) return;

    playedSecondsRef.current = 0;
    recordedForTrackIdRef.current = null;
    setCurrentTime(0);
    setDuration(currentTrack.durationSeconds || 0);

    if (playerRef.current) {
      try {
        playerRef.current.loadVideoById(currentTrack.providerId);
        return;
      } catch {
        // Re-create if instance became stale
      }
    }

    playerRef.current = new window.YT.Player(containerId, {
      height: '180',
      width: '320',
      videoId: currentTrack.providerId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: (event) => {
          event.target.setVolume(volume);
          if (isPlaying) {
            event.target.playVideo();
          }
        },
        onStateChange: (event) => {
          const state = event.data;
          // 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 0 = ENDED
          if (state === 1) {
            setIsBuffering(false);
            setIsPlaying(true);
            setPlaybackError(null);
            const dur = event.target.getDuration();
            if (dur > 0) setDuration(dur);
          } else if (state === 2) {
            setIsBuffering(false);
            setIsPlaying(false);
          } else if (state === 3) {
            setIsBuffering(true);
          } else if (state === 0) {
            setIsBuffering(false);
            if (repeatMode === 'one') {
              event.target.seekTo(0, true);
              event.target.playVideo();
            } else {
              playNext();
            }
          }
        },
        onError: () => {
          setIsBuffering(false);
          setIsPlaying(false);
          setPlaybackError("This track can't be played right now");
        },
      },
    });
  }, [currentTrack?.providerId, apiReady]);

  // Synchronize Play/Pause toggle with actual YT player
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !currentTrack) return;
    try {
      if (isPlaying && typeof player.playVideo === 'function') {
        player.playVideo();
      } else if (!isPlaying && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      }
    } catch {
      // Ignore before ready
    }
  }, [isPlaying, currentTrack]);

  // Poll progress and record genuine listening history after >= 5 seconds of real playback
  useEffect(() => {
    if (!currentTrack || !isPlaying) return;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;
      try {
        const nowSec = player.getCurrentTime();
        const totalDur = player.getDuration();
        if (nowSec >= 0) setCurrentTime(nowSec);
        if (totalDur > 0) setDuration(totalDur);

        playedSecondsRef.current += 1;
        if (
          user &&
          playedSecondsRef.current >= 5 &&
          recordedForTrackIdRef.current !== currentTrack.providerId
        ) {
          recordedForTrackIdRef.current = currentTrack.providerId;
          recordListeningEvent(currentTrack, playedSecondsRef.current);
        }
      } catch {
        // Ignore transient polling errors
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTrack, isPlaying, user, recordListeningEvent]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    setCurrentTime(nextTime);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(nextTime, true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVol = Number(e.target.value);
    setVolume(nextVol);
    setMuted(nextVol === 0);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(nextVol);
      if (nextVol > 0) playerRef.current.unMute();
    }
  };

  const handleToggleMute = () => {
    if (!playerRef.current) return;
    if (muted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume || 70);
      setMuted(false);
    } else {
      playerRef.current.mute();
      setMuted(true);
    }
  };

  const cycleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  };

  const liked = currentTrack ? isFavorite(currentTrack.providerId) : false;

  return (
    <>
      {/* Video Player Drawer */}
      <div
        className={`fixed right-4 bottom-24 z-40 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl transition-opacity duration-150 ${
          currentTrack && showEmbedDrawer
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none w-px h-px overflow-hidden'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
          <span>Now Playing</span>
          <button
            type="button"
            onClick={() => setShowEmbedDrawer(false)}
            className="text-slate-400 hover:text-white"
          >
            Hide
          </button>
        </div>
        <div id={containerId} />
      </div>

      {/* Persistent Bottom Player Bar */}
      <footer
        aria-label="Music Player"
        className="fixed bottom-0 inset-x-0 z-30 h-20 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4"
      >
        {!currentTrack ? (
          <div className="w-full flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Music className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">Not playing</p>
                <p className="text-xs text-slate-400">Select a song to start listening</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Left: Active Track Info */}
            <div className="flex items-center gap-3 min-w-0 w-1/4 max-w-xs">
              <div className="w-12 h-12 rounded-md overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                {currentTrack.thumbnailUrl ? (
                  <img
                    src={currentTrack.thumbnailUrl}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-slate-400 truncate">{currentTrack.artistName}</p>
              </div>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    toggleFavorite(currentTrack).catch(() => {
                      // Prevent unhandled promise rejection if session expired
                    });
                  }}
                  aria-label={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                  className={`p-1.5 rounded-md transition-colors ${
                    liked ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${liked ? 'fill-emerald-400' : ''}`} />
                </button>
              )}
            </div>

            {/* Center: Transport & Seek Bar */}
            <div className="flex flex-col items-center justify-center flex-1 max-w-xl">
              {playbackError ? (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/50 border border-amber-500/30 rounded-md px-3 py-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span className="truncate">{playbackError}</span>
                  <a
                    href={currentTrack.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-emerald-400 hover:underline whitespace-nowrap shrink-0 ml-1"
                  >
                    Listen on YouTube Music
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setShuffle((s) => !s)}
                      aria-label="Toggle shuffle"
                      title="Toggle shuffle"
                      className={`p-1.5 rounded-md transition-colors ${
                        shuffle ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={playPrevious}
                      aria-label="Previous track"
                      className="p-1.5 rounded-md text-slate-300 hover:text-white transition-colors"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={togglePlayPause}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                      {isBuffering ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="w-4 h-4 fill-slate-950" />
                      ) : (
                        <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={playNext}
                      aria-label="Next track"
                      className="p-1.5 rounded-md text-slate-300 hover:text-white transition-colors"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={cycleRepeat}
                      aria-label="Cycle repeat mode"
                      title={`Repeat: ${repeatMode}`}
                      className={`p-1.5 rounded-md transition-colors ${
                        repeatMode !== 'off'
                          ? 'text-emerald-400'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {repeatMode === 'one' ? (
                        <Repeat1 className="w-4 h-4" />
                      ) : (
                        <Repeat className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="w-full flex items-center gap-2.5 mt-1">
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums w-9 text-right">
                      {formatSeconds(currentTime)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={duration > 0 ? duration : 100}
                      value={Math.min(currentTime, duration > 0 ? duration : 100)}
                      onChange={handleSeek}
                      aria-label="Seek timeline"
                      className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums w-9">
                      {duration > 0
                        ? formatSeconds(duration)
                        : currentTrack.durationFormatted || '0:00'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Right: Volume, Embed Viewer & Authorized Link */}
            <div className="hidden md:flex items-center justify-end gap-3 w-1/4 max-w-xs">
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
                className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />

              <button
                type="button"
                onClick={() => setShowEmbedDrawer((prev) => !prev)}
                title={showEmbedDrawer ? 'Hide YouTube Player' : 'Show YouTube Player'}
                className="p-1.5 rounded-md text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors"
              >
                {showEmbedDrawer ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>

              <a
                href={currentTrack.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open track on YouTube Music"
                className="p-1.5 rounded-md text-slate-400 hover:text-emerald-400 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </>
        )}
      </footer>
    </>
  );
}
