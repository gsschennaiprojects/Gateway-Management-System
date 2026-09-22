'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';
import {
  FileSpreadsheet,
  Download,
  FileText,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Clock,
  Printer,
  Loader2,
  Sparkles,
} from 'lucide-react';

export default function MonthlyReportPage() {
  const { user } = useAuth();
  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | null>(null);

  const handleDownloadExcel = () => {
    setDownloadingFormat('excel');
    try {
      exportToExcel({
        filename: `GSS_Monthly_Report_${user?.name?.replace(/\s+/g, '_') || 'Staff'}_Sep_2026`,
        sheetName: 'Performance Audit',
        title: 'Monthly Performance & Attendance Audit',
        subtitle: 'Report Period: September 1 – September 30, 2026',
        metadata: {
          'Staff Member': user?.name || 'Authorized Staff',
          'Designation & Role': `${user?.role?.toUpperCase() || 'EMPLOYEE'} • ${user?.branch || 'Coimbatore'} Branch`,
          'Verification Status': 'Verified Record',
          'System Checksum': 'GSS-VERIFY-SEP2026-99A',
        },
        headers: ['Metric / Module Item', 'Recorded Value', 'Benchmark / Remarks'],
        rows: [
          ['Total Working Days', 26, 'Sundays Excluded (Official Calendar)'],
          ['Days Present', 24, '92.3% Attendance Achieved'],
          ['Days Absent / Leave', 2, 'Approved Leave'],
          ['Interns & Students Mentored', 18, 'Across 3 Technical Batches'],
          ['Tasks & Milestones Concluded', 54, '100% On-Time Completion Rate'],
          ['Full Stack Web Development (MERN)', '8 Trainees', '100% Fee Paid • Capstone Active'],
          ['Python Data Science & Machine Learning', '6 Trainees', '2 Real-Time Projects Deployed'],
          ['Cloud DevOps & Microservices', '4 Trainees', 'Capstone Milestone Completed'],
          ['Live Instructional Training Hours', '30 Hours', 'Conducted code reviews & debugging'],
          ['Google Sheets Sync Integration', 'Connected', 'Central ATT & STU Subsheet synced'],
        ],
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const handleDownloadDocx = async () => {
    setDownloadingFormat('docx');
    try {
      await exportToDocx({
        filename: `GSS_Monthly_Report_${user?.name?.replace(/\s+/g, '_') || 'Staff'}_Sep_2026`,
        title: 'Monthly Performance & Attendance Audit',
        subtitle: 'Official Monthly Staff Operational & Trainee Mentorship Summary',
        period: 'September 1 – September 30, 2026',
        staffName: user?.name || 'Staff Member',
        staffRole: user?.role?.toUpperCase() || 'EMPLOYEE',
        branch: user?.branch || 'Coimbatore',
        systemChecksum: 'GSS-VERIFY-SEP2026-99A',
        sections: [
          {
            heading: '1. Executive Performance Metrics',
            description: 'Audited monthly summary of staff attendance, supervised student enrollment, and technical milestone completion.',
            table: {
              headers: ['Audit Metric', 'Recorded Value', 'Benchmark', 'Compliance Status'],
              rows: [
                ['Total Working Days', 26, 26, '100% Expected'],
                ['Days Present', 24, 24, '92.3% Present'],
                ['Interns Mentored', 18, 15, 'Target Exceeded'],
                ['Milestone Deliverables', 54, 50, '100% On-Time'],
              ],
              columnWidthsPercentage: [35, 20, 20, 25],
            },
          },
          {
            heading: '2. Supervised Trainee Cohort Breakdown',
            description: 'Trainee enrollment status and domain allocation across active technical training batches.',
            table: {
              headers: ['Domain Specialization', 'Trainee Count', 'Fee Status', 'Milestone State'],
              rows: [
                ['Full Stack Web Development (MERN)', '8 Candidates', '100% Paid', 'Capstone Active'],
                ['Python Data Science & Machine Learning', '6 Candidates', '100% Paid', '2 Projects Live'],
                ['Cloud DevOps & Microservices', '4 Candidates', '100% Paid', 'Capstone Completed'],
              ],
              columnWidthsPercentage: [40, 20, 20, 20],
            },
          },
          {
            heading: '3. Key Deliverables & Achievements',
            bullets: [
              'Conducted 30+ hours of live instructor-led hands-on training and architecture reviews.',
              'Configured and maintained multi-month attendance and task matrices with automated lifecycle tracking.',
              'Delivered automated attendance sync to GSS Management System central database.',
              'Successfully guided final year candidates on industry-standard capstone milestones and IEEE compliance.',
            ],
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
            <div className="w-10 h-10 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                Monthly Operational Report
              </h1>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5">
                Generated preview for September 2026 — Verified performance record and attendance audit.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Print, Excel, DOCX */}
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
            onClick={handleDownloadExcel}
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
            variant="primary"
            size="sm"
            onClick={handleDownloadDocx}
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

      {/* Report Preview Document (Google Docs / Workspace Report Sheet) */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-xs p-8 md:p-12 space-y-8 print:shadow-none print:border-none print:p-0">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-b border-[var(--border-subtle,#D2E3FC)] pb-6 gap-4">
          <div className="flex items-start gap-4">
            <BrandLogo size="md" showText={false} />
            <div>
              <span className="text-[10px] text-[var(--brand-primary,#1A73E8)] tracking-widest uppercase font-semibold">
                Gateway Software Solutions • GSS Management System
              </span>
              <h2 className="text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] mt-1">
                Monthly Performance & Attendance Audit
              </h2>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1">Report Period: September 1 – September 30, 2026</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-right text-xs min-w-[180px]">
            <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">Staff Member</p>
            <p className="font-semibold text-[var(--text-primary,#1F1F1F)] text-sm mt-0.5">{user?.name}</p>
            <p className="text-[var(--brand-primary,#1A73E8)] uppercase text-[10px] font-semibold mt-0.5">{user?.role} • {user?.branch} Branch</p>
          </div>
        </div>

        {/* 4 Summary Metric Panels */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
            <span className="text-[11px] font-medium text-[var(--text-secondary,#5F6368)] uppercase">Working Days</span>
            <p className="text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] mt-1">26</p>
            <span className="text-[11px] text-[var(--badge-success-text,#137333)] font-medium">Sundays Excluded</span>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
            <span className="text-[11px] font-medium text-[var(--text-secondary,#5F6368)] uppercase">Days Present</span>
            <p className="text-2xl font-semibold text-[var(--badge-success-text,#137333)] mt-1">24</p>
            <span className="text-[11px] text-[var(--text-secondary,#5F6368)]">92.3% Attendance</span>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
            <span className="text-[11px] font-medium text-[var(--text-secondary,#5F6368)] uppercase">Interns Mentored</span>
            <p className="text-2xl font-semibold text-[var(--badge-warning-text,#B06000)] mt-1">18</p>
            <span className="text-[11px] text-[var(--text-secondary,#5F6368)]">Across 3 Batches</span>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
            <span className="text-[11px] font-medium text-[var(--text-secondary,#5F6368)] uppercase">Tasks Concluded</span>
            <p className="text-2xl font-semibold text-[var(--brand-primary,#1A73E8)] mt-1">54</p>
            <span className="text-[11px] text-[var(--badge-success-text,#137333)] font-medium">100% On-Time</span>
          </div>
        </div>

        {/* Breakdown Sections */}
        <div className="space-y-6 pt-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)] mb-3 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
              <span>Students & Interns Maintained</span>
            </h3>
            <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-xs text-[var(--text-secondary,#5F6368)] space-y-2.5">
              <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle,#D2E3FC)]">
                <span className="font-medium text-[var(--text-primary,#1F1F1F)]">Full Stack Web Development (MERN)</span>
                <span className="text-[var(--text-secondary,#5F6368)]">8 Candidates • 100% Fee Paid</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle,#D2E3FC)]">
                <span className="font-medium text-[var(--text-primary,#1F1F1F)]">Python Data Science & Machine Learning</span>
                <span className="text-[var(--text-secondary,#5F6368)]">6 Candidates • 2 Projects Live</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="font-medium text-[var(--text-primary,#1F1F1F)]">Cloud DevOps & Microservices</span>
                <span className="text-[var(--text-secondary,#5F6368)]">4 Candidates • Capstone Completed</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)] mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--badge-success-text,#137333)]" />
              <span>Key Deliverables & Milestones Achieved</span>
            </h3>
            <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-xs text-[var(--text-secondary,#5F6368)] space-y-2">
              <p>• Completed 30 hours of live instruction and code review sessions.</p>
              <p>• Delivered automated attendance sync to GSS Management System central database.</p>
              <p>• Mentored final year students on IEEE journal capstone projects.</p>
            </div>
          </div>
        </div>

        {/* Verification Signatures */}
        <div className="pt-8 border-t border-[var(--border-subtle,#D2E3FC)] flex justify-between items-end text-xs text-[var(--text-secondary,#5F6368)]">
          <div>
            <p className="text-[11px] font-medium text-[var(--text-primary,#1F1F1F)]">System Checksum: GSS-VERIFY-SEP2026-99A</p>
            <p className="text-[10px] mt-0.5 text-[var(--text-muted,#747775)]">Digitally certified via GSS Management System Core</p>
          </div>
          <div className="text-right">
            <div className="w-36 border-b border-[var(--border-card,#DADCE0)] mb-1"></div>
            <p className="text-[11px] text-[var(--text-primary,#1F1F1F)] font-medium">Operations Director</p>
          </div>
        </div>
      </div>
    </div>
  );
}
