'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (options: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return no-op if outside provider
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  const removeToast = useCallback((id: string) => {
    setExiting((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setExiting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 250);
  }, []);

  const addToast = useCallback(
    (options: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const duration = options.duration ?? 4000;
      setToasts((prev) => [...prev.slice(-4), { ...options, id }]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  const api: ToastContextType = {
    toast: addToast,
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message) => addToast({ type: 'error', title, message, duration: 6000 }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
    info: (title, message) => addToast({ type: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 max-w-[380px] w-full pointer-events-none">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            isExiting={exiting.has(t.id)}
            onClose={() => removeToast(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  isExiting,
  onClose,
}: {
  toast: Toast;
  isExiting: boolean;
  onClose: () => void;
}) {
  const iconMap = {
    success: <CheckCircle2 className="w-4.5 h-4.5 text-[var(--badge-success-text,#137333)] shrink-0" />,
    error: <AlertCircle className="w-4.5 h-4.5 text-[var(--badge-danger-text,#D93025)] shrink-0" />,
    warning: <AlertTriangle className="w-4.5 h-4.5 text-[var(--badge-warning-text,#B06000)] shrink-0" />,
    info: <Info className="w-4.5 h-4.5 text-[var(--brand-primary,#1A73E8)] shrink-0" />,
  };

  const borderMap = {
    success: 'border-l-[var(--badge-success-text,#137333)]',
    error: 'border-l-[var(--badge-danger-text,#D93025)]',
    warning: 'border-l-[var(--badge-warning-text,#B06000)]',
    info: 'border-l-[var(--brand-primary,#1A73E8)]',
  };

  return (
    <div
      className={`pointer-events-auto bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-xl p-4 border-l-4 ${
        borderMap[toast.type]
      } flex items-start gap-3 ${isExiting ? 'animate-toast-out' : 'animate-toast-in'}`}
      role="alert"
    >
      {iconMap[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)] leading-tight">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-[var(--text-muted,#747775)] hover:text-[var(--text-primary,#1F1F1F)] p-0.5 rounded-full hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors shrink-0 cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
