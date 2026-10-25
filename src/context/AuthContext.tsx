import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Always start as a logged-out guest until verified by the backend session endpoint
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const current = await authApi.getMe();
      setUser(current);
      return current;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const current = await authApi.getMe();
        if (active) {
          setUser(current);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  // Automatically clear frontend auth state when any API response signals 401 session expiration
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
    };
    window.addEventListener('vibeflow:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('vibeflow:session-expired', handleSessionExpired);
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setUser,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
