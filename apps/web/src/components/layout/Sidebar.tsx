'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { BrandLogo } from '@/components/ui/BrandLogo';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  FileSpreadsheet,
  MailCheck,
  ShieldAlert,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  MoreHorizontal,
  CheckSquare,
  Settings,
  GraduationCap,
  ClipboardList,
  BookOpen
} from 'lucide-react';

export interface NavSubItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon?: React.ReactNode;
  allowedRoles: string[];
}

export interface NavItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: React.ReactNode;
  allowedRoles: string[];
  subItems?: NavSubItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    shortLabel: 'Home',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    allowedRoles: ['employee', 'intern', 'admin', 'superadmin']
  },
  {
    label: 'Daily Worklog',
    shortLabel: 'Worklog',
    href: '/worklog',
    icon: <ClipboardList className="w-5 h-5" />,
    allowedRoles: ['superadmin', 'admin', 'hr', 'employee', 'intern']
  },
  {
    label: 'Student Management',
    shortLabel: 'Students',
    href: '/students',
    icon: <GraduationCap className="w-5 h-5" />,
    allowedRoles: ['superadmin', 'admin', 'hr', 'employee', 'intern']
  },
  {
    label: 'Tasks & Delegations',
    shortLabel: 'Tasks',
    href: '/tasks',
    icon: <CheckSquare className="w-5 h-5" />,
    allowedRoles: ['superadmin', 'admin', 'hr', 'employee', 'intern']
  },
  {
    label: 'Employee Directory',
    shortLabel: 'Directory',
    href: '/admin/directory',
    icon: <Users className="w-5 h-5" />,
    allowedRoles: ['admin', 'superadmin', 'hr']
  },
  {
    label: 'Attendance Master',
    shortLabel: 'Attendance',
    href: '/admin/attendance',
    icon: <CalendarCheck className="w-5 h-5" />,
    allowedRoles: ['admin', 'superadmin', 'hr']
  },
  {
    label: 'Leads & Inquiries',
    shortLabel: 'Leads',
    href: '/leads',
    icon: <MailCheck className="w-5 h-5" />,
    allowedRoles: ['hr', 'admin', 'superadmin']
  },
  {
    label: 'Monthly Reports',
    shortLabel: 'Reports',
    href: '/reports',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    allowedRoles: ['employee', 'intern', 'hr', 'admin', 'superadmin']
  },
  {
    label: 'User Management',
    shortLabel: 'Users',
    href: '/admin/users',
    icon: <ShieldAlert className="w-5 h-5" />,
    allowedRoles: ['admin', 'superadmin']
  }
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { isCollapsed, toggleCollapse } = useSidebar();
  const pathname = usePathname();

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Accordion state for sub-items
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  // Auto-expand if current route matches any sub-item
  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.subItems?.some((sub) => pathname === sub.href || pathname.startsWith(sub.href + '/'))) {
        setExpandedMenus((prev) => ({ ...prev, [item.label]: true }));
      }
    });
  }, [pathname]);

  const toggleSubMenu = (label: string) => {
    setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleOpenDrawer = () => setMobileDrawerOpen(true);
  const handleCloseDrawer = () => setMobileDrawerOpen(false);

  // Filter items by role and filter sub-items accordingly
  const userRole = user?.role || 'employee';
  const filteredNav = NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(userRole)
  ).map((item) => {
    if (item.subItems) {
      const allowedSubs = item.subItems.filter((sub) =>
        sub.allowedRoles.includes(userRole)
      );
      const defaultHref = allowedSubs.some((s) => s.href === item.href)
        ? item.href
        : (allowedSubs[0]?.href || item.href);
      return {
        ...item,
        href: defaultHref,
        subItems: allowedSubs,
      };
    }
    return item;
  });

  return (
    <>
      {/* -------------------------------------------------------------
          1. Desktop & Tablet Left Rail Navigation
          - Google Workspace Navigation Rail
          - 250px expanded / 76px collapsed
          - Synchronized with Layout & Multi-Theme
      ------------------------------------------------------------- */}
      <aside
        className={`hidden md:flex flex-col justify-between bg-[var(--bg-card,#FFFFFF)] border-r border-[var(--border-card,#DADCE0)] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 z-30 h-screen fixed top-0 bottom-0 left-0 shadow-sm ${
          isCollapsed ? 'w-[76px]' : 'w-[250px]'
        }`}
      >
        {/* Floating Border Toggle Button - never crowds or cuts the logo */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-5 w-6 h-6 rounded-full bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-md flex items-center justify-center text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:scale-110 transition-all z-50 cursor-pointer"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Top Branding Section */}
        <div
          className={`h-16 flex items-center border-b border-[var(--border-card,#DADCE0)] shrink-0 ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-visible group transition-transform active:scale-95"
            title="Gateway Software Solutions"
          >
            <BrandLogo
              size={isCollapsed ? 'sm' : 'md'}
              collapsed={isCollapsed}
            />
          </Link>
        </div>

        {/* Scrollable Navigation Items in middle */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {filteredNav.map((item) => {
            const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
            const isSubActive = Boolean(item.subItems?.some((sub) => pathname === sub.href || pathname.startsWith(sub.href + '/')));
            const isDirectActive = pathname === item.href;
            const isParentActive = isDirectActive || isSubActive;
            const isExpanded = expandedMenus[item.label] ?? isParentActive;

            // Collapsed Rail View (76px)
            if (isCollapsed) {
              if (hasSubItems && item.subItems) {
                return (
                  <div key={item.label} className="relative group">
                    <Link
                      href={item.href}
                      className={`flex items-center justify-center p-2.5 rounded-full text-sm font-medium transition-all duration-200 relative ${
                        isParentActive
                          ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold shadow-xs'
                          : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                      }`}
                      title={item.label}
                    >
                      <span
                        className={`transition-transform duration-200 group-hover:scale-105 shrink-0 ${
                          isParentActive ? 'text-[var(--nav-active-text,#001D35)]' : 'text-[var(--text-secondary,#5F6368)] group-hover:text-[var(--text-primary,#1F1F1F)]'
                        }`}
                      >
                        {item.icon}
                      </span>
                    </Link>

                    {/* Floating Popover Flyout Menu on Rail Hover */}
                    <div className="absolute left-[72px] top-0 py-2 px-1.5 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-200 z-50 min-w-[210px]">
                      <div className="px-3 py-1 text-[11px] font-semibold text-[var(--text-muted,#5F6368)] uppercase tracking-wider border-b border-[var(--border-card,#DADCE0)] mb-1">
                        {item.label}
                      </div>
                      <div className="space-y-0.5">
                        {item.subItems.map((sub) => {
                          const isCurrentSub = pathname === sub.href;
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                                isCurrentSub
                                  ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold'
                                  : 'text-[var(--text-secondary,#444746)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] hover:text-[var(--text-primary,#1F1F1F)]'
                              }`}
                            >
                              <span className={isCurrentSub ? 'text-[var(--nav-active-text,#001D35)]' : 'text-[var(--text-secondary,#5F6368)]'}>
                                {sub.icon}
                              </span>
                              <span className="truncate">{sub.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              // Normal single item collapsed
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-center p-2.5 rounded-full text-sm font-medium transition-all duration-200 relative group ${
                    isDirectActive
                      ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold shadow-xs'
                      : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                  }`}
                  title={item.label}
                >
                  <span
                    className={`transition-transform duration-200 group-hover:scale-105 shrink-0 ${
                      isDirectActive ? 'text-[var(--nav-active-text,#001D35)]' : 'text-[var(--text-secondary,#5F6368)] group-hover:text-[var(--text-primary,#1F1F1F)]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="absolute left-[80px] px-2.5 py-1 rounded-md bg-[var(--text-primary,#1F1F1F)] text-xs text-[var(--bg-card,#FFFFFF)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg z-50">
                    {item.label}
                  </span>
                </Link>
              );
            }

            // Expanded Sidebar View (250px)
            if (hasSubItems && item.subItems) {
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSubMenu(item.label)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 group cursor-pointer ${
                      isParentActive
                        ? 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] font-semibold'
                        : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`transition-transform duration-200 group-hover:scale-105 shrink-0 ${
                          isParentActive
                            ? 'text-[var(--brand-on-container,#1A73E8)]'
                            : 'text-[var(--text-secondary,#5F6368)] group-hover:text-[var(--text-primary,#1F1F1F)]'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    <span
                      className={`text-[var(--text-secondary,#5F6368)] transition-transform duration-200 shrink-0 ${
                        isExpanded ? 'rotate-180 text-[var(--brand-primary,#1A73E8)]' : ''
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>

                  {/* Sub-items accordion */}
                  {isExpanded && (
                    <div className="ml-5 pl-3 border-l-2 border-[var(--border-subtle,#D2E3FC)] space-y-1 py-1">
                      {item.subItems.map((sub) => {
                        const isCurrentSub = pathname === sub.href;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-150 ${
                              isCurrentSub
                                ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold shadow-xs'
                                : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                            }`}
                          >
                            <span className={isCurrentSub ? 'text-[var(--nav-active-text,#001D35)]' : 'text-[var(--text-secondary,#5F6368)]'}>
                              {sub.icon}
                            </span>
                            <span className="truncate">{sub.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Normal single item expanded
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 relative group ${
                  isDirectActive
                    ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold'
                    : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                }`}
              >
                <span
                  className={`transition-transform duration-200 group-hover:scale-105 shrink-0 ${
                    isDirectActive ? 'text-[var(--nav-active-text,#001D35)]' : 'text-[var(--text-secondary,#5F6368)] group-hover:text-[var(--text-primary,#1F1F1F)]'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Account Settings Link */}
        <div className="px-3 pb-2">
          <Link
            href="/account"
            className={`flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 relative group ${
              pathname.startsWith('/account')
                ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold'
                : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
            }`}
            title={isCollapsed ? 'Account Settings' : undefined}
          >
            <span
              className={`transition-transform duration-200 group-hover:scale-105 shrink-0 ${
                pathname.startsWith('/account') ? 'text-[var(--nav-active-text,#001D35)]' : 'text-[var(--text-secondary,#5F6368)] group-hover:text-[var(--text-primary,#1F1F1F)]'
              }`}
            >
              <Settings className="w-5 h-5" />
            </span>
            {!isCollapsed ? (
              <span className="truncate">Account Settings</span>
            ) : (
              <span className="absolute left-[80px] px-2.5 py-1 rounded-md bg-[var(--text-primary,#1F1F1F)] text-xs text-[var(--bg-card,#FFFFFF)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg z-50">
                Account Settings
              </span>
            )}
          </Link>
        </div>

        {/* Bottom User Profile Section */}
        <div className="p-3 border-t border-[var(--border-card,#DADCE0)] bg-[var(--bg-card-subtle,#F8FAFD)] shrink-0">
          {user && (
            <div
              className={`flex items-center ${
                isCollapsed ? 'justify-center p-1.5' : 'justify-between p-2'
              } rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs transition-colors`}
              title={isCollapsed ? `${user.name} (${user.role})` : undefined}
            >
              <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-[var(--border-card,#DADCE0)] shrink-0 bg-[var(--brand-container,#E8F0FE)] flex items-center justify-center relative shadow-xs">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[var(--brand-primary,#1A73E8)]">
                      {user.name.charAt(0)}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="truncate text-left min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary,#1F1F1F)] truncate">{user.name}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted,#5F6368)]">
                      <span className="text-[var(--brand-primary,#1A73E8)] uppercase font-semibold truncate">
                        {user.role}
                      </span>
                      <span>•</span>
                      <span className="truncate">{user.branch}</span>
                    </div>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <button
                  onClick={logout}
                  className="text-[var(--text-secondary,#5F6368)] hover:text-[var(--badge-danger-text,#D93025)] p-1.5 rounded-full hover:bg-[var(--badge-danger-bg,#FCE8E6)] transition-colors shrink-0 cursor-pointer"
                  title="Sign out of session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* -------------------------------------------------------------
          2. Mobile Bottom Navigation Bar (< 768px)
      ------------------------------------------------------------- */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--bg-card,#FFFFFF)] border-t border-[var(--border-card,#DADCE0)] flex items-center justify-around px-2 z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
      >
        {filteredNav.slice(0, 4).map((item) => {
          const isItemActive = pathname === item.href || Boolean(item.subItems?.some((sub) => pathname === sub.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all ${
                isItemActive ? 'text-[var(--brand-primary,#1A73E8)] font-semibold' : 'text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)]'
              }`}
            >
              <div className="relative">
                <span className={`w-8 h-8 flex items-center justify-center rounded-full ${isItemActive ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)]' : ''}`}>
                  {item.icon}
                </span>
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px] font-medium">
                {item.shortLabel || item.label}
              </span>
            </Link>
          );
        })}

        {/* 5th slot: "More" Drawer Trigger */}
        <button
          onClick={handleOpenDrawer}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] transition-all cursor-pointer"
        >
          <span className="w-8 h-8 flex items-center justify-center rounded-full">
            <MoreHorizontal className="w-5 h-5" />
          </span>
          <span className="text-[10px] mt-0.5 tracking-tight">More</span>
        </button>
      </nav>

      {/* -------------------------------------------------------------
          3. Mobile Slide-Over Drawer Modal (< 768px)
      ------------------------------------------------------------- */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={handleCloseDrawer}
          />

          {/* Drawer Canvas */}
          <div className="relative w-full max-w-xs bg-[var(--bg-card,#FFFFFF)] border-r border-[var(--border-card,#DADCE0)] h-full flex flex-col justify-between p-6 z-10 shadow-2xl animate-panel-entrance">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-card,#DADCE0)]">
                <BrandLogo size="md" />

                <button
                  onClick={handleCloseDrawer}
                  className="p-1.5 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors cursor-pointer"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Identity Card */}
              {user && (
                <div className="my-5 p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)] flex items-center justify-center text-sm font-semibold">
                    {user.name.charAt(0)}
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)] truncate">{user.name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted,#5F6368)]">
                      <span className="text-[var(--brand-primary,#1A73E8)] uppercase text-[11px] font-semibold">
                        {user.role}
                      </span>
                      <span>•</span>
                      <span className="text-[11px]">{user.branch} Branch</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Items in Drawer */}
              <nav className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted,#5F6368)] px-3 mb-2">
                  Navigation Modules
                </p>
                {filteredNav.map((item) => {
                  const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
                  const isItemActive = pathname === item.href || Boolean(item.subItems?.some((sub) => pathname === sub.href));

                  if (hasSubItems && item.subItems) {
                    return (
                      <div key={item.label} className="space-y-1 py-1">
                        <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted,#5F6368)]">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        <div className="pl-4 space-y-1 border-l-2 border-[var(--border-subtle,#D2E3FC)] ml-3">
                          {item.subItems.map((sub) => {
                            const isSubActive = pathname === sub.href;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={handleCloseDrawer}
                                className={`flex items-center gap-3 px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                                  isSubActive
                                    ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold'
                                    : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                                }`}
                              >
                                <span className={isSubActive ? 'text-[var(--nav-active-text,#001D35)]' : 'text-[var(--text-secondary,#5F6368)]'}>
                                  {sub.icon}
                                </span>
                                <span>{sub.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleCloseDrawer}
                      className={`flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                        isItemActive
                          ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold'
                          : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                      }`}
                    >
                      <span className={isItemActive ? 'text-[var(--nav-active-text,#001D35)]' : 'text-[var(--text-secondary,#5F6368)]'}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                <Link
                  href="/account"
                  onClick={handleCloseDrawer}
                  className={`flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                    pathname.startsWith('/account')
                      ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold'
                      : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                  }`}
                >
                  <Settings className="w-5 h-5 text-[var(--text-secondary,#5F6368)]" />
                  <span>Account Settings</span>
                </Link>
              </nav>
            </div>

            {/* Bottom Drawer Actions */}
            <div className="pt-4 border-t border-[var(--border-card,#DADCE0)] space-y-3">
              {user && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-[var(--border-card,#DADCE0)] shrink-0 bg-[var(--brand-container,#E8F0FE)] flex items-center justify-center relative shadow-xs">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-[var(--brand-primary,#1A73E8)]">
                        {user.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-left min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary,#1F1F1F)] truncate">{user.name}</p>
                    <p className="text-[10px] text-[var(--text-muted,#5F6368)] capitalize">{user.role} • {user.branch}</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  handleCloseDrawer();
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[var(--badge-danger-bg,#FCE8E6)] hover:opacity-90 text-[var(--badge-danger-text,#D93025)] border border-[var(--badge-danger-border,#FAD2CF)] text-xs font-medium transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
