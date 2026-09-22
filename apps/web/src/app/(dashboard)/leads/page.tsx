'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Input } from '@/components/ui/Input';
import {
  MailCheck,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Mail,
  Key,
  Send,
  Filter,
  Search,
  Check,
  FileText,
  Loader2,
  Printer,
} from 'lucide-react';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';

interface CandidateLead {
  id: string;
  name: string;
  email: string;
  mobile: string;
  city: string;
  status: 'new' | 'contacted' | 'enrolled' | 'rejected';
  remark: string;
}

const INITIAL_LEADS: CandidateLead[] = [];

export default function LeadsDashboardPage() {
  const [leads, setLeads] = useState<CandidateLead[]>(INITIAL_LEADS);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Dedupe & Upload State
  const [uploadSummary, setUploadSummary] = useState<{ newCount: number; duplicateCount: number } | null>(null);

  // Email Connection State
  const [isEmailConnected, setIsEmailConnected] = useState(false);
  const [emailAddress, setEmailAddress] = useState('hr.leads@gss.com');
  const [appPassword, setAppPassword] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailSuccess, setTestEmailSuccess] = useState(false);

  const simulateUpload = () => {
    setUploadSummary({
      newCount: 42,
      duplicateCount: 8,
    });
  };

  const handleTestEmail = () => {
    setIsTestingEmail(true);
    setTimeout(() => {
      setIsTestingEmail(false);
      setTestEmailSuccess(true);
      setIsEmailConnected(true);
    }, 1200);
  };

  const updateLeadStatus = (leadId: string, newStatus: CandidateLead['status']) => {
    setLeads(leads.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
  };

  const updateLeadRemark = (leadId: string, newRemark: string) => {
    setLeads(leads.map((l) => (l.id === leadId ? { ...l, remark: newRemark } : l)));
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesFilter = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSearch =
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      lead.mobile.includes(search);
    return matchesFilter && matchesSearch;
  });

  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | null>(null);

  const handleExportExcel = () => {
    setDownloadingFormat('excel');
    try {
      exportToExcel({
        filename: `GSS_Candidate_Leads_${new Date().toISOString().substring(0, 10)}`,
        sheetName: 'Candidate Leads',
        title: 'HR Leads & Candidate Inquiries',
        subtitle: `Total Active Candidates: ${filteredLeads.length} • Generated On: ${new Date().toLocaleDateString()}`,
        headers: ['Candidate Name', 'Gmail / Email', 'Mobile Number', 'City', 'Pipeline Status', 'Remarks'],
        rows: filteredLeads.map((l) => [
          l.name,
          l.email,
          l.mobile,
          l.city,
          l.status.toUpperCase(),
          l.remark,
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
        filename: `GSS_Candidate_Leads_${new Date().toISOString().substring(0, 10)}`,
        title: 'Candidate Leads & Inquiries Report',
        subtitle: 'HR Candidate Intake & Enrollment Pipeline Summary',
        period: 'September 2026',
        branch: 'Coimbatore',
        staffName: 'HR Talent Acquisition',
        staffRole: 'HR',
        sections: [
          {
            heading: '1. Candidate Inquiry Pipeline',
            description: 'Recent candidate leads with deduplication and intake statuses.',
            table: {
              headers: ['Name', 'Email', 'Mobile', 'City', 'Status'],
              rows: filteredLeads.map((l) => [
                l.name,
                l.email,
                l.mobile,
                l.city,
                l.status.toUpperCase(),
              ]),
              columnWidthsPercentage: [25, 30, 20, 12, 13],
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
              <MailCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                HR Leads & Candidate Inquiries
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Intake student candidates, automatic deduplication on Gmail + Mobile, and SMTP outreach.
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
        </div>
      </div>

      {/* Top Grid: Upload Zone + Connect Email Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-6 shadow-xs">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">
            Candidate Intake Upload
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Upload CSV/XLSX leads file — we'll check for duplicates by Gmail + Mobile automatically.
          </p>

          <div
            onClick={simulateUpload}
            className="border-2 border-dashed border-[var(--border-card)] hover:border-[var(--brand-primary)] bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card-hover)] rounded-2xl p-6 text-center cursor-pointer transition-colors duration-200"
          >
            <UploadCloud className="w-10 h-10 text-[var(--brand-primary)] mx-auto mb-2" />
            <p className="text-xs font-medium text-[var(--text-primary)]">
              Click or Drag & Drop leads CSV / Excel
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Supports .csv, .xlsx, .xls up to 10MB
            </p>
          </div>

          {/* Post-upload summary panel */}
          {uploadSummary && (
            <div className="mt-4 p-4 rounded-2xl bg-[var(--badge-success-bg)] border border-[var(--badge-success-border)] flex items-center justify-between text-xs animate-panel-entrance">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[var(--badge-success-text)] shrink-0" />
                <span className="text-[var(--text-primary)]">
                  <strong className="text-[var(--badge-success-text)]">{uploadSummary.newCount} new leads ready</strong>,{' '}
                  <span className="text-[var(--text-secondary)]">{uploadSummary.duplicateCount} duplicates skipped</span>
                </span>
              </div>
              <Button size="sm" variant="primary" onClick={() => setUploadSummary(null)}>
                Commit Intake
              </Button>
            </div>
          )}
        </div>

        {/* Connect Email Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Connect Email for Campaigns
            </h2>
            {isEmailConnected ? (
              <span className="text-xs px-3 py-0.5 rounded-full bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)] flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--badge-success-text)]" /> Connected
              </span>
            ) : (
              <span className="text-xs px-3 py-0.5 rounded-full bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)] font-medium">
                Unlinked
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            An App Password lets GSS send email as you over SMTP — it's not your normal password.
          </p>

          <div className="space-y-3.5">
            <Input
              label="Corporate Gmail"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="16-Character App Password"
              type="password"
              placeholder="xxxx xxxx xxxx xxxx"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              leftIcon={<Key className="w-4 h-4" />}
              showPasswordToggle
            />

            <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--brand-primary)] hover:underline"
              >
                How to create Google App Password ↗
              </a>
              <Button
                variant="primary"
                size="sm"
                onClick={handleTestEmail}
                isLoading={isTestingEmail}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Send Test Email & Link
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Leads Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-3.5 px-4 border-b border-[var(--border-card)] flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full flex items-center gap-3">
            <Search className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search leads by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 bg-[var(--bg-card)] text-xs text-[var(--text-primary)] rounded-xl border border-[var(--border-card)] focus:outline-none focus:border-[var(--brand-primary)] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="enrolled">Enrolled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-[var(--border-card)] text-[11px] font-medium uppercase text-[var(--text-secondary)] bg-[var(--bg-card-subtle)]">
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Gmail / Mobile</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-secondary)]">
                    <p className="font-medium text-sm text-[var(--text-primary)]">No candidate leads found</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Inbound student candidate inquiries will appear here.</p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-[var(--text-primary)]">
                    {lead.name}
                  </td>

                  <td className="py-3.5 px-4 text-xs">
                    <div className="text-[var(--text-primary)] font-medium">{lead.email}</div>
                    <div className="text-[var(--text-muted)] text-[11px]">{lead.mobile}</div>
                  </td>

                  <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">
                    {lead.city}
                  </td>

                  <td className="py-3.5 px-4">
                    <select
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value as CandidateLead['status'])}
                      className="text-xs bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg px-2.5 py-1 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="enrolled">Enrolled</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>

                  <td className="py-3.5 px-4">
                    <input
                      type="text"
                      value={lead.remark}
                      onChange={(e) => updateLeadRemark(lead.id, e.target.value)}
                      className="w-full bg-transparent hover:bg-[var(--bg-card-hover)] focus:bg-[var(--bg-card)] px-2.5 py-1 rounded-lg text-xs text-[var(--text-secondary)] focus:text-[var(--text-primary)] border border-transparent focus:border-[var(--brand-primary)] focus:outline-none transition-all"
                    />
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
