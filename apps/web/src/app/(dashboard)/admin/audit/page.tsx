'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, RefreshCw, Filter, Search, Download, Calendar, User, Building2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { StatusChip } from '@/components/ui/StatusChip';
import { BRANCHES } from '@/types/auth';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: string;
  action: string;
  module: string;
  recordId: string;
  branch: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
}

export default function AdminAuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('All');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchFilter !== 'All') params.set('branch', branchFilter);
      if (moduleFilter !== 'all') params.set('module', moduleFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [branchFilter, moduleFilter]);

  const filteredLogs = logs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.userName?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.recordId?.toLowerCase().includes(q) ||
      l.module?.toLowerCase().includes(q)
    );
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes('APPROVED') || action.includes('CREATED')) return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    if (action.includes('REJECTED') || action.includes('DELETE')) return 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    if (action.includes('LOGIN')) return 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    if (action.includes('LOGOUT')) return 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    return 'text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Log ID', 'Timestamp', 'Actor Name', 'Role', 'Action', 'Module', 'Record ID', 'Branch', 'Old Value', 'New Value'];
    const rows = filteredLogs.map(l => [
      l.id,
      l.timestamp,
      `"${l.userName || ''}"`,
      l.role,
      l.action,
      l.module,
      l.recordId,
      l.branch,
      `"${l.oldValue || ''}"`,
      `"${l.newValue || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GSS_System_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[var(--text-primary,#1F1F1F)] tracking-tight">
              Enterprise Audit & Activity Trail
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)]">
              <ShieldAlert className="w-3 h-3" />
              Dual-Logged: Sheets + Firestore
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1">
            Immutable system logs recorded to Google Sheet <code className="font-mono text-emerald-600 dark:text-emerald-400">09_System_Audit_Log</code> and Firestore collection <code className="font-mono text-blue-600 dark:text-blue-400">audit_logs</code>.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Filter */}
          <div className="flex items-center gap-2 text-xs">
            <Building2 className="w-4 h-4 text-[var(--text-muted,#747775)]" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-[var(--bg-canvas,#F8FAFD)] border border-[var(--border-card,#DADCE0)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1A73E8)]"
            >
              <option value="All">All Branches (CHN, CBE, MDU, ERD)</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b} Branch
                </option>
              ))}
            </select>
          </div>

          {/* Module Filter */}
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-4 h-4 text-[var(--text-muted,#747775)]" />
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-[var(--bg-canvas,#F8FAFD)] border border-[var(--border-card,#DADCE0)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1A73E8)]"
            >
              <option value="all">All Modules</option>
              <option value="AUTH">Authentication (Login/Logout)</option>
              <option value="STAFF">Staff & Directory</option>
              <option value="TASKS">Tasks & Delegations</option>
              <option value="STUDENTS">Students & Mentorship</option>
              <option value="WORKLOGS">Daily Worklogs</option>
              <option value="ATTENDANCE">Staff Attendance</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--text-muted,#747775)]" />
          <input
            type="text"
            placeholder="Search action, actor, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-canvas,#F8FAFD)] border border-[var(--border-card,#DADCE0)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary,#1F1F1F)] placeholder:text-[var(--text-muted,#747775)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1A73E8)]"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-card-subtle,#F8FAFD)] text-[var(--text-secondary,#5F6368)] uppercase tracking-wider text-[10px] font-semibold border-b border-[var(--border-card,#DADCE0)]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Actor / Role</th>
                <th className="px-4 py-3">Target Record</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Details / Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle,#F1F3F4)] font-normal text-[var(--text-primary,#1F1F1F)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-[var(--text-muted,#747775)]">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[var(--brand-primary,#1A73E8)]" />
                      <span>Loading immutable audit records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-[var(--text-muted,#747775)]">
                    No audit records found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateObj = new Date(log.timestamp);
                  const timeFormatted = isNaN(dateObj.getTime())
                    ? log.timestamp
                    : dateObj.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                  return (
                    <tr key={log.id} className="hover:bg-[var(--nav-hover-bg,#F8FAFD)] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[var(--text-muted,#747775)]">
                        {timeFormatted}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-[11px]">
                        {log.module}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[var(--text-primary,#1F1F1F)]">{log.userName || log.userId}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {log.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[var(--text-secondary,#5F6368)]">
                        {log.recordId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)]">
                          {log.branch}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[var(--text-secondary,#5F6368)] max-w-xs truncate">
                        {log.oldValue && log.newValue ? (
                          <span>
                            <span className="line-through text-slate-400">{log.oldValue}</span> →{' '}
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{log.newValue}</span>
                          </span>
                        ) : (
                          log.newValue || log.oldValue || '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
