'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'center_admin' | 'supervisor' | 'therapist' | 'parent';
  centerId: string;
  centerName: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');
    if (stored && token) {
      const parsed = JSON.parse(stored);
      // Backend stores roles uppercase (e.g. CENTER_ADMIN) — normalize to
      // the lowercase shape the UI compares against (e.g. center_admin).
      setUser({ ...parsed, role: typeof parsed.role === 'string' ? parsed.role.toLowerCase() : parsed.role });
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    const userData: User = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      // Backend returns roles uppercase (e.g. CENTER_ADMIN); the UI compares
      // against lowercase (e.g. center_admin), so normalize here.
      role: data.user.role.toLowerCase(),
      centerId: data.user.centerId,
      centerName: data.centerName || '',
    };
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
