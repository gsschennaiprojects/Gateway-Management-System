import React from 'react';
import { GlassPanel } from './GlassPanel';

interface AttendanceGaugeProps {
  percentage: number;
  presentDays: number;
  absentDays: number;
  holidayDays: number;
  workingDaysTotal: number;
  monthName?: string;
  size?: 'normal' | 'compact';
}

export function AttendanceGauge({
  percentage = 92.5,
  presentDays = 21,
  absentDays = 2,
  holidayDays = 3,
  workingDaysTotal = 23,
  monthName = 'September 2026',
  size = 'normal',
}: AttendanceGaugeProps) {
  // Semi-circle gauge calculation
  // Radius 90, circumference for half circle = PI * R = ~282.74
  const radius = 90;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  if (size === 'compact') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-[var(--border-card,#DADCE0)]"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-[var(--badge-success-text,#137333)] transition-all duration-700 ease-out"
              strokeDasharray={`${percentage}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute font-mono text-[11px] font-semibold text-[var(--text-primary,#1F1F1F)]">
            {Math.round(percentage)}%
          </span>
        </div>
        <div className="truncate">
          <p className="text-xs font-medium text-[var(--text-primary,#1F1F1F)] truncate">{presentDays} / {workingDaysTotal} Days</p>
          <p className="text-[10px] font-mono text-[var(--text-secondary,#5F6368)] uppercase">Attendance</p>
        </div>
      </div>
    );
  }

  return (
    <GlassPanel className="p-5 sm:p-6 md:p-8 relative overflow-hidden transition-colors duration-200">
      {/* Header section with badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 relative z-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-container,#E8F0FE)] border border-[var(--border-subtle,#D2E3FC)] mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-primary,#1A73E8)] animate-pulse" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--brand-on-container,#1A73E8)]">
              Live Verified Attendance
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
            {monthName}
          </h2>
        </div>
        <div className="px-3.5 py-1 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] text-xs font-medium text-[var(--text-secondary,#444746)] border border-[var(--border-subtle,#E8EAED)]">
          Total Cycle: 26 Working Days
        </div>
      </div>

      {/* Hero Speedometer Arc */}
      <div className="relative flex flex-col items-center justify-center my-4 sm:my-6 relative z-10">
        <svg
          className="w-56 sm:w-64 md:w-72 h-32 sm:h-36 md:h-40 overflow-visible"
          viewBox="0 0 220 120"
        >
          <defs>
            <linearGradient id="googleGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--brand-primary, #1A73E8)" />
              <stop offset="100%" stopColor="var(--brand-primary-hover, #4285F4)" />
            </linearGradient>
          </defs>

          {/* Background track arc */}
          <path
            d="M 20 110 A 90 90 0 0 1 200 110"
            fill="none"
            stroke="var(--bg-card-subtle, #F1F3F4)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Active progress arc in Google Blue */}
          <path
            d="M 20 110 A 90 90 0 0 1 200 110"
            fill="none"
            stroke="url(#googleGaugeGradient)"
            strokeWidth="14"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Numeric Center */}
        <div className="absolute top-12 sm:top-14 md:top-16 flex flex-col items-center pointer-events-none">
          <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--text-primary,#1F1F1F)] tracking-tight flex items-baseline">
            <span>{percentage.toFixed(1)}</span>
            <span className="text-xl sm:text-2xl text-[var(--brand-primary,#1A73E8)] font-bold ml-0.5">%</span>
          </div>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted,#5F6368)] font-medium uppercase tracking-wider mt-0.5">
            Attendance Rate
          </p>
        </div>
      </div>

      {/* Legend & Breakdown beneath gauge */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-[var(--border-card,#DADCE0)] text-center relative z-10">
        <div className="p-3 sm:p-4 rounded-xl bg-[var(--bg-card-hover,#F8FAFD)] border border-[var(--border-card,#DADCE0)] transition-colors">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-[var(--badge-success-text,#1E8E3E)]" />
            <span className="text-xs text-[var(--text-secondary,#444746)] font-medium">Present</span>
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-base sm:text-xl font-bold text-[var(--text-primary,#1F1F1F)]">
              {presentDays}
            </span>
            <span className="text-xs text-[var(--text-muted,#5F6368)]">days</span>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-[var(--bg-card-hover,#F8FAFD)] border border-[var(--border-card,#DADCE0)] transition-colors">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-[var(--badge-danger-text,#D93025)]" />
            <span className="text-xs text-[var(--text-secondary,#444746)] font-medium">Absent</span>
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-base sm:text-xl font-bold text-[var(--text-primary,#1F1F1F)]">
              {absentDays}
            </span>
            <span className="text-xs text-[var(--text-muted,#5F6368)]">days</span>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-[var(--bg-card-hover,#F8FAFD)] border border-[var(--border-card,#DADCE0)] transition-colors">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-[var(--text-muted,#747775)]" />
            <span className="text-xs text-[var(--text-secondary,#444746)] font-medium">Holidays</span>
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-base sm:text-xl font-bold text-[var(--text-primary,#1F1F1F)]">
              {holidayDays}
            </span>
            <span className="text-xs text-[var(--text-muted,#5F6368)]">days</span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
