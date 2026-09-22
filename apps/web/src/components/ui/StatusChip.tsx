import React from 'react';

interface StatusChipProps {
  status: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  label: string;
  size?: 'xs' | 'sm' | 'md';
  pulse?: boolean;
}

export function StatusChip({
  status,
  label,
  size = 'sm',
  pulse = false,
}: StatusChipProps) {
  const colorMap = {
    success: {
      bg: 'bg-[var(--badge-success-bg,#E6F4EA)]',
      text: 'text-[var(--badge-success-text,#137333)]',
      border: 'border-[var(--badge-success-border,#CEEAD6)]',
      dot: 'bg-[var(--badge-success-text,#1E8E3E)]',
      dotGlow: '',
    },
    warning: {
      bg: 'bg-[var(--badge-warning-bg,#FEF7E0)]',
      text: 'text-[var(--badge-warning-text,#B06000)]',
      border: 'border-[var(--badge-warning-border,#FEEFC3)]',
      dot: 'bg-[var(--badge-warning-text,#F9AB00)]',
      dotGlow: '',
    },
    danger: {
      bg: 'bg-[var(--badge-danger-bg,#FCE8E6)]',
      text: 'text-[var(--badge-danger-text,#C5221F)]',
      border: 'border-[var(--badge-danger-border,#FAD2CF)]',
      dot: 'bg-[var(--badge-danger-text,#D93025)]',
      dotGlow: '',
    },
    neutral: {
      bg: 'bg-[var(--bg-card-subtle,#F1F3F4)]',
      text: 'text-[var(--text-secondary,#444746)]',
      border: 'border-[var(--border-card,#DADCE0)]',
      dot: 'bg-[var(--text-muted,#747775)]',
      dotGlow: '',
    },
    info: {
      bg: 'bg-[var(--brand-container,#E8F0FE)]',
      text: 'text-[var(--brand-on-container,#1A73E8)]',
      border: 'border-[var(--border-subtle,#D2E3FC)]',
      dot: 'bg-[var(--brand-primary,#1A73E8)]',
      dotGlow: '',
    },
  };

  const sizeMap = {
    xs: 'text-[10px] px-2 py-0.5 gap-1',
    sm: 'text-[11px] px-2.5 py-0.5 gap-1.5',
    md: 'text-xs px-3 py-1 gap-1.5',
  };

  const dotSizeMap = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
  };

  const colors = colorMap[status];

  return (
    <span
      className={`inline-flex items-center font-sans font-medium rounded-full border leading-none whitespace-nowrap select-none ${colors.bg} ${colors.text} ${colors.border} ${sizeMap[size]}`}
    >
      <span
        className={`${dotSizeMap[size]} rounded-full shrink-0 ${colors.dot} ${
          pulse ? 'animate-pulse' : ''
        }`}
      />
      <span className="capitalize">{label}</span>
    </span>
  );
}
