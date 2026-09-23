'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Clock, UserCheck, ArrowRight, X, Sparkles } from 'lucide-react';

interface OperationalAlert {
  id: string;
  type: 'urgent' | 'warning' | 'info';
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
}

export function SmartAlertsBanner() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const checkAlerts = async () => {
      const generatedAlerts: OperationalAlert[] = [];

      try {
        // 1. Admin Alert: Pending User Approvals
        if (user.role === 'admin' || user.role === 'superadmin') {
          const res = await fetch('/api/auth/users');
          if (res.ok) {
            const data = await res.json();
            const users = (data.users || data || []) as any[];
            const pendingCount = users.filter((u) => u.status === 'pending').length;
            if (pendingCount > 0) {
              generatedAlerts.push({
                id: 'pending-users-alert',
                type: 'urgent',
                title: 'Pending Staff Registrations',
                message: `${pendingCount} new staff registration${pendingCount > 1 ? 's are' : ' is'} awaiting approval. Approving auto-provisions branch spreadsheet subsheets.`,
                actionLabel: 'Review Approvals',
                actionHref: '/admin/approvals',
              });
            }
          }
        }

        // 2. Task Alert: Overdue or Urgent Tasks
        const resTasks = await fetch('/api/tasks');
        if (resTasks.ok) {
          const taskData = await resTasks.json();
          const tasks = (taskData.tasks || taskData || []) as any[];
          const todayStr = new Date().toISOString().slice(0, 10);
          
          const overdueTasks = tasks.filter(
            (t) => t.status !== 'completed' && t.dueDate && t.dueDate < todayStr
          );

          if (overdueTasks.length > 0) {
            generatedAlerts.push({
              id: 'overdue-tasks-alert',
              type: 'warning',
              title: 'Overdue Operational Tasks',
              message: `You have ${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} past deadline requiring completion or status update.`,
              actionLabel: 'Open Task Board',
              actionHref: '/tasks',
            });
          }
        }
      } catch (err) {
        console.warn('SmartAlerts non-blocking check error:', err);
      }

      setAlerts(generatedAlerts);
    };

    checkAlerts();
  }, [user]);

  const activeAlerts = alerts.filter((a) => !dismissed.includes(a.id));

  if (activeAlerts.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 animate-panel-entrance">
      {activeAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between p-4 rounded-xl border text-xs transition-all shadow-xs ${
            alert.type === 'urgent'
              ? 'bg-amber-50/90 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/80 dark:text-amber-200'
              : 'bg-blue-50/90 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800/80 dark:text-blue-200'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0 pr-4">
            <span
              className={`p-1.5 rounded-lg shrink-0 ${
                alert.type === 'urgent'
                  ? 'bg-amber-200/60 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                  : 'bg-blue-200/60 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
              }`}
            >
              {alert.type === 'urgent' ? (
                <UserCheck className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
            </span>

            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-xs tracking-tight">{alert.title}</p>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold bg-white/70 dark:bg-black/30">
                  {alert.type}
                </span>
              </div>
              <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{alert.message}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={alert.actionHref}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-[11px] shadow-xs transition-all cursor-pointer ${
                alert.type === 'urgent'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <span>{alert.actionLabel}</span>
              <ArrowRight className="w-3 h-3" />
            </Link>

            <button
              onClick={() => setDismissed((prev) => [...prev, alert.id])}
              className="p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              title="Dismiss alert"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
