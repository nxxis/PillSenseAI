import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { postJson, getJson } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem('ps_token') || ''
  );
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('ps_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem('ps_token', token);
    else localStorage.removeItem('ps_token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('ps_user', JSON.stringify(user));
    else localStorage.removeItem('ps_user');
  }, [user]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const resp = await postJson(
        '/auth/login',
        { email, password },
        { auth: false }
      );
      if (!resp.ok) throw new Error(resp.error || 'login_failed');
      // Write immediately so subsequent requests have the token
      localStorage.setItem('ps_token', resp.token);
      localStorage.setItem('ps_user', JSON.stringify(resp.user));
      setToken(resp.token);
      setUser(resp.user);
      return { ok: true, token: resp.token, user: resp.user };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const resp = await postJson(
        '/auth/register',
        { name, email, password },
        { auth: false }
      );
      if (!resp.ok) throw new Error(resp.error || 'register_failed');
      // Write immediately so we can call protected routes right after
      localStorage.setItem('ps_token', resp.token);
      localStorage.setItem('ps_user', JSON.stringify(resp.user));
      setToken(resp.token);
      setUser(resp.user);
      return { ok: true, token: resp.token, user: resp.user };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };

  // Optional session refresh on reload
  useEffect(() => {
    const refresh = async () => {
      if (!token) return;
      const r = await getJson('/auth/me');
      if (r?.ok && r.user) setUser(r.user);
    };
    refresh();
  }, []); // once

  const logout = () => {
    localStorage.removeItem('ps_token');
    localStorage.removeItem('ps_user');
    setToken('');
    setUser(null);
  };

  const value = useMemo(
    () => ({ token, user, loading, login, register, logout }),
    [token, user, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
