import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-canvas)] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-3 border-[var(--border-card)] border-t-[var(--brand-primary)] animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium text-[var(--text-primary)]">
            Loading Workspace...
          </span>
          <span className="text-[11px] text-[var(--text-secondary)]">
            Gateway Software Solutions
          </span>
        </div>
      </div>
    </div>
  );
}
