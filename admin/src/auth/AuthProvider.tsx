import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adminApi, type AuthApi } from '../api/client.ts';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error';
type AuthContextValue = {
  status: AuthStatus;
  mustChangePassword: boolean;
  sessionExpired: boolean;
  login: (username: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children, api = adminApi }: { children: ReactNode; api?: AuthApi }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    api.getSession().then((session) => {
      if (!active) return;
      setMustChangePassword(session.mustChangePassword);
      setStatus(session.authenticated ? 'authenticated' : 'anonymous');
    }, () => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [api, attempt]);

  useEffect(() => api.onUnauthorized?.(() => {
    setSessionExpired(true);
    setMustChangePassword(false);
    setStatus('anonymous');
  }), [api]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.login(username, password);
    setSessionExpired(false);
    setMustChangePassword(result.mustChangePassword);
    setStatus('authenticated');
  }, [api]);
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await api.changePassword(currentPassword, newPassword);
    setMustChangePassword(result.mustChangePassword);
    setStatus('authenticated');
  }, [api]);
  const logout = useCallback(async () => {
    try { await api.logout(); } finally {
      setMustChangePassword(false);
      setSessionExpired(false);
      setStatus('anonymous');
    }
  }, [api]);
  const value = useMemo<AuthContextValue>(() => ({
    status, mustChangePassword, sessionExpired, login, changePassword, logout,
    retry: () => setAttempt((current) => current + 1),
  }), [changePassword, login, logout, mustChangePassword, sessionExpired, status]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
