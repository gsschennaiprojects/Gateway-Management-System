'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Download, X, CheckCircle2 } from 'lucide-react';

export function PwaNotificationManager() {
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    }

    // 2. Check Notification Permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
      const dismissed = localStorage.getItem('gss_notification_prompt_dismissed');
      if (Notification.permission === 'default' && !dismissed) {
        // Show banner after brief delay for smooth UX
        const timer = setTimeout(() => setShowNotificationPrompt(true), 1500);
        return () => clearTimeout(timer);
      }
    }

    // 3. Listen for PWA Install Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissedInstall = localStorage.getItem('gss_install_prompt_dismissed');
      if (!dismissedInstall) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      setShowNotificationPrompt(false);

      if (permission === 'granted') {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('GSS Management System', {
            body: 'Chrome notifications active! You will receive live task, student, and attendance updates.',
            icon: '/icon-192.png',
            badge: '/icon-192.png'
          });
        } else {
          new Notification('GSS Management System', {
            body: 'Chrome notifications active! You will receive live task, student, and attendance updates.',
            icon: '/icon-192.png'
          });
        }
      }
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice outcome:', outcome);
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const dismissNotificationPrompt = () => {
    setShowNotificationPrompt(false);
    localStorage.setItem('gss_notification_prompt_dismissed', 'true');
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('gss_install_prompt_dismissed', 'true');
  };

  return (
    <>
      {/* Floating Chrome Notification Permission Banner */}
      {showNotificationPrompt && notificationStatus === 'default' && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white">Enable Chrome Notifications</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Allow notifications to receive instant alerts for task allocations, attendance punches, and announcements.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  id="enable-notification-btn"
                  onClick={requestNotificationPermission}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Enable Notifications
                </button>
                <button
                  onClick={dismissNotificationPrompt}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={dismissNotificationPrompt}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating PWA Install App Banner */}
      {showInstallPrompt && !isInstalled && deferredPrompt && (
        <div className="fixed bottom-5 left-5 z-50 max-w-sm w-full bg-slate-900/95 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white">Install GSS Management App</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Install as a standalone desktop or mobile application for instant access and offline attendance logging.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  id="install-pwa-app-btn"
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Install App
                </button>
                <button
                  onClick={dismissInstallPrompt}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Not Now
                </button>
              </div>
            </div>
            <button
              onClick={dismissInstallPrompt}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
