import React from 'react';
import { Inbox, Search, FileText, Users, LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: 'inbox' | 'search' | 'file' | 'users' | React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const iconMap: Record<'inbox' | 'search' | 'file' | 'users', LucideIcon> = {
  inbox: Inbox,
  search: Search,
  file: FileText,
  users: Users,
};

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  const IconComponent =
    typeof icon === 'string' && icon in iconMap
      ? iconMap[icon as keyof typeof iconMap]
      : null;

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {/* Icon with ambient glow */}
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full blur-2xl opacity-25 bg-gradient-to-r from-[#0093F7] to-[#FD7602]" />
        <div className="relative w-16 h-16 rounded-2xl bg-[var(--bg-card-subtle,#F1F3F4)] border border-[var(--border-card,#DADCE0)] flex items-center justify-center shadow-sm">
          {IconComponent ? (
            <IconComponent className="w-7 h-7 text-[var(--brand-primary,#1A73E8)]" />
          ) : (
            <span className="text-[var(--text-muted,#747775)]">{icon}</span>
          )}
        </div>
      </div>

      <h3 className="font-semibold text-lg text-[var(--text-primary,#1F1F1F)] mb-1.5">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-[var(--text-secondary,#444746)] max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
