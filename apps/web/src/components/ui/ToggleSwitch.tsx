'use client';

import React from 'react';
import { Check, X } from 'lucide-react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  name?: string;
  ariaLabel?: string;
  showIcon?: boolean;
  className?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  id,
  name,
  ariaLabel,
  showIcon = true,
  className = '',
}: ToggleSwitchProps) {
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onChange(!checked);
    }
  };

  const sizeClass = size === 'sm' ? 'gms-toggle-sm' : size === 'lg' ? 'gms-toggle-lg' : 'gms-toggle-md';
  const iconClass = size === 'sm' ? 'w-2.5 h-2.5 stroke-[3]' : size === 'lg' ? 'w-4 h-4 stroke-[2.75]' : 'w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.75]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || 'Toggle switch'}
      disabled={disabled}
      id={id}
      name={name}
      data-checked={checked ? 'true' : 'false'}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={`gms-toggle-track ${sizeClass} ${className}`}
    >
      {/* Sliding Thumb Knob */}
      <span className="gms-toggle-thumb">
        {showIcon && (
          <span className="flex items-center justify-center transition-opacity duration-200">
            {checked ? (
              <Check className={iconClass} />
            ) : (
              <X className={iconClass} />
            )}
          </span>
        )}
      </span>
    </button>
  );
}
