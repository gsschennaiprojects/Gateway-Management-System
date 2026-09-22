'use client';

import React from 'react';
import Link from 'next/link';
import {
  Shield,
  Lock,
  Eye,
  FileCheck,
  Server,
  ArrowLeft,
  Calendar,
  Building,
  CheckCircle2,
} from 'lucide-react';

export default function PrivacyPolicyPage() {
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
              <div className="w-8 h-8 rounded-lg bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] flex items-center justify-center font-bold">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-base font-semibold tracking-tight text-[var(--text-primary,#1F1F1F)]">
                Privacy & Data Governance
              </span>
            </div>
          </div>
          <span className="text-[11px] text-[var(--text-muted,#747775)] font-mono">
            Effective: Sep 2026
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-[var(--brand-primary,#1A73E8)]">
            Enterprise Compliance Document
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary,#1F1F1F)] tracking-tight">
            Gateway Software Solutions Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary,#5F6368)] leading-relaxed">
            This Policy details our commitments and procedural safeguards regarding the collection, storage, role-based access, and processing of employee and student records across all GSS centers.
          </p>
        </div>

        {/* Highlights Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
          <div className="p-4 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs">
            <div className="flex items-center gap-2 text-[var(--brand-primary,#1A73E8)] font-semibold text-xs mb-1">
              <Lock className="w-4 h-4" />
              <span>Role-Scoped Privacy</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">
              Branch staff access is mathematically bounded strictly to allocated students and personnel.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs mb-1">
              <Server className="w-4 h-4" />
              <span>Encrypted Repositories</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">
              All credentials, worklogs, and attendance records are encrypted at rest and in transit via TLS 1.3.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs">
            <div className="flex items-center gap-2 text-blue-700 font-semibold text-xs mb-1">
              <FileCheck className="w-4 h-4" />
              <span>Audit Checksums</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">
              Every exported document includes cryptographic system checksums preventing retroactive tampering.
            </p>
          </div>
        </div>
      </div>

      {/* Main Document Body */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <div className="p-6 sm:p-10 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs space-y-8 text-xs sm:text-sm text-[var(--text-secondary,#444746)] leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">1.</span>
              Scope & Information Architecture
            </h2>
            <p>
              Gateway Software Solutions (“GSS”, “Company”) operates an integrated enterprise portal (“GSS Management System”) serving four primary regional development centers: Coimbatore (Headquarters), Chennai, Bangalore, and Hyderabad.
            </p>
            <p>
              This policy covers all registered personnel including Super Administrators, Branch Directors, HR Operations, Technical Mentors, Employees, and Enrolled Interns/Trainees.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">2.</span>
              Categories of Data Collected
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong className="text-[var(--text-primary,#1F1F1F)]">Personnel Identification Data:</strong> Full legal name, corporate Google Workspace email, verified mobile contact number, assigned branch code, technology specialization, and organizational hierarchy.
              </li>
              <li>
                <strong className="text-[var(--text-primary,#1F1F1F)]">Operational & Attendance Records:</strong> Daily biometric / web check-in times, logout timestamps, verified working day hours, daily planned deliverables, and completed project milestones.
              </li>
              <li>
                <strong className="text-[var(--text-primary,#1F1F1F)]">Trainee Academic Records:</strong> Enrolled candidate full name, affiliated academic institution/college, technology stack domain, fee installment status, commencement date, completion date, and mentor assignment.
              </li>
              <li>
                <strong className="text-[var(--text-primary,#1F1F1F)]">System Audit Telemetry:</strong> Cryptographic session cookies, authentication timestamps, and digital document export checksums.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">3.</span>
              Role-Based Scoping & Confidentiality
            </h2>
            <p>
              In accordance with ISO/IEC 27001 and strict least-privilege standards, access to personnel records is enforced via hardware-isolated role boundaries:
            </p>
            <div className="p-4 rounded-xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-subtle,#E8EAED)] space-y-2 text-xs font-mono">
              <p>• Superadmin: Universal branch auditing, role allocation, system-wide exports</p>
              <p>• Admin: Restricted exclusively to allocated branch personnel, attendance, and trainees</p>
              <p>• HR: Restricted to candidate intake, lead deduplication, and employee directory</p>
              <p>• Employee: Restricted strictly to assigned trainees (STU_&#123;staffId&#125;) and own worklogs</p>
              <p>• Intern: Read-only access to assigned deliverables and own attendance matrix</p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">4.</span>
              Third-Party Integrations & Google Cloud Security
            </h2>
            <p>
              GSS Management System utilizes Google Workspace APIs (Sheets v4, Drive) and Firebase Cloud Firestore for synchronized multi-branch state management. Google service accounts communicate exclusively over TLS-encrypted enterprise tunnels with zero public credential disclosure.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">5.</span>
              Data Retention & Archival Policy
            </h2>
            <p>
              Employee daily worklogs and attendance registers are retained for a minimum statutory compliance period of 7 years. Trainee internship records and completion certificates are preserved in digital cold storage indefinitely to permit third-party academic and employer background verifications.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-2">
              <span className="text-[var(--brand-primary,#1A73E8)] font-bold">6.</span>
              Contact & Privacy Inquiries
            </h2>
            <p>
              For privacy compliance requests, data export copies, or credential revocation requests, please contact our Data Protection Officer:
            </p>
            <div className="p-4 rounded-xl bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] text-xs space-y-1">
              <p className="font-semibold">Gateway Software Solutions — Office of the Data Protection Officer</p>
              <p>Email: privacy@gatewayskill.in • Tel: +91 98422 12345</p>
              <p>Corporate Address: Nava India, Avinashi Road, Coimbatore, Tamil Nadu, India - 641004</p>
            </div>
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
            <Link href="/terms" className="hover:text-[var(--text-primary,#1F1F1F)] transition-colors">
              Terms of Service
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
