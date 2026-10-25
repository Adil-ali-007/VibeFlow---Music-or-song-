import React, { createContext, useCallback, useContext, useState } from 'react';
import type { Track } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextValue {
  currentTrack: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackError: string | null;
  repeatMode: RepeatMode;
  shuffle: boolean;
  playTrack: (track: Track, customQueue?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  setRepeatMode: React.Dispatch<React.SetStateAction<RepeatMode>>;
  setShuffle: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPlaying: (playing: boolean) => void;
  setIsBuffering: (buffering: boolean) => void;
  setPlaybackError: (err: string | null) => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffle, setShuffle] = useState<boolean>(false);

  const playTrack = useCallback((track: Track, customQueue?: Track[]) => {
    setPlaybackError(null);
    setIsBuffering(true);
    setCurrentTrack(track);
    setIsPlaying(true);

    if (customQueue && customQueue.length > 0) {
      setQueue(customQueue);
      const idx = customQueue.findIndex((t) => t.providerId === track.providerId);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else {
      setQueue([track]);
      setCurrentIndex(0);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) return;
    setIsPlaying((prev) => !prev);
  }, [currentTrack]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;

    if (shuffle && queue.length > 1) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      setCurrentIndex(nextIdx);
      setCurrentTrack(queue[nextIdx]);
      setPlaybackError(null);
      setIsBuffering(true);
      setIsPlaying(true);
      return;
    }

    if (currentIndex + 1 < queue.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setCurrentTrack(queue[nextIdx]);
      setPlaybackError(null);
      setIsBuffering(true);
      setIsPlaying(true);
    } else if (repeatMode === 'all') {
      setCurrentIndex(0);
      setCurrentTrack(queue[0]);
      setPlaybackError(null);
      setIsBuffering(true);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [queue, currentIndex, shuffle, repeatMode]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setCurrentTrack(queue[prevIdx]);
      setPlaybackError(null);
      setIsBuffering(true);
      setIsPlaying(true);
    } else {
      setCurrentIndex(0);
      setCurrentTrack(queue[0]);
      setPlaybackError(null);
      setIsPlaying(true);
    }
  }, [queue, currentIndex]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        currentIndex,
        isPlaying,
        isBuffering,
        playbackError,
        repeatMode,
        shuffle,
        playTrack,
        togglePlayPause,
        playNext,
        playPrevious,
        setRepeatMode,
        setShuffle,
        setIsPlaying,
        setIsBuffering,
        setPlaybackError,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used inside a PlayerProvider');
  }
  return ctx;
}
