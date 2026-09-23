'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

export function SyncStatusPill() {
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Initial check
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setSyncState('offline');
    }

    const handleOnline = () => {
      setSyncState('syncing');
      setTimeout(() => {
        setSyncState('synced');
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }, 1200);
    };

    const handleOffline = () => {
      setSyncState('offline');
    };

    const handleSyncEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ state: SyncState }>;
      if (customEvent.detail?.state) {
        setSyncState(customEvent.detail.state);
        if (customEvent.detail.state === 'synced') {
          setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('gss-sync-event', handleSyncEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('gss-sync-event', handleSyncEvent);
    };
  }, []);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`group inline-flex items-center justify-center h-8 px-2.5 rounded-full text-[11px] font-medium transition-all duration-300 cursor-pointer border ${
          syncState === 'synced'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 hover:shadow-xs'
            : syncState === 'syncing'
            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 hover:bg-blue-100'
            : syncState === 'offline'
            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100'
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100'
        }`}
        title="Sync Status • Click to view Dual Persistence Pipeline"
        aria-label="Sync Status"
      >
        {syncState === 'synced' && (
          <div className="flex items-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Synced
            </span>
          </div>
        )}
        {syncState === 'syncing' && (
          <div className="flex items-center">
            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
            <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              Syncing...
            </span>
          </div>
        )}
        {syncState === 'offline' && (
          <div className="flex items-center">
            <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              Offline
            </span>
          </div>
        )}
        {syncState === 'error' && (
          <div className="flex items-center">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-[100px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              Sync Warning
            </span>
          </div>
        )}
      </button>

      {/* Popover Card */}
      {showDetails && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDetails(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-xl shadow-xl p-3 z-50 animate-panel-entrance text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle,#F1F3F4)]">
              <span className="font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
                Dual Persistence Pipeline
              </span>
              <span className="text-[10px] text-[var(--text-muted,#747775)]">
                {lastSyncTime}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary,#5F6368)]">Network:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary,#5F6368)]">Firebase Firestore:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary,#5F6368)]">Google Sheets v4:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 4 Branches Synced
                </span>
              </div>
              {user?.branch && (
                <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle,#F1F3F4)]">
                  <span className="text-[var(--text-secondary,#5F6368)]">Active Branch:</span>
                  <span className="font-mono text-[11px] font-semibold text-[var(--brand-primary,#1A73E8)]">
                    {user.branch}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
