'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface QuickChip {
  label: string;
  href: string;
}

interface AccountSearchBarProps {
  placeholder?: string;
  chips?: QuickChip[];
  onSearch?: (query: string) => void;
  onChipClick?: (chip: QuickChip) => void;
  className?: string;
}

const DEFAULT_CHIPS: QuickChip[] = [
  { label: 'My Password', href: '/account/security' },
  { label: 'Devices', href: '/account/security' },
  { label: 'Notifications', href: '/account/people-sharing' },
  { label: 'My Activity', href: '/account/data-privacy' },
  { label: 'Email', href: '/account/personal-info' },
];

export function AccountSearchBar({
  placeholder = 'Search GSS Account settings',
  chips = DEFAULT_CHIPS,
  onSearch,
  onChipClick,
  className = '',
}: AccountSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <div className={`w-full max-w-xl mx-auto ${className}`}>
      {/* Search Input */}
      <div className="relative group">
        <Search
          className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${
            isFocused ? 'text-[var(--brand-primary,#1A73E8)]' : 'text-[var(--text-secondary,#5F6368)]'
          }`}
        />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`w-full h-12 pl-12 pr-5 rounded-full text-sm text-[var(--text-primary,#1F1F1F)] border transition-all duration-200 placeholder:text-[var(--text-muted,#747775)] focus:outline-none ${
            isFocused
              ? 'border-[var(--border-focus,#1A73E8)] bg-[var(--bg-card,#FFFFFF)] shadow-[0_1px_6px_rgba(0,0,0,0.18)]'
              : 'border-[var(--border-subtle,#E8EAED)] bg-[var(--bg-card-subtle,#EDF2FA)] hover:bg-[var(--bg-card-hover,#E4E9F2)]'
          }`}
        />
      </div>

      {/* Quick Chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onChipClick?.(chip)}
              className="px-4 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary,#444746)] bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] hover:bg-[var(--nav-hover-bg,#F8FAFD)] hover:text-[var(--text-primary,#1F1F1F)] hover:border-[var(--border-focus,#1A73E8)] transition-all duration-200 active:scale-[0.98] shadow-xs cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
