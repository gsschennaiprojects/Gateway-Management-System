'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  LayoutDashboard,
  CheckSquare,
  Users,
  CalendarCheck,
  MailCheck,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  GraduationCap,
  BookOpen
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AppItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  allowedRoles?: string[];
}

const GSS_APPS: AppItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-6 h-6" />,
    bgColor: 'bg-[var(--brand-container,#E8F0FE)]',
    textColor: 'text-[var(--brand-on-container,#1A73E8)]',
  },
  {
    name: 'Students',
    href: '/students',
    icon: <GraduationCap className="w-6 h-6" />,
    bgColor: 'bg-[var(--brand-container,#E8F0FE)]',
    textColor: 'text-[var(--brand-on-container,#1A73E8)]',
    allowedRoles: ['superadmin', 'admin', 'hr', 'employee', 'intern'],
  },
  {
    name: 'Tasks',
    href: '/tasks',
    icon: <CheckSquare className="w-6 h-6" />,
    bgColor: 'bg-[var(--badge-success-bg,#E6F4EA)]',
    textColor: 'text-[var(--badge-success-text,#1E8E3E)]',
  },
  {
    name: 'Attendance',
    href: '/admin/attendance',
    icon: <CalendarCheck className="w-6 h-6" />,
    bgColor: 'bg-[var(--badge-warning-bg,#FEF7E0)]',
    textColor: 'text-[var(--badge-warning-text,#B06000)]',
    allowedRoles: ['admin', 'superadmin', 'hr'],
  },
  {
    name: 'Directory',
    href: '/admin/directory',
    icon: <Users className="w-6 h-6" />,
    bgColor: 'bg-[var(--brand-container,#E8F0FE)]',
    textColor: 'text-[var(--brand-on-container,#1A73E8)]',
    allowedRoles: ['admin', 'superadmin', 'hr'],
  },
  {
    name: 'Leads CRM',
    href: '/leads',
    icon: <MailCheck className="w-6 h-6" />,
    bgColor: 'bg-[var(--badge-danger-bg,#FCE8E6)]',
    textColor: 'text-[var(--badge-danger-text,#D93025)]',
    allowedRoles: ['admin', 'superadmin', 'hr'],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: <FileSpreadsheet className="w-6 h-6" />,
    bgColor: 'bg-[var(--badge-success-bg,#E6F4EA)]',
    textColor: 'text-[var(--badge-success-text,#1E8E3E)]',
  },
  {
    name: 'Account',
    href: '/account',
    icon: <Settings className="w-6 h-6" />,
    bgColor: 'bg-[var(--bg-card-subtle,#F1F3F4)]',
    textColor: 'text-[var(--text-secondary,#444746)]',
  },
  {
    name: 'Security',
    href: '/account/security',
    icon: <ShieldCheck className="w-6 h-6" />,
    bgColor: 'bg-[var(--brand-container,#E8F0FE)]',
    textColor: 'text-[var(--brand-on-container,#1A73E8)]',
  },
];

export function GoogleAppsLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredApps = GSS_APPS.filter(
    (app) => !app.allowedRoles || (user && app.allowedRoles.includes(user.role))
  );

  return (
    <div className="relative" ref={containerRef}>
      {/* 9-dot Waffle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2.5 rounded-full transition-colors cursor-pointer ${
          isOpen
            ? 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)]'
            : 'text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
        }`}
        title="GSS Apps"
        aria-label="GSS Apps Launcher"
      >
        <LayoutGrid className="w-5 h-5" />
      </button>

      {/* Google Waffle Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[320px] max-w-[calc(100vw-1.5rem)] rounded-3xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-2xl p-4 z-50 animate-panel-entrance">
          <div className="text-[11px] font-semibold text-[var(--text-muted,#5F6368)] uppercase tracking-wider px-2 mb-3">
            Gateway Software Solutions Apps
          </div>

          <div className="grid grid-cols-3 gap-2">
            {filteredApps.map((app) => (
              <Link
                key={app.name}
                href={app.href}
                onClick={() => setIsOpen(false)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl hover:bg-[var(--bg-card-subtle,#F8FAFD)] transition-all group cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${app.bgColor} ${app.textColor} flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 group-active:scale-95 shadow-xs`}
                >
                  {app.icon}
                </div>
                <span className="text-xs font-medium text-[var(--text-primary,#1F1F1F)] text-center truncate max-w-[80px]">
                  {app.name}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--border-subtle,#DADCE0)] text-center">
            <Link
              href="/account"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-[var(--brand-primary,#1A73E8)] hover:underline"
            >
              Manage your GSS Account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
