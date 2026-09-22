import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'orange' | 'brand';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconOnly?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  iconOnly = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none overflow-hidden';

  const sizeStyles = {
    xs: `text-[11px] px-3 py-1 gap-1 ${iconOnly ? 'w-7 h-7 p-0' : 'h-7'}`,
    sm: `text-xs px-4 py-1.5 gap-1.5 ${iconOnly ? 'w-8 h-8 p-0' : 'h-8'}`,
    md: `text-sm px-5 py-2 gap-2 ${iconOnly ? 'w-10 h-10 p-0' : 'h-10'}`,
    lg: `text-base px-6 py-2.5 gap-2.5 ${iconOnly ? 'w-12 h-12 p-0' : 'h-12'}`,
  }[size];

  const variantStyles = {
    primary:
      'bg-[var(--brand-primary,#1A73E8)] hover:bg-[var(--brand-primary-hover,#1557B0)] active:opacity-90 text-[var(--text-on-brand,#FFFFFF)] font-medium shadow-sm hover:shadow',
    orange:
      'bg-[#FD7602] hover:bg-[#E65100] text-white font-medium shadow-sm',
    brand:
      'bg-[var(--brand-primary,#1A73E8)] hover:bg-[var(--brand-primary-hover,#1557B0)] text-[var(--text-on-brand,#FFFFFF)] font-medium shadow-sm',
    secondary:
      'bg-[var(--bg-card,#FFFFFF)] hover:bg-[var(--bg-card-hover,#F8FAFD)] text-[var(--brand-primary,#1A73E8)] border border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)] font-medium shadow-sm',
    danger:
      'bg-[var(--badge-danger-text,#D93025)] hover:opacity-90 text-white font-medium shadow-sm',
    ghost:
      'text-[var(--text-secondary,#444746)] hover:bg-[var(--bg-card-subtle,#F1F3F4)] hover:text-[var(--text-primary,#1F1F1F)] font-medium',
    success:
      'bg-[var(--badge-success-text,#1E8E3E)] hover:opacity-90 text-white font-medium shadow-sm',
  }[variant];

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className} group`}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Dynamic light sweep effect */}
      {(variant === 'primary' || variant === 'orange' || variant === 'brand') && (
        <span className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <span className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg] group-hover:left-[150%] transition-all duration-700 ease-out" />
        </span>
      )}

      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">{leftIcon}</span>}
          {!iconOnly && <span>{children}</span>}
          {rightIcon && <span className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
