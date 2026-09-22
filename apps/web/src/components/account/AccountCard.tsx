import React from 'react';
import { ChevronRight } from 'lucide-react';

interface AccountCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footerLink?: { label: string; onClick?: () => void; href?: string };
  className?: string;
  noPadding?: boolean;
}

export function AccountCard({
  title,
  description,
  icon,
  children,
  footerLink,
  className = '',
  noPadding = false,
}: AccountCardProps) {
  return (
    <div
      className={`glass-panel overflow-hidden animate-fade-in-up ${className}`}
    >
      {/* Header */}
      {(title || description) && (
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          {icon && (
            <span className="shrink-0 mt-0.5 text-[var(--brand-primary,#1A73E8)]">{icon}</span>
          )}
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1 leading-relaxed max-w-[600px]">
                {description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Divider below header */}
      {(title || description) && (
        <div className="mx-5 h-px bg-[var(--border-subtle,#DADCE0)]" />
      )}

      {/* Content */}
      <div className={noPadding ? '' : 'py-1'}>
        {children}
      </div>

      {/* Footer link */}
      {footerLink && (
        <>
          <div className="mx-5 h-px bg-[var(--border-subtle,#DADCE0)]" />
          <button
            type="button"
            onClick={footerLink.onClick}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-[var(--brand-primary,#1A73E8)] hover:bg-[var(--nav-hover-bg,#F8FAFD)] transition-colors group cursor-pointer"
          >
            <span>{footerLink.label}</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </>
      )}
    </div>
  );
}
