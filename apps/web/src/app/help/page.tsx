'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  Search,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  FileSpreadsheet,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  LifeBuoy,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const FAQS: FaqItem[] = [
  {
    category: 'Attendance & Tracking',
    question: 'How is employee and trainee daily attendance recorded?',
    answer: 'Employees log daily check-in and check-out times via the Worklog hub, while Trainee/Student attendance is recorded directly inside the "My Students" cohort matrix. The system automatically computes working days according to the branch academic calendar, excluding official company holidays and Sundays.',
  },
  {
    category: 'Attendance & Tracking',
    question: 'How do monthly rollovers work for multi-month trainee programs?',
    answer: 'At the end of each calendar month, the system evaluates trainee tenure from their recorded Start Date to End Date. Clicking "Roll Over to Next Month" automatically carries forward active trainees into the next month\'s attendance subsheet while preserving historical records.',
  },
  {
    category: 'Reports & Exports',
    question: 'Which document formats are supported for report generation?',
    answer: 'All reporting modules support high-definition Print / PDF via browser formatting, Microsoft Excel spreadsheets (.xlsx) with auto-spaced columns and metadata banners, and Microsoft Word dossiers (.docx) containing corporate headers, section tables, and digital audit checksums.',
  },
  {
    category: 'Reports & Exports',
    question: 'How do I download an individual student performance report?',
    answer: 'Navigate to "Student Directory" or "My Students", locate the trainee profile, and select the desired export format (Print/PDF, Excel, or DOCX) in the upper-right action toolbar. The generated document includes total present days, attendance percentages, and deliverable status.',
  },
  {
    category: 'Roles & Security',
    question: 'What are the access privileges for Super Admin versus Branch Admin?',
    answer: 'Super Administrators possess universal visibility across all 4 branches (Coimbatore, Chennai, Bangalore, Hyderabad) and can approve staff accounts and assign system roles. Branch Admins manage operations, personnel rosters, and attendance records strictly scoped to their assigned branch location.',
  },
  {
    category: 'Tasks & Delegations',
    question: 'How are assigned deliverables tracked and updated?',
    answer: 'Authorized personnel can assign tasks individually or to domain cohorts in the Tasks & Delegations hub. Assignees receive live notifications and can transition task status from "Not Started" to "In Progress" and "Completed".',
  },
];

const BRANCH_SUPPORT = [
  {
    name: 'Coimbatore Head Office',
    code: 'CBE',
    address: 'Gateway Software Solutions, Nava India, Avinashi Road, Coimbatore - 641004',
    phone: '+91 98422 12345',
    email: 'support.cbe@gatewayskill.in',
  },
  {
    name: 'Chennai Tech Center',
    code: 'CHN',
    address: 'Gateway Software Solutions, OMR IT Corridor, Sholinganallur, Chennai - 600119',
    phone: '+91 98422 23456',
    email: 'support.chn@gatewayskill.in',
  },
  {
    name: 'Bangalore Innovation Hub',
    code: 'BLR',
    address: 'Gateway Software Solutions, Koramangala 5th Block, Bangalore - 560095',
    phone: '+91 98422 34567',
    email: 'support.blr@gatewayskill.in',
  },
  {
    name: 'Hyderabad Operations Center',
    code: 'HYD',
    address: 'Gateway Software Solutions, HITEC City, Madhapur, Hyderabad - 500081',
    phone: '+91 98422 45678',
    email: 'support.hyd@gatewayskill.in',
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'Attendance & Tracking', 'Reports & Exports', 'Roles & Security', 'Tasks & Delegations'];

  const filteredFaqs = FAQS.filter((faq) => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen w-full bg-[var(--bg-canvas,#F8FAFD)] text-[var(--text-primary,#1F1F1F)] transition-colors">
      {/* Top Corporate Nav */}
      <header className="sticky top-0 z-30 bg-[var(--bg-card,#FFFFFF)]/90 backdrop-blur-md border-b border-[var(--border-card,#DADCE0)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-full hover:bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] flex items-center justify-center font-bold">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <span className="text-base font-semibold tracking-tight text-[var(--text-primary,#1F1F1F)]">
                GSS Help & Knowledge Center
              </span>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-medium px-3.5 py-1.5 rounded-full bg-[var(--brand-primary,#1A73E8)] text-white hover:opacity-90 transition-all shadow-xs"
          >
            Go to App
          </Link>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-[var(--brand-container,#E8F0FE)]/60 to-transparent py-12 px-4 sm:px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] text-xs font-semibold border border-[var(--border-subtle,#D2E3FC)]">
            <Sparkles className="w-3.5 h-3.5" />
            Gateway Software Solutions • Enterprise Support
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary,#1F1F1F)]">
            How can we assist you today?
          </h1>
          <p className="text-sm text-[var(--text-secondary,#5F6368)] max-w-xl mx-auto">
            Find answers to operational workflows, Google Sheets synchronization, attendance matrix tracking, and corporate report exports.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto pt-2">
            <Search className="w-4 h-4 text-[var(--text-muted,#747775)] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search guides, workflows, formulas, or permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl text-xs text-[var(--text-primary,#1F1F1F)] shadow-sm focus:outline-none focus:border-[var(--brand-primary,#1A73E8)] focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)]/20 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-12">
        {/* Quick Topic Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setSelectedCategory('Attendance & Tracking')}
            className="p-5 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)] transition-all cursor-pointer shadow-xs group"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">Attendance & Worklogs</h3>
            <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1">
              Daily check-ins, monthly cohort matrices, and calendar rules.
            </p>
          </div>

          <div
            onClick={() => setSelectedCategory('Attendance & Tracking')}
            className="p-5 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)] transition-all cursor-pointer shadow-xs group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">Student Mentorship</h3>
            <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1">
              Mentorship allocations, tenure monitoring, and task evaluation.
            </p>
          </div>

          <div
            onClick={() => setSelectedCategory('Reports & Exports')}
            className="p-5 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)] transition-all cursor-pointer shadow-xs group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">Report Generation</h3>
            <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1">
              Instant Print/PDF, Microsoft Excel (.xlsx), and Word (.docx) downloads.
            </p>
          </div>

          <div
            onClick={() => setSelectedCategory('Roles & Security')}
            className="p-5 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)] transition-all cursor-pointer shadow-xs group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">RBAC & Permissions</h3>
            <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1">
              Super Admin, Branch Director, HR Ops, and Staff access boundaries.
            </p>
          </div>
        </section>

        {/* FAQs Accordion */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-card,#DADCE0)] pb-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary,#1F1F1F)]">
                Frequently Asked Questions
              </h2>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5">
                Core answers regarding system operation and enterprise policy
              </p>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer capitalize ${
                    selectedCategory === cat
                      ? 'bg-[var(--brand-primary,#1A73E8)] text-white shadow-xs'
                      : 'bg-[var(--bg-card,#FFFFFF)] text-[var(--text-secondary,#5F6368)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] border border-[var(--border-card,#DADCE0)]'
                  }`}
                >
                  {cat === 'all' ? 'All Questions' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="text-center py-12 text-xs text-[var(--text-muted,#747775)] bg-[var(--bg-card,#FFFFFF)] rounded-2xl border border-[var(--border-card,#DADCE0)]">
                No matching answers found. Try refining your search query above.
              </div>
            ) : (
              filteredFaqs.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-muted,#747775)]">
                          {faq.category}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-[var(--text-primary,#1F1F1F)]">
                          {faq.question}
                        </span>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[var(--text-muted,#747775)] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--text-muted,#747775)] shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 text-xs text-[var(--text-secondary,#444746)] leading-relaxed border-t border-[var(--border-subtle,#E8EAED)] bg-[var(--bg-card-subtle,#F8FAFD)]/50">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Branch Operations & Support Directory */}
        <section className="space-y-4">
          <div className="border-b border-[var(--border-card,#DADCE0)] pb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary,#1F1F1F)]">
              Branch Technical Support Directory
            </h2>
            <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5">
              Direct point of contact for operational queries across all branch centers
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BRANCH_SUPPORT.map((b) => (
              <div
                key={b.code}
                className="p-5 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">{b.name}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] font-semibold">
                    {b.code}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary,#5F6368)] flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted,#747775)] mt-0.5" />
                  <span>{b.address}</span>
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-[var(--border-subtle,#E8EAED)]">
                  <span className="flex items-center gap-1.5 text-[var(--brand-primary,#1A73E8)] font-medium">
                    <Phone className="w-3.5 h-3.5" /> {b.phone}
                  </span>
                  <span className="flex items-center gap-1.5 text-[var(--text-secondary,#5F6368)]">
                    <Mail className="w-3.5 h-3.5" /> {b.email}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[var(--border-card,#DADCE0)] py-8 px-6 text-center text-xs text-[var(--text-muted,#747775)] mt-12 bg-[var(--bg-card,#FFFFFF)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Gateway Software Solutions. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs">
            <Link href="/privacy" className="hover:text-[var(--text-primary,#1F1F1F)] transition-colors">
              Privacy Policy
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
