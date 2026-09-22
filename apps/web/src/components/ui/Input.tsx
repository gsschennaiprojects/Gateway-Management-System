'use client';

import React, { useState, useId } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
  maxCharCount?: number;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  showPasswordToggle = false,
  maxCharCount,
  className = '',
  type = 'text',
  id,
  value,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const autoId = useId();
  const inputId = id || autoId;

  const isPassword = type === 'password';
  const resolvedType = isPassword && showPassword ? 'text' : type;
  const hasValue = value !== undefined && value !== '';

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-xs font-medium transition-colors duration-200 ${
            isFocused ? 'text-[var(--brand-primary)]' : error ? 'text-[var(--badge-danger-text,#D93025)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          {label}
        </label>
      )}

      <div className="relative group">
        {/* Left Icon */}
        {leftIcon && (
          <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200 ${
            isFocused ? 'text-[var(--brand-primary)]' : error ? 'text-[var(--badge-danger-text,#D93025)]' : 'text-[var(--text-muted)]'
          }`}>
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          type={resolvedType}
          value={value}
          className={`w-full h-10 ${leftIcon ? 'pl-10' : 'pl-3.5'} ${
            showPasswordToggle ? 'pr-10' : 'pr-3.5'
          } bg-[var(--bg-card)] text-sm text-[var(--text-primary)] rounded-lg border transition-all duration-200 placeholder:text-[var(--text-muted)] ${
            error
              ? 'border-[var(--badge-danger-border,#D93025)] focus:border-[var(--badge-danger-text,#D93025)] focus:ring-2 focus:ring-[var(--badge-danger-text,#D93025)]/20'
              : 'border-[var(--border-card)] hover:border-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20'
          } focus:outline-none ${className}`}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />

        {/* Password Toggle */}
        {showPasswordToggle && isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5 rounded cursor-pointer"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4 transition-transform duration-200" />
            ) : (
              <Eye className="w-4 h-4 transition-transform duration-200" />
            )}
          </button>
        )}
      </div>

      {/* Error / Hint / Character Count */}
      <div className="flex items-center justify-between gap-2 min-h-[16px]">
        {error ? (
          <p className="text-[11px] text-[var(--badge-danger-text,#D93025)] flex items-center gap-1 animate-fade-in-up font-medium">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{error}</span>
          </p>
        ) : hint ? (
          <p className="text-[11px] text-[var(--text-muted)] font-mono">{hint}</p>
        ) : (
          <span />
        )}

        {maxCharCount && typeof value === 'string' && (
          <span className={`text-[10px] font-mono tabular-nums ${
            value.length > maxCharCount ? 'text-[var(--badge-danger-text,#D93025)]' : 'text-[var(--text-muted)]'
          }`}>
            {value.length}/{maxCharCount}
          </span>
        )}
      </div>
    </div>
  );
}
