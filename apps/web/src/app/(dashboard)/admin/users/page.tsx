'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { User, UserRole, Branch, BRANCHES } from '@/types/auth';
import { canDeleteUser } from '@/lib/rbac/permissions';
import {
  ShieldAlert,
  Check,
  X,
  Trash2,
  Edit2,
  AlertTriangle,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Cpu,
  Lock,
  Printer,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  // Double confirmation modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalAction, setModalAction] = useState<'role_change' | 'delete' | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('intern');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url =
        currentUser?.role === 'superadmin' && branchFilter !== 'all'
          ? `/api/auth/users?branch=${encodeURIComponent(branchFilter)}`
          : '/api/auth/users';

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser, branchFilter]);

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'rejected') => {
    try {
      const res = await fetch('/api/auth/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'update_status', status: newStatus }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update user status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteModalAction = async () => {
    if (!selectedUser || !modalAction) return;

    setIsProcessing(true);
    setActionError(null);
    try {
      if (modalAction === 'role_change') {
        const res = await fetch('/api/auth/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUser.id, action: 'update_role', role: targetRole }),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionError(data.error || 'Failed to update role');
          return;
        }
      } else if (modalAction === 'delete') {
        const res = await fetch('/api/auth/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUser.id, action: 'delete' }),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionError(data.error || 'Failed to delete user');
          return;
        }
      }
      closeModal();
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      setActionError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const openModal = (user: User, action: 'role_change' | 'delete') => {
    setSelectedUser(user);
    setModalAction(action);
    setTargetRole(user.role);
    setConfirmPhrase('');
    setActionError(null);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setModalAction(null);
    setConfirmPhrase('');
    setActionError(null);
  };

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isAdmin = currentUser?.role === 'admin';

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.mobile.includes(searchQuery) ||
      (u.specialization && u.specialization.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | null>(null);

  const handleExportExcel = () => {
    setDownloadingFormat('excel');
    try {
      exportToExcel({
        filename: `GSS_User_Accounts_${currentUser?.branch || 'Universal'}_${new Date().toISOString().substring(0, 10)}`,
        sheetName: 'User Directory',
        title: 'User Accounts & Access Permissions Directory',
        subtitle: `Branch: ${currentUser?.branch || 'Universal'} • Total Accounts: ${filteredUsers.length}`,
        headers: ['Name', 'Email', 'Role', 'Branch', 'Status', 'Specialization'],
        rows: filteredUsers.map((u) => [
          u.name,
          u.email,
          u.role.toUpperCase(),
          u.branch,
          u.status.toUpperCase(),
          u.specialization || 'General',
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
        filename: `GSS_User_Accounts_${currentUser?.branch || 'Universal'}_${new Date().toISOString().substring(0, 10)}`,
        title: 'User Accounts & Role Permissions Audit Dossier',
        subtitle: 'System User Directory & Authorization Matrix',
        period: 'September 2026',
        branch: (currentUser?.branch as string) || 'Universal',
        staffName: currentUser?.name || 'Administrator',
        staffRole: currentUser?.role?.toUpperCase() || 'ADMIN',
        sections: [
          {
            heading: '1. User Account Inventory',
            description: `Registered system accounts and access authorizations for ${currentUser?.branch || 'Universal'} scope.`,
            table: {
              headers: ['Name', 'Email', 'Role', 'Branch', 'Status'],
              rows: filteredUsers.map((u) => [
                u.name,
                u.email,
                u.role.toUpperCase(),
                u.branch,
                u.status.toUpperCase(),
              ]),
              columnWidthsPercentage: [25, 30, 15, 15, 15],
            },
          },
        ],
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  return (
    <div className="space-y-6 animate-panel-entrance max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-container)] text-[var(--brand-primary)] flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                User & Role Management
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {isSuperAdmin
                  ? 'Super Admin Console — Universal branch access to approve staff and manage roles.'
                  : `Branch Administrator Console — Scoped to ${currentUser?.branch} Branch.`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isAdmin && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-[var(--brand-container)] text-[var(--brand-primary)] border border-[var(--border-subtle)] flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5" />
              <span>{currentUser?.branch} Branch</span>
            </span>
          )}

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

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchUsers}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium uppercase text-[var(--text-secondary)]">
              {isSuperAdmin ? 'Total System Staff' : `${currentUser?.branch} Staff`}
            </p>
            <p className="text-2xl font-semibold text-[var(--text-primary)] mt-1">{users.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[var(--bg-card-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div
          className={`rounded-2xl p-4 flex items-center justify-between border shadow-xs ${
            pendingCount > 0
              ? 'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]'
              : 'bg-[var(--bg-card)] border-[var(--border-card)]'
          }`}
        >
          <div>
            <p className="text-[11px] font-medium uppercase text-[var(--badge-warning-text)]">
              Pending Activations
            </p>
            <p className="text-2xl font-semibold text-[var(--badge-warning-text)] mt-1">{pendingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[var(--badge-warning-bg)] border border-[var(--badge-warning-border)] flex items-center justify-center text-[var(--badge-warning-text)]">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium uppercase text-[var(--badge-success-text)]">Active Operational</p>
            <p className="text-2xl font-semibold text-[var(--badge-success-text)] mt-1">
              {users.filter((u) => u.status === 'active').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] flex items-center justify-center text-[var(--badge-success-text)]">
            <Check className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-3.5 px-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full flex items-center gap-3">
          <Search className="w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by name, email, mobile, or specialization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          {/* Branch Filter for Super Admin */}
          {isSuperAdmin && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-9 px-3 bg-[var(--bg-card)] text-xs text-[var(--brand-primary)] font-medium rounded-xl border border-[var(--border-card)] focus:outline-none focus:border-[var(--brand-primary)] cursor-pointer"
            >
              <option value="all">All Branches</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b} Branch
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 px-3 bg-[var(--bg-card)] text-xs text-[var(--text-primary)] rounded-xl border border-[var(--border-card)] focus:outline-none focus:border-[var(--brand-primary)] cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="intern">Intern</option>
              <option value="employee">Employee</option>
              <option value="hr">HR Ops</option>
              <option value="admin">Admin</option>
              {isSuperAdmin && <option value="superadmin">Super Admin</option>}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="border-b border-[var(--border-card)] text-[11px] font-medium uppercase text-[var(--text-secondary)] bg-[var(--bg-card-subtle)]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Specialization</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {filteredUsers.map((u) => {
                const isPending = u.status === 'pending';
                const canEditRole =
                  isSuperAdmin || (isAdmin && u.branch === currentUser?.branch && u.role !== 'superadmin');

                return (
                  <tr
                    key={u.id}
                    className={`transition-colors ${
                      isPending
                        ? 'bg-[var(--badge-warning-bg)]/30 hover:bg-[var(--badge-warning-bg)]/50'
                        : 'hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--brand-container)] text-[var(--brand-primary)] flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--text-primary)] block">{u.name}</span>
                          <span className="text-[11px] text-[var(--text-muted)]">{u.id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Branch Badge */}
                    <td className="py-3.5 px-4 text-xs font-medium text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                        {u.branch}
                      </span>
                    </td>

                    {/* Specialization Badges */}
                    <td className="py-3.5 px-4 text-xs">
                      {u.specialization ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)] text-xs font-medium">
                          ★ {u.majorSpecialization || (u.specializations && u.specializations[0]) || u.specialization}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Role Badge */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] font-medium border border-[var(--border-card)]">
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusChip
                        status={
                          u.status === 'active'
                            ? 'success'
                            : u.status === 'pending'
                            ? 'warning'
                            : 'danger'
                        }
                        label={u.status}
                        size="sm"
                      />
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4 text-xs">
                      <div className="text-[var(--text-primary)]">{u.email}</div>
                      <div className="text-[var(--text-muted)] text-[11px]">{u.mobile}</div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {isPending ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleStatusChange(u.id, 'active')}
                            className="px-3 py-1 rounded-full bg-[var(--badge-success-bg)] hover:opacity-90 text-[var(--badge-success-text)] text-xs font-medium transition-colors cursor-pointer border border-[var(--badge-success-border)]"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleStatusChange(u.id, 'rejected')}
                            className="px-3 py-1 rounded-full bg-[var(--badge-danger-bg)] hover:opacity-90 text-[var(--badge-danger-text)] text-xs font-medium transition-colors cursor-pointer border border-[var(--badge-danger-border)]"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          {canEditRole && (
                            <button
                              onClick={() => openModal(u, 'role_change')}
                              className="p-1.5 rounded-full hover:bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                              title="Assign / Change Role"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {currentUser && canDeleteUser(currentUser, u) && (
                            <button
                              onClick={() => openModal(u, 'delete')}
                              className="p-1.5 rounded-full hover:bg-[var(--badge-danger-bg)] text-[var(--text-secondary)] hover:text-[var(--badge-danger-text)] transition-colors cursor-pointer"
                              title="Delete staff account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Double Confirmation Modal */}
      {selectedUser && modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-panel-entrance">
          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-[var(--text-primary)]">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  modalAction === 'delete'
                    ? 'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)]'
                    : 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]'
                }`}
              >
                {modalAction === 'delete' ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {modalAction === 'delete' ? 'Confirm Account Deletion' : 'Assign Security Role'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">Verification Required</p>
              </div>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-[var(--badge-danger-bg)] border border-[var(--badge-danger-border)] text-xs text-[var(--badge-danger-text)]">
                {actionError}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)] text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
              {modalAction === 'delete' ? (
                <>
                  You are permanently revoking access and removing{' '}
                  <strong className="text-[var(--text-primary)] font-semibold">{selectedUser.name}</strong> (
                  <span className="text-[var(--brand-primary)]">{selectedUser.email}</span>) from GSS Management.
                </>
              ) : (
                <>
                  You are updating the authorized role for{' '}
                  <strong className="text-[var(--text-primary)] font-semibold">{selectedUser.name}</strong> ({selectedUser.branch} Branch) from{' '}
                  <span className="uppercase text-[var(--text-muted)] font-medium">{selectedUser.role}</span> to{' '}
                  <span className="uppercase text-[var(--brand-primary)] font-bold">{targetRole}</span>.
                </>
              )}
            </div>

            {modalAction === 'role_change' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Select Assigned Role
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 bg-[var(--bg-card)] text-xs text-[var(--text-primary)] rounded-xl border border-[var(--border-card)] focus:outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                >
                  <option value="intern">Intern</option>
                  <option value="employee">Employee</option>
                  <option value="hr">HR Ops</option>
                  <option value="admin">Admin</option>
                  {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                </select>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Type <strong className="text-[var(--badge-warning-text)]">CONFIRM</strong> to authorize:
              </label>
              <input
                type="text"
                placeholder="Type CONFIRM"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                className="w-full h-10 px-3 bg-[var(--bg-card)] text-xs rounded-xl border border-[var(--border-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                variant={modalAction === 'delete' ? 'danger' : 'primary'}
                size="sm"
                onClick={handleExecuteModalAction}
                disabled={confirmPhrase !== 'CONFIRM'}
                isLoading={isProcessing}
              >
                {modalAction === 'delete' ? 'Delete User' : 'Confirm Role'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
