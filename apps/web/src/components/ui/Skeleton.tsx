import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string;
  height?: string;
  lines?: number;
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines,
}: SkeletonProps) {
  const shapeClass = {
    text: 'rounded h-3',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-xl',
  }[variant];

  if (lines) {
    return (
      <div className={`space-y-2.5 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`animate-shimmer rounded h-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
            style={{ animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`animate-shimmer ${shapeClass} ${className}`}
      style={{ width, height }}
    />
  );
}

/* Pre-built skeleton compositions */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`glass-panel p-5 space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-2/3" />
          <Skeleton variant="text" className="w-1/3" />
        </div>
      </div>
      <Skeleton variant="rounded" className="w-full h-24" />
      <div className="flex gap-2">
        <Skeleton variant="rounded" className="w-20 h-7" />
        <Skeleton variant="rounded" className="w-20 h-7" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 px-3 py-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="text" className="flex-1 h-3" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 px-3 py-3 rounded-lg bg-[var(--bg-card-subtle,#F1F3F4)] border border-[var(--border-subtle,#E8EAED)]"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {[1, 2, 3, 4].map((j) => (
            <Skeleton key={j} variant="text" className="flex-1 h-3" />
          ))}
        </div>
      ))}
    </div>
  );
}
