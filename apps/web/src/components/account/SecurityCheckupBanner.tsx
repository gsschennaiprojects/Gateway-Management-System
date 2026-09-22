'use client';

import React from 'react';
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, ChevronRight } from 'lucide-react';

type SecurityStatus = 'safe' | 'warning' | 'critical';

interface SecurityCheckupBannerProps {
  status?: SecurityStatus;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<SecurityStatus, {
  icon: React.ReactNode;
  bg: string;
  borderColor: string;
  iconColor: string;
  defaultTitle: string;
  defaultDesc: string;
}> = {
  safe: {
    icon: <ShieldCheck className="w-8 h-8" />,
    bg: 'bg-[var(--badge-success-bg,#E6F4EA)]',
    borderColor: 'border-[var(--badge-success-border,#CEEAD6)]',
    iconColor: 'text-[var(--badge-success-text,#1E8E3E)]',
    defaultTitle: 'Your account is protected',
    defaultDesc: 'Security checkup found no issues. Your account has standard protections in place.',
  },
  warning: {
    icon: <ShieldAlert className="w-8 h-8" />,
    bg: 'bg-[var(--badge-warning-bg,#FEF7E0)]',
    borderColor: 'border-[var(--badge-warning-border,#FEEFC3)]',
    iconColor: 'text-[var(--badge-warning-text,#F9AB00)]',
    defaultTitle: 'Security suggestions available',
    defaultDesc: 'Review recommended actions to improve your account security.',
  },
  critical: {
    icon: <AlertTriangle className="w-8 h-8" />,
    bg: 'bg-[var(--badge-danger-bg,#FCE8E6)]',
    borderColor: 'border-[var(--badge-danger-border,#FAD2CF)]',
    iconColor: 'text-[var(--badge-danger-text,#D93025)]',
    defaultTitle: 'Critical security issues found',
    defaultDesc: 'Your account may be at risk. Take action now to secure it.',
  },
};

export function SecurityCheckupBanner({
  status = 'safe',
  title,
  description,
  actionLabel = 'Review security',
  onAction,
  className = '',
}: SecurityCheckupBannerProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${config.bg} border ${config.borderColor} p-6 animate-fade-in-up transition-colors duration-200 ${className}`}
    >
      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <div className={`shrink-0 ${config.iconColor} mt-0.5`}>
          {config.icon}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
            {title || config.defaultTitle}
          </h3>
          <p className="text-sm text-[var(--text-secondary,#444746)] mt-1 leading-relaxed">
            {description || config.defaultDesc}
          </p>
        </div>

        {/* Action */}
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-[var(--text-primary,#1F1F1F)] bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] hover:bg-[var(--nav-hover-bg,#F8FAFD)] transition-all duration-200 group shadow-xs cursor-pointer"
          >
            <span>{actionLabel}</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}
