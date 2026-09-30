'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldAlert, 
  RefreshCw, 
  Filter, 
  Search, 
  Download, 
  Building2, 
  Activity, 
  UserCheck, 
  KeyRound, 
  FileText, 
  Eye, 
  X,
  AlertCircle,
  Clock,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState('All');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchFilter !== 'All') params.set('branch', branchFilter);
      if (moduleFilter !== 'all') params.set('module', moduleFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      } else {
        setError(data.error || 'Failed to retrieve audit records.');
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
      setError('Network communication failed while fetching audit logs.');
    } finally {
      setLoading(false);
    }
  }, [branchFilter, moduleFilter]);

  useEffect(() => {
    void Promise.resolve().then(fetchLogs);
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter((l) => (
      l.userName?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.recordId?.toLowerCase().includes(q) ||
      l.module?.toLowerCase().includes(q) ||
      l.role?.toLowerCase().includes(q) ||
      l.branch?.toLowerCase().includes(q)
    ));
  }, [logs, searchQuery]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const staffEvents = logs.filter(l => l.module === 'STAFF' || l.action.includes('USER')).length;
    const authEvents = logs.filter(l => l.module === 'AUTH' || l.action.includes('LOGIN') || l.action.includes('LOGOUT')).length;
    const uniqueBranches = new Set(logs.map(l => l.branch).filter(Boolean)).size;
    return { total, staffEvents, authEvents, uniqueBranches };
  }, [logs]);

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('APPROVED') || act.includes('CREATED') || act.includes('UPDATE_STATUS')) {
      return {
        label: act.replace('USER_', '').replace(/_/g, ' '),
        classes: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
      };
    }
    if (act.includes('REJECTED') || act.includes('DELETE') || act.includes('DISABLE')) {
      return {
        label: act.replace('USER_', '').replace(/_/g, ' '),
        classes: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
      };
    }
    if (act.includes('LOGIN')) {
      return {
        label: 'Staff Login',
        classes: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
      };
    }
    if (act.includes('LOGOUT')) {
      return {
        label: 'Staff Logout',
        classes: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
      };
    }
    return {
      label: act.replace(/_/g, ' '),
      classes: 'text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
    };
  };

  const parseJsonSafe = (raw?: string): Record<string, unknown> | null => {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const renderDetailsCell = (log: AuditLog) => {
    const parsedNew = parseJsonSafe(log.newValue);
    if (parsedNew) {
      return (
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          {Object.entries(parsedNew).map(([key, value]) => (
            <span 
              key={key} 
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              <strong className="text-slate-500 dark:text-slate-400 capitalize mr-1">{key}:</strong>
              <span className={key === 'status' && value === 'active' ? 'text-emerald-600 font-bold' : ''}>
                {String(value)}
              </span>
            </span>
          ))}
        </div>
      );
    }

    if (log.oldValue && log.newValue) {
      return (
        <div className="text-[11px] truncate max-w-xs">
          <span className="line-through text-slate-400">{log.oldValue}</span>
          <span className="mx-1 text-slate-400">→</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{log.newValue}</span>
        </div>
      );
    }

    return (
      <span className="text-[11px] text-[var(--text-secondary,#5F6368)] truncate max-w-xs block font-mono">
        {log.newValue || log.oldValue || '—'}
      </span>
    );
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Log ID', 'Timestamp', 'Actor Name', 'Role', 'Action', 'Module', 'Record ID', 'Branch', 'Old Value', 'New Value', 'IP Address'];
    const rows = filteredLogs.map(l => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${(l.userName || '').replace(/"/g, '""')}"`,
      `"${l.role}"`,
      `"${l.action}"`,
      `"${l.module}"`,
      `"${l.recordId}"`,
      `"${l.branch}"`,
      `"${(l.oldValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || '127.0.0.1'}"`
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
            Authoritative, immutable event trail mirrored across Google Sheet <code className="font-mono text-emerald-600 dark:text-emerald-400">09_System_Audit_Log</code> and Firestore collection <code className="font-mono text-blue-600 dark:text-blue-400">audit_logs</code>.
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

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary,#5F6368)]">Total Audit Events</span>
            <Activity className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
          </div>
          <div className="text-2xl font-bold font-serif text-[var(--text-primary,#1F1F1F)] mt-2">
            {stats.total}
          </div>
          <div className="text-[11px] text-[var(--text-muted,#747775)] mt-0.5">
            Immutable log entries
          </div>
        </div>

        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary,#5F6368)]">Staff & Status Changes</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-serif text-[var(--text-primary,#1F1F1F)] mt-2">
            {stats.staffEvents}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            Approvals & role updates
          </div>
        </div>

        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary,#5F6368)]">Auth & Session Events</span>
            <KeyRound className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-serif text-[var(--text-primary,#1F1F1F)] mt-2">
            {stats.authEvents}
          </div>
          <div className="text-[11px] text-[var(--text-muted,#747775)] mt-0.5">
            Logins & session security
          </div>
        </div>

        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary,#5F6368)]">Active Branches</span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-serif text-[var(--text-primary,#1F1F1F)] mt-2">
            {stats.uniqueBranches}
          </div>
          <div className="text-[11px] text-[var(--text-muted,#747775)] mt-0.5">
            CHN, CBE, MDU, ERD
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-4 flex items-center justify-between text-rose-800 dark:text-rose-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchLogs} className="h-7 text-xs">
            Retry
          </Button>
        </div>
      )}

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
              <option value="STAFF">Staff & Directory</option>
              <option value="AUTH">Authentication (Login/Logout)</option>
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
            placeholder="Search action, actor, record ID..."
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
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle,#F1F3F4)] font-normal text-[var(--text-primary,#1F1F1F)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-xs text-[var(--text-muted,#747775)]">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[var(--brand-primary,#1A73E8)]" />
                      <span>Loading immutable audit records from Firestore & Sheets...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-xs text-[var(--text-muted,#747775)]">
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

                  const badge = getActionBadge(log.action);

                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-[var(--nav-hover-bg,#F8FAFD)] transition-colors cursor-pointer group"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[var(--text-muted,#747775)]">
                        {timeFormatted}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-[11px]">
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <Layers className="w-3 h-3 text-slate-400" />
                          {log.module}
                        </span>
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
                      <td className="px-4 py-3">
                        {renderDetailsCell(log)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 rounded-lg text-slate-400 group-hover:text-blue-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Log Inspection Modal */}
      {selectedLog && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedLog(null)}
        >
          <div 
            className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle,#F1F3F4)]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[var(--brand-primary,#1A73E8)]" />
                <h3 className="font-serif font-bold text-lg text-[var(--text-primary,#1F1F1F)]">
                  Audit Telemetry Event Record
                </h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[var(--bg-canvas,#F8FAFD)] rounded-xl border border-[var(--border-card,#DADCE0)]">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted,#747775)] block mb-1">Log ID</span>
                <span className="font-mono text-[11px] text-[var(--text-primary,#1F1F1F)] break-all">{selectedLog.id}</span>
              </div>
              <div className="p-3 bg-[var(--bg-canvas,#F8FAFD)] rounded-xl border border-[var(--border-card,#DADCE0)]">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted,#747775)] block mb-1">Timestamp</span>
                <span className="font-mono text-[11px] text-[var(--text-primary,#1F1F1F)] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {selectedLog.timestamp}
                </span>
              </div>
              <div className="p-3 bg-[var(--bg-canvas,#F8FAFD)] rounded-xl border border-[var(--border-card,#DADCE0)]">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted,#747775)] block mb-1">Actor Identity</span>
                <span className="font-semibold text-[var(--text-primary,#1F1F1F)]">{selectedLog.userName}</span>
                <span className="text-[11px] text-slate-500 block">ID: {selectedLog.userId} ({selectedLog.role})</span>
              </div>
              <div className="p-3 bg-[var(--bg-canvas,#F8FAFD)] rounded-xl border border-[var(--border-card,#DADCE0)]">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted,#747775)] block mb-1">Branch & Module</span>
                <span className="font-semibold text-[var(--text-primary,#1F1F1F)]">{selectedLog.branch}</span>
                <span className="text-[11px] text-slate-500 block">Module: {selectedLog.module}</span>
              </div>
            </div>

            <div className="p-3 bg-[var(--bg-canvas,#F8FAFD)] rounded-xl border border-[var(--border-card,#DADCE0)] space-y-1 text-xs">
              <span className="text-[10px] uppercase font-mono text-[var(--text-muted,#747775)] block">Target Entity Record</span>
              <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 break-all">{selectedLog.recordId}</span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-mono text-[var(--text-muted,#747775)] block">State Mutation Payload</span>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify({
                  action: selectedLog.action,
                  module: selectedLog.module,
                  oldValue: selectedLog.oldValue ? parseJsonSafe(selectedLog.oldValue) || selectedLog.oldValue : null,
                  newValue: selectedLog.newValue ? parseJsonSafe(selectedLog.newValue) || selectedLog.newValue : null,
                  ipAddress: selectedLog.ipAddress || '127.0.0.1',
                  mirror: 'Google Sheet 09_System_Audit_Log'
                }, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
