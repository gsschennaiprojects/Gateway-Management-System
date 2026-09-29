'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, LoginCredentials, RegisterPayload } from '@/types/auth';
import { useRouter } from 'next/navigation';
import { LogoutConfirmationModal } from '@/components/auth/LogoutConfirmationModal';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; error?: string; user?: User; alreadyExists?: boolean; email?: string }>;
  logout: () => Promise<void>;
  requestLogout: () => void;
  cancelLogout: () => void;
  confirmLogout: () => Promise<void>;
  isLogoutModalOpen: boolean;
  isLoggingOut: boolean;
  quickLogin: (identifier: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
}

interface AuthApiResponse {
  success?: boolean;
  user?: User;
  error?: string;
  alreadyExists?: boolean;
  email?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else if (res.status === 401) {
        setUser(null);
      }
    } catch {
      // No client-side profile cache is trusted as authentication state.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refreshSession);
  }, [refreshSession]);

  const login = async (credentials: LoginCredentials) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      let data: AuthApiResponse = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) as AuthApiResponse : {};
      } catch {
        data = { error: `Server returned an invalid response (${res.status})` };
      }

      if (!res.ok) {
        return { success: false, error: data.error || `Failed to sign in (${res.status})` };
      }

      if (!data.user) return { success: false, error: 'Sign in response did not include a user.' };

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

      let data: AuthApiResponse = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) as AuthApiResponse : {};
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

      if (!data.user) return { success: false, error: 'Registration response did not include a user.' };

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

  // Step 1: Request Logout (opens confirmation modal)
  const requestLogout = useCallback(() => {
    setIsLogoutModalOpen(true);
  }, []);

  // Cancel Logout (closes confirmation modal, user stays logged in)
  const cancelLogout = useCallback(() => {
    setIsLogoutModalOpen(false);
  }, []);

  // Step 2: Confirmed Logout (executes backend call and terminates session)
  const confirmLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('[AuthContext] Backend logout note:', err);
    } finally {
      setUser(null);
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
      router.push('/login');
    }
  }, [router]);

  // Universal logout: triggers Step 1 modal for two-step confirmation
  const logout = useCallback(async () => {
    requestLogout();
  }, [requestLogout]);


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        requestLogout,
        cancelLogout,
        confirmLogout,
        isLogoutModalOpen,
        isLoggingOut,
        quickLogin,
        refreshSession
      }}
    >
      {children}
      {/* Global Two-Step Confirmation Logout Modal */}
      <LogoutConfirmationModal />
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
