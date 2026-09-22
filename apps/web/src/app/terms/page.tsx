'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  ShieldCheck,
  Scale,
  AlertOctagon,
  ArrowLeft,
  Building,
  CheckCircle2,
} from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-canvas,#F8FAFD)] text-[var(--text-primary,#1F1F1F)] transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--bg-card,#FFFFFF)]/90 backdrop-blur-md border-b border-[var(--border-card,#DADCE0)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-full hover:bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] transition-colors"
              title="Return to Portal"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] flex items-center justify-center font-bold">
                <Scale className="w-4 h-4" />
              </div>
              <span className="text-base font-semibold tracking-tight text-[var(--text-primary,#1F1F1F)]">
                Terms & Conditions
              </span>
            </div>
          </div>
          <span className="text-[11px] text-[var(--text-muted,#747775)] font-mono">
            Version 2.4 • Sep 2026
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-[var(--brand-primary,#1A73E8)]">
            Legal Agreement
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary,#1F1F1F)] tracking-tight">
            Gateway Software Solutions Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary,#5F6368)] leading-relaxed">
            These Terms govern authorized access and acceptable use of the GSS Management System by employees, mentors, administrative personnel, and enrolled interns across all branch locations.
          </p>
        </div>

        {/* Highlights Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
          <div className="p-4 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs">
            <div className="flex items-center gap-2 text-[var(--brand-primary,#1A73E8)] font-semibold text-xs mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Authorized Use Only</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">
              Access is restricted solely to vetted staff with active administrator approval.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs mb-1">
              <Building className="w-4 h-4" />
              <span>Branch Governance</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">
              Operations conform strictly to local branch codes (CBE, CHN, BLR, HYD).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs">
            <div className="flex items-center gap-2 text-amber-700 font-semibold text-xs mb-1">
              <AlertOctagon className="w-4 h-4" />
              <span>Audit Accountability</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">
              All worklog entries and attendance sign-offs generate non-repudiable audit trails.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <div className="p-6 sm:p-10 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs space-y-8 text-xs sm:text-sm text-[var(--text-secondary,#444746)] leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">1.</span>
              Acceptance of Terms & Eligibility
            </h2>
            <p>
              By accessing, authenticating into, or utilizing the GSS Management System (“System”), you agree to be bound by these Terms of Service and all related organizational guidelines issued by Gateway Software Solutions (“GSS”, “Company”).
            </p>
            <p>
              Access is granted on a per-user, non-transferable basis. Credentials must remain strictly confidential and may never be shared, shared across shifts, or delegated to unauthorized parties.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">2.</span>
              Role Responsibilities & Acceptable Use
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong className="text-[var(--text-primary,#1F1F1F)]">Daily Worklog Truthfulness:</strong> Personnel must submit accurate check-in/out timestamps and genuine summaries of completed deliverables. Falsification of hours or task logs constitutes serious disciplinary misconduct.
              </li>
              <li>
                <strong className="text-[var(--text-primary,#1F1F1F)]">Trainee & Student Mentorship:</strong> Mentors must maintain daily attendance registers and marks objectively. Retaliatory grading or failure to log timely attendance is strictly prohibited.
              </li>
              <li>
                <strong className="text-[var(--text-primary,#1F1F1F)]">Data Scoping Integrity:</strong> Users shall not attempt to bypass role boundaries or query data from unauthorized branches or colleague cohorts.
              </li>
              <li>
                <strong className="text-[var(--text-primary,#1F1F1F)]">Security & Credentials:</strong> Any suspicion of compromised credentials or unauthorized data export must be reported to the Super Administrator immediately.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">3.</span>
              Intellectual Property & Trainee Capstones
            </h2>
            <p>
              All software architectures, documentation templates, training curricula, and proprietary source code utilized in GSS programs are the exclusive intellectual property of Gateway Software Solutions.
            </p>
            <p>
              Trainee academic projects and IEEE compliance submissions developed during company tenure are governed by respective enrollment agreements and mentor sign-offs.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">4.</span>
              Account Lifecycle & Termination
            </h2>
            <p>
              GSS reserves the right to suspend or terminate account access immediately upon personnel resignation, internship completion, breach of confidentiality, or policy violation. Upon termination, digital authorization tokens are revoked instantaneously across all branch endpoints.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">5.</span>
              Governing Law & Dispute Resolution
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any legal disputes arising in connection with system utilization shall be subject to the exclusive jurisdiction of the courts in Coimbatore, Tamil Nadu.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[var(--border-card,#DADCE0)] py-8 px-6 text-center text-xs text-[var(--text-muted,#747775)] bg-[var(--bg-card,#FFFFFF)]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Gateway Software Solutions. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs">
            <Link href="/help" className="hover:text-[var(--text-primary,#1F1F1F)] transition-colors">
              Help Center
            </Link>
            <Link href="/privacy" className="hover:text-[var(--text-primary,#1F1F1F)] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/dashboard" className="hover:text-[var(--brand-primary,#1A73E8)] transition-colors">
              Management Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
