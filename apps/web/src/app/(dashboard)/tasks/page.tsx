'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { AssignedTask, TaskPriority, TaskStatus, TaskTargetType } from '@/types/task';
import { User, UserRole, Branch, BRANCHES, DEFAULT_DOMAINS } from '@/types/auth';
import { canAssignTasks } from '@/lib/rbac/permissions';
import {
  CheckSquare,
  Plus,
  Users,
  User as UserIcon,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Filter,
  Search,
  ArrowRight,
  Sparkles,
  X,
  Shield,
  Layers,
  Check,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
} from 'lucide-react';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';

export default function TasksManagementPage() {
  const { user: currentUser } = useAuth();
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Task creation modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<TaskTargetType>('individual');
  const [targetUserId, setTargetUserId] = useState('');
  const [groupName, setGroupName] = useState('All Interns - ' + (currentUser?.branch || 'Coimbatore'));
  const [groupRole, setGroupRole] = useState<UserRole>('intern');
  const [groupBranch, setGroupBranch] = useState<string>(currentUser?.branch || 'Coimbatore');
  const [groupDomain, setGroupDomain] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('2026-09-18');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | null>(null);

  const handleExportExcel = () => {
    setDownloadingFormat('excel');
    try {
      exportToExcel({
        filename: `GSS_Tasks_Delegations_${new Date().toISOString().substring(0, 10)}`,
        sheetName: 'Tasks Hub',
        title: 'Gateway Software Solutions — Tasks & Delegations',
        subtitle: `Branch: ${currentUser?.branch || 'Coimbatore'} • Total Tasks: ${tasks.length}`,
        headers: ['Task ID', 'Title', 'Priority', 'Status', 'Target Type', 'Assigned To', 'Assigned By', 'Due Date', 'Created At'],
        rows: tasks.map((t) => [
          t.id,
          t.title,
          t.priority.toUpperCase(),
          t.status.toUpperCase(),
          t.targetType,
          t.targetUserName || t.targetGroup?.name || 'Team',
          t.assignedBy?.name || 'Staff',
          t.dueDate,
          new Date(t.createdAt).toLocaleDateString(),
        ]),
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const handleExportDocx = async () => {
    setDownloadingFormat('docx');
    try {
      await exportToDocx({
        filename: `GSS_Tasks_Delegations_${new Date().toISOString().substring(0, 10)}`,
        title: 'Tasks & Delegations Audit Report',
        subtitle: 'Official Task Assignment & Velocity Tracking Record',
        period: 'September 2026',
        branch: currentUser?.branch || 'Coimbatore',
        staffName: currentUser?.name || 'Administrator',
        staffRole: currentUser?.role?.toUpperCase() || 'ADMIN',
        sections: [
          {
            heading: '1. Operational Task Dispatch Summary',
            description: 'Active task assignments, priority ratings, and completion status.',
            table: {
              headers: ['Task Title', 'Priority', 'Status', 'Assigned To', 'Due Date'],
              rows: tasks.map((t) => [
                t.title,
                t.priority.toUpperCase(),
                t.status.toUpperCase(),
                t.targetUserName || t.targetGroup?.name || 'Team',
                t.dueDate,
              ]),
              columnWidthsPercentage: [35, 15, 15, 20, 15],
            },
          },
        ],
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isAdmin = currentUser?.role === 'admin';
  const canCreate = currentUser ? canAssignTasks(currentUser) : false;

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();
    if (canCreate) {
      fetchUsers();
    }
  }, [currentUser, canCreate]);

  // Eligible individual targets: HR, Employee, Intern
  const assignableUsers = users.filter((u) => {
    if (u.status !== 'active') return false;
    if (!['hr', 'employee', 'intern'].includes(u.role)) return false;
    if (isAdmin && u.branch !== currentUser?.branch) return false;
    return true;
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Please enter a task title.');
      return;
    }

    if (targetType === 'individual' && !targetUserId) {
      setFormError('Please select a staff member to assign.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title,
        description,
        targetType,
        targetUserId: targetType === 'individual' ? targetUserId : undefined,
        targetGroup:
          targetType === 'group'
            ? {
                name: groupName.trim(),
                role: groupRole,
                branch: isSuperAdmin ? groupBranch : currentUser?.branch,
                domain: groupDomain || undefined
              }
            : undefined,
        priority,
        dueDate
      };

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to dispatch task.');
        return;
      }

      setIsModalOpen(false);
      resetForm();
      fetchTasks();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: newStatus })
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTargetType('individual');
    setTargetUserId(assignableUsers[0]?.id || '');
    setGroupName('All Interns - ' + (currentUser?.branch || 'Coimbatore'));
    setPriority('medium');
    setFormError(null);
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.targetUserName && t.targetUserName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.targetGroup?.name && t.targetGroup.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-panel-entrance max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                Tasks & Delegations Hub
              </h1>
              <p className="text-xs text-[var(--text-secondary,#444746)] mt-0.5">
                {canCreate
                  ? 'Assign deliverable tasks individually or to teams with live notification alerts.'
                  : 'View your assigned deliverables, team dispatches, and update progress status.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
          >
            Print / PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            disabled={downloadingFormat !== null}
            leftIcon={
              downloadingFormat === 'excel' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )
            }
          >
            {downloadingFormat === 'excel' ? 'Exporting...' : 'Download Excel'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportDocx}
            disabled={downloadingFormat !== null}
            leftIcon={
              downloadingFormat === 'docx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )
            }
          >
            {downloadingFormat === 'docx' ? 'Generating...' : 'Download DOCX'}
          </Button>

          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (assignableUsers.length > 0 && !targetUserId) {
                  setTargetUserId(assignableUsers[0].id);
                }
                setIsModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Assign New Task
            </Button>
          )}
        </div>
      </div>

      {/* Metrics / Status Filter Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-[var(--brand-container,#E8F0FE)] border-[var(--brand-primary,#1A73E8)] shadow-xs'
              : 'bg-[var(--bg-card,#FFFFFF)] border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)]'
          }`}
        >
          <p className="text-[11px] font-medium uppercase text-[var(--text-secondary,#5F6368)]">All Tasks</p>
          <p className="text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] mt-1">{tasks.length}</p>
        </button>

        <button
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-[var(--badge-warning-bg,#FEF7E0)] border-[var(--badge-warning-text,#B06000)] shadow-xs'
              : 'bg-[var(--bg-card,#FFFFFF)] border-[var(--border-card,#DADCE0)] hover:border-[var(--badge-warning-text,#B06000)]'
          }`}
        >
          <p className="text-[11px] font-medium uppercase text-[var(--badge-warning-text,#B06000)]">Pending</p>
          <p className="text-2xl font-semibold text-[var(--badge-warning-text,#B06000)] mt-1">
            {tasks.filter((t) => t.status === 'pending').length}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter('in_progress')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'in_progress'
              ? 'bg-[var(--brand-container,#E8F0FE)] border-[var(--brand-primary,#1A73E8)] shadow-xs'
              : 'bg-[var(--bg-card,#FFFFFF)] border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)]'
          }`}
        >
          <p className="text-[11px] font-medium uppercase text-[var(--brand-primary,#1A73E8)]">In Progress</p>
          <p className="text-2xl font-semibold text-[var(--brand-primary,#1A73E8)] mt-1">
            {tasks.filter((t) => t.status === 'in_progress').length}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter('completed')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'completed'
              ? 'bg-[var(--badge-success-bg,#E6F4EA)] border-[var(--badge-success-text,#137333)] shadow-xs'
              : 'bg-[var(--bg-card,#FFFFFF)] border-[var(--border-card,#DADCE0)] hover:border-[var(--badge-success-text,#137333)]'
          }`}
        >
          <p className="text-[11px] font-medium uppercase text-[var(--badge-success-text,#137333)]">Completed</p>
          <p className="text-2xl font-semibold text-[var(--badge-success-text,#137333)] mt-1">
            {tasks.filter((t) => t.status === 'completed').length}
          </p>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-3 px-4 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-[var(--text-muted,#747775)]" />
        <input
          type="text"
          placeholder="Search tasks by title, team name, or assignee..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-xs text-[var(--text-primary,#1F1F1F)] placeholder:text-[var(--text-muted,#747775)] focus:outline-none"
        />
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full">
            <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-12 text-center shadow-sm">
              <CheckSquare className="w-12 h-12 text-[var(--text-muted,#9AA0A6)] mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)]">No Tasks Found</h3>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1 max-w-md mx-auto">
                {canCreate
                  ? 'Click "Assign New Task" to delegate individual or team deliverables.'
                  : 'You have no assigned tasks in this category.'}
              </p>
            </div>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isIndividual = task.targetType === 'individual';
            const priorityPills = {
              urgent: 'bg-[var(--badge-danger-bg,#FCE8E6)] text-[var(--badge-danger-text,#C5221F)] border-[var(--badge-danger-border,#FAD2CF)]',
              high: 'bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border-[var(--badge-warning-border,#FEEFC3)]',
              medium: 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border-[var(--border-subtle,#D2E3FC)]',
              low: 'bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#444746)] border-[var(--border-card,#DADCE0)]'
            };

            return (
              <div
                key={task.id}
                className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow space-y-4"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isIndividual ? (
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)] font-medium">
                          <UserIcon className="w-3.5 h-3.5" />
                          <span>{task.targetUserName}</span>
                          {task.targetUserRole && (
                            <span className="uppercase text-[10px] text-[var(--text-secondary,#5F6368)]">
                              ({task.targetUserRole})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border border-[var(--badge-warning-border,#FEEFC3)] font-medium">
                          <Users className="w-3.5 h-3.5" />
                          <span>Team: {task.targetGroup?.name}</span>
                        </span>
                      )}

                      <span
                        className={`text-[11px] font-medium uppercase px-2.5 py-0.5 rounded-full border ${
                          priorityPills[task.priority]
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    <StatusChip
                      status={
                        task.status === 'completed'
                          ? 'success'
                          : task.status === 'in_progress'
                          ? 'neutral'
                          : 'warning'
                      }
                      label={task.status.replace('_', ' ')}
                      size="sm"
                    />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] leading-snug">
                    {task.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary,#444746)] mt-1.5 leading-relaxed">
                    {task.description}
                  </p>
                </div>

                {/* Footer Metadata & Status Controls */}
                <div className="pt-3 border-t border-[var(--border-subtle,#E8EAED)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted,#747775)]">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
                      <span>Due: {task.dueDate}</span>
                    </span>
                    <span>•</span>
                    <span>By: {task.assignedBy.name}</span>
                  </div>

                  {/* Status Toggle Actions */}
                  <div className="flex items-center gap-2">
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                        className="px-3 py-1.5 rounded-full bg-[var(--brand-container,#E8F0FE)] hover:bg-[var(--brand-container,#E8F0FE)]/80 text-[var(--brand-on-container,#1A73E8)] font-medium text-xs transition-colors cursor-pointer"
                      >
                        Start Work
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleUpdateStatus(task.id, 'completed')}
                        className="px-3 py-1.5 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] hover:bg-[var(--badge-success-border,#CEEAD6)] text-[var(--badge-success-text,#137333)] font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Done</span>
                      </button>
                    )}
                    {task.status === 'completed' && (
                      <button
                        onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                        className="px-3 py-1.5 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] hover:bg-[var(--border-subtle,#E8EAED)] text-[var(--text-secondary,#444746)] font-medium text-xs transition-colors cursor-pointer"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Task Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-panel-entrance">
          <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle,#E8EAED)] mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] flex items-center justify-center">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary,#1F1F1F)]">
                    Assign Deliverable Task
                  </h2>
                  <p className="text-xs text-[var(--text-secondary,#5F6368)]">
                    Target staff individually or dispatch to a team with instant alerts
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-[var(--text-muted,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-[var(--badge-danger-bg,#FCE8E6)] border border-[var(--badge-danger-border,#FAD2CF)] text-xs text-[var(--badge-danger-text,#C5221F)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              {/* Target Mode Switcher */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary,#444746)] mb-2">
                  Target Assignment Mode
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] border border-[var(--border-subtle,#E8EAED)]">
                  <button
                    type="button"
                    onClick={() => setTargetType('individual')}
                    className={`py-2 px-3 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      targetType === 'individual'
                        ? 'bg-[var(--bg-card,#FFFFFF)] text-[var(--brand-primary,#1A73E8)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)]'
                    }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Individual Staff</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('group')}
                    className={`py-2 px-3 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      targetType === 'group'
                        ? 'bg-[var(--bg-card,#FFFFFF)] text-[var(--brand-primary,#1A73E8)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Team / Group</span>
                  </button>
                </div>
              </div>

              {/* Individual Target Selector */}
              {targetType === 'individual' ? (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary,#444746)] mb-1.5">
                    Select Staff Member
                  </label>
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full h-11 px-3 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)] cursor-pointer"
                  >
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">
                        {u.name} — {u.role.toUpperCase()} ({u.branch} Branch • {u.specialization || 'General'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Group Target Specification */
                <div className="space-y-3 p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
                  <div className="flex items-center gap-2 text-xs text-[var(--brand-primary,#1A73E8)] font-semibold">
                    <Sparkles className="w-4 h-4" />
                    <span>Team Dispatch Parameters</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[var(--text-secondary,#444746)] mb-1">
                      Team Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. All Interns - Coimbatore, Gen AI Team"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full h-10 px-3 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] placeholder:text-[var(--text-muted,#747775)] rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-secondary,#444746)] mb-1">
                        Target Role Group
                      </label>
                      <select
                        value={groupRole}
                        onChange={(e) => setGroupRole(e.target.value as UserRole)}
                        className="w-full h-9 px-2.5 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)] cursor-pointer"
                      >
                        <option value="intern" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">Interns</option>
                        <option value="employee" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">Employees</option>
                        <option value="hr" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">HR Ops</option>
                      </select>
                    </div>

                    {isSuperAdmin && (
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--text-secondary,#444746)] mb-1">
                          Target Branch
                        </label>
                        <select
                          value={groupBranch}
                          onChange={(e) => setGroupBranch(e.target.value)}
                          className="w-full h-9 px-2.5 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)] cursor-pointer"
                        >
                          <option value="all" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">All Branches</option>
                          {BRANCHES.map((b) => (
                            <option key={b} value={b} className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">{b} Branch</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Task Title */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary,#444746)] mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prepare Next.js dynamic routing module materials"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-11 px-3.5 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] placeholder:text-[var(--text-muted,#747775)] rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)]"
                  required
                />
              </div>

              {/* Task Description */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary,#444746)] mb-1.5">
                  Description / Deliverables
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail the expected deliverables, acceptance criteria, or PR links..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] placeholder:text-[var(--text-muted,#747775)] rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)]"
                />
              </div>

              {/* Priority & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary,#444746)] mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full h-10 px-3 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)] cursor-pointer"
                  >
                    <option value="low" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">Low</option>
                    <option value="medium" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">Medium</option>
                    <option value="high" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">High</option>
                    <option value="urgent" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary,#444746)] mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-10 px-3 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)]"
                  />
                </div>
              </div>

              {/* Notification preview */}
              <div className="p-3 rounded-xl bg-[var(--brand-container,#E8F0FE)] border border-[var(--border-subtle,#D2E3FC)] text-xs text-[var(--brand-on-container,#1A73E8)] flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  Instant notification will dispatch to{' '}
                  <strong className="font-semibold">
                    {targetType === 'individual'
                      ? assignableUsers.find((u) => u.id === targetUserId)?.name || 'the selected staff member'
                      : `all members of "${groupName}"`}
                  </strong>
                  .
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle,#E8EAED)]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  leftIcon={<CheckSquare className="w-4 h-4" />}
                >
                  Dispatch Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
