'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, LoginCredentials, RegisterPayload } from '@/types/auth';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; error?: string; user?: User; alreadyExists?: boolean; email?: string }>;
  logout: () => Promise<void>;
  quickLogin: (identifier: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (credentials: LoginCredentials) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      let data: any = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: `Server returned an invalid response (${res.status})` };
      }

      if (!res.ok) {
        return { success: false, error: data.error || `Failed to sign in (${res.status})` };
      }

      setUser(data.user);

      // Route based on user status & role
      if (data.user.status === 'pending') {
        router.push('/pending');
      } else {
        // Active user: route to appropriate dashboard
        switch (data.user.role) {
          case 'superadmin':
            router.push('/admin/users');
            break;
          case 'admin':
            router.push('/admin/directory');
            break;
          case 'hr':
            router.push('/leads');
            break;
          case 'employee':
          case 'trainer':
          default:
            router.push('/dashboard');
            break;
        }
      }

      return { success: true, user: data.user };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during sign in';
      return { success: false, error: msg };
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data: any = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: `Server returned an invalid response (${res.status})` };
      }

      if (!res.ok) {
        return {
          success: false,
          error: data.error || `Registration failed (${res.status})`,
          alreadyExists: data.alreadyExists,
          email: data.email
        };
      }

      setUser(data.user);
      if (data.user.status === 'active') {
        router.push('/dashboard');
      } else {
        router.push('/pending');
      }
      return { success: true, user: data.user };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during registration';
      return { success: false, error: msg };
    }
  };

  const quickLogin = async (identifier: string) => {
    const res = await login({ identifier, password: 'password123' });
    return res.success;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        quickLogin,
        refreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
