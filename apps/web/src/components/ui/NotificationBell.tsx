'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Users, Clock, CheckSquare, X } from 'lucide-react';
import { TaskNotification } from '@/types/task';
import Link from 'next/link';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAllRead = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' })
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id })
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className={`relative p-2.5 rounded-full transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)]'
            : 'text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
        }`}
        aria-label="View task notifications"
        title="Task Notifications"
      >
        <Bell className="w-5 h-5" />

        {/* Unread Google Red Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D93025] text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Floating Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[360px] sm:w-[400px] max-w-[calc(100vw-24px)] rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-2xl z-50 overflow-hidden animate-panel-entrance text-[var(--text-primary,#1F1F1F)]">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-card,#DADCE0)] flex items-center justify-between bg-[var(--bg-card,#FFFFFF)]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[var(--text-primary,#1F1F1F)]">
                Task Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)] text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-[11px] font-medium text-[var(--brand-primary,#1A73E8)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-[var(--border-subtle,#F1F3F4)]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <CheckSquare className="w-8 h-8 text-[var(--text-muted,#5F6368)] mx-auto mb-2 opacity-40" />
                <p className="text-xs text-[var(--text-secondary,#444746)] font-medium">No notifications right now.</p>
                <p className="text-[10px] text-[var(--text-muted,#747775)] mt-0.5">
                  Assigned tasks and team dispatches will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markSingleRead(notif.id)}
                  className={`p-3.5 transition-colors cursor-pointer hover:bg-[var(--nav-hover-bg,#F8FAFD)] ${
                    !notif.isRead ? 'bg-[var(--brand-container,#E8F0FE)]/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {notif.type === 'team_task' && notif.teamName ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border border-[var(--badge-warning-border,#FEEFC3)]">
                            <Users className="w-2.5 h-2.5" />
                            <span>Team: {notif.teamName}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)]">
                            <span>Direct Assignment</span>
                          </span>
                        )}

                        <span className="text-[10px] text-[var(--text-muted,#747775)] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[var(--text-primary,#1F1F1F)] leading-snug">
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary,#5F6368)] leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with link to Task Center */}
          <div className="p-3 border-t border-[var(--border-card,#DADCE0)] bg-[var(--bg-card-subtle,#F8FAFD)] text-center">
            <Link
              href="/tasks"
              onClick={() => setIsOpen(false)}
              className="text-xs text-[var(--brand-primary,#1A73E8)] hover:underline font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>View All Tasks in Task Center</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
