'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme, AppTheme } from '@/context/ThemeContext';
import { Sun, Moon, Eye, Check } from 'lucide-react';

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const THEMES: { id: AppTheme; label: string; description: string; icon: React.ReactNode }[] = [
    {
      id: 'light',
      label: 'Light Mode',
      description: 'Clean Google Workspace canvas',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
    },
    {
      id: 'dark',
      label: 'Dark Mode',
      description: 'Google Material dark surface',
      icon: <Moon className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'eye-care',
      label: 'Eye Protection',
      description: 'Warm amber paper • Blue light filter',
      icon: <Eye className="w-4 h-4 text-orange-500" />,
    },
  ];

  const currentThemeConfig = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group h-8 px-2.5 rounded-full flex items-center justify-center border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)] hover:bg-[var(--bg-card-hover,#F8FAFD)] text-[var(--text-primary,#1F1F1F)] transition-all duration-300 cursor-pointer shadow-xs"
        title={`Appearance Theme: ${currentThemeConfig.label} (Click to switch)`}
        aria-label="Theme selector"
      >
        <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
          {currentThemeConfig.icon}
        </span>
        <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-[110px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 text-xs font-semibold text-[var(--text-primary,#1F1F1F)]">
          {currentThemeConfig.label}
        </span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-2xl p-2 z-50 animate-panel-entrance">
          <div className="px-3 py-2 border-b border-[var(--border-subtle,#E8EAED)] mb-1">
            <p className="text-xs font-semibold text-[var(--text-primary,#1F1F1F)]">
              Appearance Theme
            </p>
            <p className="text-[11px] text-[var(--text-muted,#747775)] mt-0.5">
              Customize workspace visual comfort
            </p>
          </div>

          <div className="space-y-1">
            {THEMES.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)]'
                      : 'hover:bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-primary,#1F1F1F)]'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{t.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold leading-tight">{t.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted,#747775)] mt-0.5 leading-tight">
                      {t.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
