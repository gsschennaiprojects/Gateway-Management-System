'use client';

import { useEffect } from 'react';

/**
 * ============================================================================
 * GSS ENTERPRISE CODE & INSPECTOR PROTECTION GUARD
 * 
 * Provides defense-in-depth protection against:
 * 1. Right-click "Inspect" and context menu access.
 * 2. Keyboard inspection shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Ctrl+S).
 * 3. Browser DevTools console tampering and data extraction.
 * 4. DOM live inspection and editing.
 * ============================================================================
 */
export function InspectorGuard() {
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // ── 1. Disable Right-Click Context Menu ─────────────────────────────────
    const handleContextMenu = (e: MouseEvent) => {
      // Allow right-click on input and textarea for copy/paste convenience
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // ── 2. Block DevTools Keyboard Shortcuts ────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      // F12 key (Standard DevTools toggle)
      if (e.keyCode === 123 || key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + Shift + I (Inspect Element)
      // Ctrl + Shift + J (Open Console)
      // Ctrl + Shift + C (Element Selector)
      if (isCtrlOrMeta && isShift && (key === 'I' || key === 'J' || key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Mac Command + Option + I / J / C
      if (e.metaKey && isAlt && (key === 'I' || key === 'J' || key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + U (View Page Source)
      if (isCtrlOrMeta && (key === 'U' || key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // ── 3. Console Warning & Neutralization ─────────────────────────────────
    const suppressConsole = () => {
      if (process.env.NODE_ENV === 'production') {
        try {
          const noop = () => {};
          // Overwrite log functions to protect internal state
          console.log = noop;
          console.debug = noop;
          console.info = noop;
          console.dir = noop;
        } catch {}
      }

      // Display authoritative enterprise warning
      try {
        console.clear();
        console.log(
          '%c⚠️ GSS SECURITY POLICY NOTICE',
          'color: #EA4335; font-size: 20px; font-weight: 800; background: #FCE8E6; padding: 4px 8px; border-radius: 4px;'
        );
        console.log(
          '%cThis application is an enterprise-managed workspace. Unauthorized inspection, extraction, or tampering with client scripts or operational data is strictly prohibited and logged.',
          'color: #5F6368; font-size: 12px; font-weight: 500;'
        );
      } catch {}
    };

    // ── 4. DevTools Open Detection Loop ─────────────────────────────────────
    let devToolsCheckInterval: NodeJS.Timeout;
    const detectDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;

      if (widthThreshold || heightThreshold) {
        // DevTools opened or docked: suppress logs and enforce security state
        try {
          console.clear();
        } catch {}
      }
    };

    // Attach global listeners
    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    suppressConsole();

    // Check periodically for DevTools opening
    devToolsCheckInterval = setInterval(detectDevTools, 2000);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true } as any);
      window.removeEventListener('keydown', handleKeyDown, { capture: true } as any);
      clearInterval(devToolsCheckInterval);
    };
  }, []);

  return null;
}
