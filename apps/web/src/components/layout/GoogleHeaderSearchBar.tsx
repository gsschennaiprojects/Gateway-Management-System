'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, LayoutDashboard, CheckSquare, Users, CalendarCheck, MailCheck, FileSpreadsheet, Settings, GraduationCap, BookOpen } from 'lucide-react';

interface SearchOption {
  title: string;
  category: string;
  href: string;
  icon: React.ReactNode;
}

const SEARCH_OPTIONS: SearchOption[] = [
  { title: 'Dashboard Overview', category: 'Navigation', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4 text-[#1A73E8]" /> },
  { title: 'Student Management (Directory & Attendance)', category: 'Training', href: '/students', icon: <GraduationCap className="w-4 h-4 text-[#1A73E8]" /> },
  { title: 'Tasks & Delegations', category: 'Operations', href: '/tasks', icon: <CheckSquare className="w-4 h-4 text-[#1E8E3E]" /> },
  { title: 'Employee & Staff Directory', category: 'People', href: '/admin/directory', icon: <Users className="w-4 h-4 text-[#1A73E8]" /> },
  { title: 'Attendance Master Grid', category: 'Attendance', href: '/admin/attendance', icon: <CalendarCheck className="w-4 h-4 text-[#F9AB00]" /> },
  { title: 'Leads & Inquiries CRM', category: 'Marketing', href: '/leads', icon: <MailCheck className="w-4 h-4 text-[#D93025]" /> },
  { title: 'Monthly Operational Reports', category: 'Audit', href: '/reports', icon: <FileSpreadsheet className="w-4 h-4 text-[#1E8E3E]" /> },
  { title: 'Account Settings', category: 'Settings', href: '/account', icon: <Settings className="w-4 h-4 text-[#5F6368]" /> },
  { title: 'Security & Sign-in', category: 'Settings', href: '/account/security', icon: <Settings className="w-4 h-4 text-[#1A73E8]" /> },
  { title: 'Personal Info', category: 'Settings', href: '/account/personal-info', icon: <Settings className="w-4 h-4 text-[#1A73E8]" /> },
];

export function GoogleHeaderSearchBar() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = query.trim()
    ? SEARCH_OPTIONS.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_OPTIONS.slice(0, 5);

  const handleSelect = (href: string) => {
    setIsFocused(false);
    setQuery('');
    router.push(href);
  };

  return (
    <div className="relative w-full max-w-[620px]" ref={containerRef}>
      {/* Pill Input Container */}
      <div
        className={`flex items-center w-full h-11 px-4 rounded-full border transition-all ${
          isFocused
            ? 'bg-[var(--bg-card,#FFFFFF)] border-[var(--border-card,#DADCE0)] shadow-md'
            : 'bg-[var(--bg-card-subtle,#EDF2FA)] hover:bg-[var(--bg-card-hover,#E4E9F2)] border-transparent'
        }`}
      >
        <Search className={`w-5 h-5 shrink-0 transition-colors ${isFocused ? 'text-[var(--brand-primary,#1A73E8)]' : 'text-[var(--text-secondary,#5F6368)]'}`} />
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search staff, attendance, tasks, leads, settings..."
          className="w-full bg-transparent px-3 text-sm text-[var(--text-primary,#1F1F1F)] placeholder:text-[var(--text-muted,#5F6368)] focus:outline-none"
        />

        {query ? (
          <button
            onClick={() => setQuery('')}
            className="p-1 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <span className="hidden sm:inline-flex items-center text-[11px] font-mono text-[var(--text-muted,#747775)] px-2 py-0.5 rounded border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)]">
            Ctrl+K
          </span>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isFocused && (
        <div className="absolute left-0 right-0 mt-2 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-panel-entrance py-2">
          <div className="text-[10px] font-semibold text-[var(--text-muted,#747775)] uppercase tracking-wider px-4 py-1.5">
            {query.trim() ? 'Matching Results' : 'Suggested Destinations'}
          </div>

          <div className="divide-y divide-[var(--border-subtle,#F1F3F4)]">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-muted,#747775)]">
                No matching results found for &ldquo;{query}&rdquo;.
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleSelect(item.href)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-full bg-[var(--bg-card-subtle,#F8FAFD)] group-hover:bg-[var(--bg-card,#FFFFFF)] transition-colors">
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary,#1F1F1F)] group-hover:text-[var(--brand-primary,#1A73E8)] transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted,#747775)]">
                        {item.category}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted,#747775)] group-hover:text-[var(--brand-primary,#1A73E8)] font-medium transition-colors">
                    Jump to ↗
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
