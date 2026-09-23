'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Search,
  X,
  LayoutDashboard,
  CheckSquare,
  Users,
  CalendarCheck,
  MailCheck,
  FileSpreadsheet,
  Settings,
  GraduationCap,
  Sparkles,
  Clock,
  PlusCircle,
  FileText,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Command,
  CornerDownLeft,
  Building2
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Actions' | 'Navigation' | 'Staff' | 'Students' | 'Tasks';
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const BASE_NAVIGATION: CommandItem[] = [
  { id: 'nav-dash', title: 'Dashboard Overview', subtitle: 'KPIs, attendance clock & daily operations', category: 'Navigation', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4 text-[#1A73E8]" /> },
  { id: 'nav-stu', title: 'Student Management', subtitle: 'Student directory, mentorship & attendance grid', category: 'Navigation', href: '/students', icon: <GraduationCap className="w-4 h-4 text-[#1A73E8]" /> },
  { id: 'nav-tsk', title: 'Tasks & Delegations', subtitle: 'Operational task board & assignments', category: 'Navigation', href: '/tasks', icon: <CheckSquare className="w-4 h-4 text-[#1E8E3E]" /> },
  { id: 'nav-dir', title: 'Employee Directory', subtitle: 'Staff roster across Chennai, Coimbatore, Madurai, Erode', category: 'Navigation', href: '/admin/directory', icon: <Users className="w-4 h-4 text-[#1A73E8]" /> },
  { id: 'nav-att', title: 'Attendance Master Grid', subtitle: 'Branch-wide clock-in & check-out records', category: 'Navigation', href: '/admin/attendance', icon: <CalendarCheck className="w-4 h-4 text-[#F9AB00]" /> },
  { id: 'nav-aud', title: 'System Audit Log', subtitle: 'Immutable activity log across Firestore & Sheets', category: 'Navigation', href: '/admin/audit', icon: <ShieldAlert className="w-4 h-4 text-[#9333EA]" /> },
  { id: 'nav-lead', title: 'Leads & Inquiries CRM', subtitle: 'Candidate admissions & follow-up pipeline', category: 'Navigation', href: '/leads', icon: <MailCheck className="w-4 h-4 text-[#D93025]" /> },
  { id: 'nav-rep', title: 'Monthly Operational Reports', subtitle: 'Export payroll, attendance & progress summaries', category: 'Navigation', href: '/reports', icon: <FileSpreadsheet className="w-4 h-4 text-[#1E8E3E]" /> },
  { id: 'nav-sec', title: 'Account Security & Sign-in', subtitle: 'Manage password, sessions & security controls', category: 'Navigation', href: '/account/security', icon: <Settings className="w-4 h-4 text-[#5F6368]" /> },
];

export function GoogleHeaderSearchBar() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveStaff, setLiveStaff] = useState<CommandItem[]>([]);
  const [liveTasks, setLiveTasks] = useState<CommandItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Dynamic Action Commands customized to current role
  const quickActions: CommandItem[] = useMemo(() => {
    const actions: CommandItem[] = [
      {
        id: 'act-clock',
        title: 'Clock In / Clock Out',
        subtitle: 'Record attendance punch with timestamp',
        category: 'Actions',
        href: '/dashboard',
        icon: <Clock className="w-4 h-4 text-emerald-600" />,
        badge: 'Action'
      },
      {
        id: 'act-worklog',
        title: 'Submit Daily Worklog',
        subtitle: 'Log planned vs completed tasks & hours',
        category: 'Actions',
        href: '/worklog',
        icon: <FileText className="w-4 h-4 text-blue-600" />,
        badge: 'Action'
      },
      {
        id: 'act-new-task',
        title: 'Create & Assign Task',
        subtitle: 'Delegate priority tasks to branch staff',
        category: 'Actions',
        href: '/tasks',
        icon: <PlusCircle className="w-4 h-4 text-indigo-600" />,
        badge: 'Action'
      },
      {
        id: 'act-add-student',
        title: 'Register New Student',
        subtitle: 'Enroll student and assign branch mentor',
        category: 'Actions',
        href: '/students',
        icon: <GraduationCap className="w-4 h-4 text-purple-600" />,
        badge: 'Action'
      },
    ];

    if (user?.role === 'admin' || user?.role === 'superadmin') {
      actions.unshift({
        id: 'act-approvals',
        title: 'Review Pending User Registrations',
        subtitle: 'Approve new staff and auto-create branch subsheets',
        category: 'Actions',
        href: '/admin/approvals',
        icon: <UserCheck className="w-4 h-4 text-amber-600" />,
        badge: 'Admin'
      });
      actions.push({
        id: 'act-audit',
        title: 'View System Audit Log',
        subtitle: 'Inspect immutable records in 09_System_Audit_Log',
        category: 'Actions',
        href: '/admin/audit',
        icon: <ShieldAlert className="w-4 h-4 text-rose-600" />,
        badge: 'Admin'
      });
    }

    return actions;
  }, [user]);

  // Global hotkey: Ctrl+K / Cmd+K or Slash (/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Fetch live staff & tasks when query has 2+ characters
  useEffect(() => {
    if (query.trim().length < 2) {
      setLiveStaff([]);
      setLiveTasks([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        // Query users
        const resUsers = await fetch('/api/auth/users');
        if (resUsers.ok) {
          const data = await resUsers.json();
          const usersList = (data.users || data || []) as any[];
          const matches = usersList
            .filter((u) => {
              const q = query.toLowerCase();
              return (
                u.name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.id?.toLowerCase().includes(q) ||
                u.branch?.toLowerCase().includes(q)
              );
            })
            .slice(0, 4)
            .map((u) => ({
              id: `staff-${u.id}`,
              title: u.name,
              subtitle: `${u.role.toUpperCase()} • ${u.branch || 'Branch'} • ${u.email}`,
              category: 'Staff' as const,
              href: `/admin/directory?search=${encodeURIComponent(u.name)}`,
              icon: <Users className="w-4 h-4 text-blue-500" />,
              badge: u.branch,
            }));
          setLiveStaff(matches);
        }

        // Query tasks
        const resTasks = await fetch('/api/tasks');
        if (resTasks.ok) {
          const data = await resTasks.json();
          const tasksList = (data.tasks || data || []) as any[];
          const matches = tasksList
            .filter((t) => {
              const q = query.toLowerCase();
              return t.title?.toLowerCase().includes(q) || t.id?.toLowerCase().includes(q);
            })
            .slice(0, 3)
            .map((t) => ({
              id: `task-${t.id}`,
              title: t.title,
              subtitle: `Due: ${t.dueDate || 'N/A'} • Priority: ${t.priority || 'Normal'} • Status: ${t.status}`,
              category: 'Tasks' as const,
              href: `/tasks?id=${encodeURIComponent(t.id)}`,
              icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
              badge: t.priority,
            }));
          setLiveTasks(matches);
        }
      } catch (err) {
        console.warn('Search query non-blocking error:', err);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Aggregate results
  const allFilteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...quickActions.slice(0, 4), ...BASE_NAVIGATION.slice(0, 5)];
    }

    const filteredActions = quickActions.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.subtitle && a.subtitle.toLowerCase().includes(q))
    );
    const filteredNav = BASE_NAVIGATION.filter(
      (n) => n.title.toLowerCase().includes(q) || (n.subtitle && n.subtitle.toLowerCase().includes(q))
    );

    return [...filteredActions, ...liveStaff, ...liveTasks, ...filteredNav];
  }, [query, quickActions, liveStaff, liveTasks]);

  // Keyboard navigation within results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allFilteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allFilteredItems.length) % Math.max(1, allFilteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allFilteredItems[selectedIndex]) {
        handleSelect(allFilteredItems[selectedIndex].href);
      }
    }
  };

  const handleSelect = (href: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <>
      {/* Search Header Trigger Pill */}
      <div className="relative w-full max-w-[560px]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-between w-full h-10 px-4 rounded-full border border-transparent bg-[var(--bg-card-subtle,#EDF2FA)] hover:bg-[var(--bg-card-hover,#E4E9F2)] hover:border-[var(--border-card,#DADCE0)] transition-all cursor-pointer group text-left"
          aria-label="Open Command Center"
        >
          <div className="flex items-center gap-2.5 text-[var(--text-secondary,#5F6368)] group-hover:text-[var(--text-primary,#1F1F1F)]">
            <Search className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
            <span className="text-xs text-[var(--text-muted,#747775)]">
              Search staff, tasks, students, commands...
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-[var(--text-muted,#747775)] px-2 py-0.5 rounded border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)]">
              <Command className="w-2.5 h-2.5" /> K
            </span>
          </div>
        </button>
      </div>

      {/* Universal Command Palette Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          {/* Backdrop Click */}
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />

          {/* Dialog Container */}
          <div
            className="relative w-full max-w-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-2xl overflow-hidden z-10 animate-panel-entrance flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-[var(--border-card,#DADCE0)] gap-3 bg-[var(--bg-card-subtle,#F8FAFD)]">
              <Search className="w-5 h-5 text-[var(--brand-primary,#1A73E8)] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a command, staff name, task title, or student..."
                className="w-full bg-transparent text-sm text-[var(--text-primary,#1F1F1F)] placeholder:text-[var(--text-muted,#747775)] focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded-full text-[var(--text-muted,#747775)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="hidden sm:inline-block text-[10px] font-mono text-[var(--text-muted,#747775)] px-1.5 py-0.5 rounded border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)]">
                ESC
              </kbd>
            </div>

            {/* Scrollable Results List */}
            <div className="overflow-y-auto divide-y divide-[var(--border-subtle,#F1F3F4)] p-2">
              {allFilteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted,#747775)]">
                  <p className="font-medium text-sm text-[var(--text-primary,#1F1F1F)]">No matching results found</p>
                  <p className="mt-1">Try searching by staff name, student ID, task title, or command.</p>
                </div>
              ) : (
                allFilteredItems.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.href)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)]'
                          : 'hover:bg-[var(--nav-hover-bg,#F1F3F4)] text-[var(--text-primary,#1F1F1F)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`p-2 rounded-lg shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[var(--bg-card,#FFFFFF)] text-[var(--brand-primary,#1A73E8)] shadow-xs'
                              : 'bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)]'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0 truncate">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold truncate">{item.title}</span>
                            {item.badge && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="text-[11px] text-[var(--text-muted,#747775)] truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-[10px] font-medium text-[var(--text-muted,#747775)] uppercase tracking-wider">
                          {item.category}
                        </span>
                        {isSelected && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-card,#DADCE0)] bg-[var(--bg-card-subtle,#F8FAFD)] text-[11px] text-[var(--text-muted,#747775)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)]">↑</kbd>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)]">↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)]">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)]">ESC</kbd>
                  Close
                </span>
              </div>

              <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--brand-primary,#1A73E8)]">
                <Building2 className="w-3 h-3" />
                <span>GSS Command Center</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
