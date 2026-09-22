'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';

interface AccountInfoRowProps {
  icon?: React.ReactNode;
  label: string;
  value?: string | React.ReactNode;
  description?: string;
  action?: 'arrow' | 'toggle' | 'custom' | 'none';
  customAction?: React.ReactNode;
  onClick?: () => void;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  /** Renders the value as a colored badge */
  badge?: { text: string; color: 'blue' | 'orange' | 'green' | 'amber' | 'red' | 'purple' | 'neutral' };
}

const BADGE_COLORS = {
  blue: 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border-[var(--border-subtle,#D2E3FC)]',
  orange: 'bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border-[var(--badge-warning-border,#FEEFC3)]',
  green: 'bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border-[var(--badge-success-border,#CEEAD6)]',
  amber: 'bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border-[var(--badge-warning-border,#FEEFC3)]',
  red: 'bg-[var(--badge-danger-bg,#FCE8E6)] text-[var(--badge-danger-text,#C5221F)] border-[var(--badge-danger-border,#FAD2CF)]',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  neutral: 'bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#444746)] border-[var(--border-card,#DADCE0)]',
};

export function AccountInfoRow({
  icon,
  label,
  value,
  description,
  action = 'arrow',
  customAction,
  onClick,
  toggleValue = false,
  onToggle,
  danger = false,
  disabled = false,
  className = '',
  badge,
}: AccountInfoRowProps) {
  const [localToggle, setLocalToggle] = useState(toggleValue);

  useEffect(() => {
    setLocalToggle(toggleValue);
  }, [toggleValue]);

  const isClickable = (action === 'arrow' || action === 'toggle' || Boolean(onClick)) && !disabled;

  const handleToggle = () => {
    const next = !localToggle;
    setLocalToggle(next);
    onToggle?.(next);
  };

  const handleRowClick = () => {
    if (disabled) return;
    if (action === 'toggle') {
      handleToggle();
    } else if (onClick) {
      onClick();
    }
  };

  const Wrapper = isClickable && action !== 'toggle' ? 'button' : 'div';

  return (
    <Wrapper
      onClick={isClickable ? handleRowClick : undefined}
      className={`w-full flex items-center justify-between gap-4 px-5 py-3.5 transition-colors group ${
        isClickable
          ? 'cursor-pointer hover:bg-[var(--nav-hover-bg,#F8FAFD)] active:bg-[var(--bg-card-subtle,#F1F3F4)]'
          : ''
      } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
      {...(isClickable ? { type: 'button' as const } : {})}
    >
      {/* Left side */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {icon && (
          <span
            className={`shrink-0 ${
              danger ? 'text-[var(--badge-danger-text,#D93025)]' : 'text-[var(--text-secondary,#5F6368)] group-hover:text-[var(--text-primary,#1F1F1F)]'
            } transition-colors`}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1 text-left">
          <p
            className={`text-sm font-medium ${
              danger ? 'text-[var(--badge-danger-text,#D93025)]' : 'text-[var(--text-primary,#1F1F1F)]'
            }`}
          >
            {label}
          </p>
          {description && (
            <p className="text-xs text-[var(--text-muted,#5F6368)] mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Value display */}
        {badge ? (
          <span
            className={`text-[11px] font-medium uppercase px-2.5 py-0.5 rounded-full border ${BADGE_COLORS[badge.color]}`}
          >
            {badge.text}
          </span>
        ) : value ? (
          <span className="text-sm text-[var(--text-secondary,#444746)] truncate max-w-[200px]">
            {value}
          </span>
        ) : null}

        {/* Action */}
        {action === 'arrow' && (
          <ChevronRight className="w-4 h-4 text-[var(--text-muted,#747775)] group-hover:text-[var(--text-primary,#1F1F1F)] transition-all group-hover:translate-x-0.5" />
        )}
        {action === 'toggle' && (
          <ToggleSwitch
            checked={localToggle}
            onChange={(next) => {
              setLocalToggle(next);
              onToggle?.(next);
            }}
            disabled={disabled}
            ariaLabel={label}
          />
        )}
        {action === 'custom' && customAction}
      </div>
    </Wrapper>
  );
}
