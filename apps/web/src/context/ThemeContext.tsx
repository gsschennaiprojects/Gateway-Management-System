'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'light' | 'dark' | 'eye-care';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gss_theme') as AppTheme | null;
      if (saved && ['light', 'dark', 'eye-care'].includes(saved)) {
        setThemeState(saved);
        applyTheme(saved);
      } else {
        applyTheme('light');
      }
    } catch {
      applyTheme('light');
    }
  }, []);

  const applyTheme = (t: AppTheme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', t);

    // Sync Tailwind & System dark mode classes
    if (t === 'dark') {
      root.classList.add('dark');
      root.classList.remove('eye-care');
      root.style.colorScheme = 'dark';
    } else if (t === 'eye-care') {
      root.classList.remove('dark');
      root.classList.add('eye-care');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('dark');
      root.classList.remove('eye-care');
      root.style.colorScheme = 'light';
    }
  };

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem('gss_theme', newTheme);
    } catch {
      // ignore
    }
  };

  const toggleTheme = () => {
    const sequence: AppTheme[] = ['light', 'dark', 'eye-care'];
    const nextIdx = (sequence.indexOf(theme) + 1) % sequence.length;
    setTheme(sequence[nextIdx]);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
