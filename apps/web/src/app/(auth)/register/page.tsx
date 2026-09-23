'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { UserRole, Branch, BRANCHES, DEFAULT_DOMAINS } from '@/types/auth';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Lock,
  ArrowRight,
  AlertCircle,
  Clock,
  Briefcase,
  MapPin,
  Cpu,
  Plus,
  X,
  Check,
  Sun,
  Moon,
  Eye,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [requestedRole, setRequestedRole] = useState<UserRole>('intern');
  const [branch, setBranch] = useState<Branch>('Coimbatore');

  const [selectedDomains, setSelectedDomains] = useState<string[]>(['Gen AI']);
  const [customDomainInput, setCustomDomainInput] = useState('');

  const [startMonthYear, setStartMonthYear] = useState('2026-09');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleDomain = (domain: string) => {
    if (selectedDomains.includes(domain)) {
      if (selectedDomains.length > 1) {
        setSelectedDomains(selectedDomains.filter((d) => d !== domain));
      }
    } else {
      setSelectedDomains([...selectedDomains, domain]);
    }
  };

  const addCustomDomain = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customDomainInput.trim();
    if (!trimmed) return;
    if (!selectedDomains.includes(trimmed)) {
      setSelectedDomains([...selectedDomains, trimmed]);
    }
    setCustomDomainInput('');
  };

  const removeDomain = (domain: string) => {
    if (selectedDomains.length > 1) {
      setSelectedDomains(selectedDomains.filter((d) => d !== domain));
    }
  };

  const makeMajor = (domain: string) => {
    const remaining = selectedDomains.filter((d) => d !== domain);
    setSelectedDomains([domain, ...remaining]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid company or personal Gmail address.');
      return;
    }

    const cleanPhone = mobile.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!branch) {
      setError('Please select your branch location.');
      return;
    }

    if (selectedDomains.length === 0) {
      setError('Please select or type at least one domain specialization.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    const major = selectedDomains[0] || 'Gen AI';
    const additionals = selectedDomains.slice(1);

    setIsSubmitting(true);
    const result = await register({
      name,
      email,
      mobile: cleanPhone,
      requestedRole,
      branch,
      specialization: major,
      majorSpecialization: major,
      additionalSpecializations: additionals,
      specializations: selectedDomains,
      startMonthYear,
      password,
    });
    setIsSubmitting(false);

    if (!result.success) {
      if (result.alreadyExists) {
        const redirectEmail = result.email || email.trim();
        setError(result.error || 'An account with this Gmail address already exists. Redirecting to sign in...');
        setTimeout(() => {
          router.push(`/login?email=${encodeURIComponent(redirectEmail)}`);
        }, 1200);
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    }
  };

  return (
    <div className="w-full max-w-[620px] animate-panel-entrance py-6">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-8 sm:p-10 shadow-xs text-[var(--text-primary)]">
        {/* Header: Logo on left, Mode button on right */}
        <div className="flex items-center justify-between mb-6">
          <BrandLogo size="md" />

          <button
            type="button"
            onClick={toggleTheme}
            title={`Current mode: ${theme}. Click to switch theme.`}
            aria-label="Toggle theme mode"
            className="w-10 h-10 rounded-full bg-[var(--brand-container)] hover:opacity-85 text-[var(--brand-primary)] flex items-center justify-center transition-all cursor-pointer shadow-xs border border-[var(--border-card)] focus:outline-hidden focus:ring-2 focus:ring-[var(--brand-primary)] shrink-0"
          >
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-blue-400" />
            ) : theme === 'eye-care' ? (
              <Eye className="w-5 h-5 text-amber-500" />
            ) : (
              <Sun className="w-5 h-5 text-amber-500" />
            )}
          </button>
        </div>

        {/* Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl font-normal text-[var(--text-primary)] tracking-tight">
            Create your GSS Account
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Register your staff profile with branch and domain specializations
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-[var(--badge-danger-bg)] border border-[var(--badge-danger-border)] flex items-start gap-2.5 text-xs text-[var(--badge-danger-text)]">
            <AlertCircle className="w-4 h-4 text-[var(--badge-danger-text)] shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <Input
                label="Gmail Address"
                placeholder="name@gmail.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />
            </div>

            <div>
              <Input
                label="Mobile Number"
                placeholder="10-digit number"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                leftIcon={<Phone className="w-4 h-4" />}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Branch Dropdown */}
            <div className="space-y-1.5">
              <label
                htmlFor="branch-select"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Branch Location
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-[var(--brand-primary)] pointer-events-none flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <select
                  id="branch-select"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value as Branch)}
                  className="w-full h-11 pl-10 pr-4 bg-[var(--bg-card)] text-[var(--text-primary)] text-xs rounded-xl border border-[var(--border-card)] focus:border-[var(--brand-primary)] focus:outline-none transition-all cursor-pointer font-medium"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b} Branch
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Requested Role Dropdown */}
            <div className="space-y-1.5">
              <label
                htmlFor="requested-role"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Requested Role
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-[var(--text-secondary)] pointer-events-none flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <select
                  id="requested-role"
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value as UserRole)}
                  className="w-full h-11 pl-10 pr-4 bg-[var(--bg-card)] text-[var(--text-primary)] text-xs rounded-xl border border-[var(--border-card)] focus:border-[var(--brand-primary)] focus:outline-none transition-all cursor-pointer"
                >
                  <option value="intern">Intern / Trainee</option>
                  <option value="employee">Employee (Developer / Mentor)</option>
                  <option value="hr">HR & Lead Coordinator</option>
                  <option value="admin">Branch Administrator</option>
                </select>
              </div>
            </div>
          </div>

          {/* Multiple Domain Specializations */}
          <div className="space-y-2.5 p-4 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)]">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                <span>Domain Specializations</span>
              </label>
              <span className="text-xs text-[var(--brand-primary)] font-medium">
                {selectedDomains.length} selected
              </span>
            </div>

            {/* Active Selected Tags */}
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)]">
              {selectedDomains.map((dom, index) => {
                const isMajor = index === 0;
                return (
                  <span
                    key={dom}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      isMajor
                        ? 'bg-[var(--brand-container)] text-[var(--brand-primary)] border border-[var(--border-subtle)]'
                        : 'bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] border border-[var(--border-card)]'
                    }`}
                  >
                    {isMajor ? (
                      <span className="text-[10px] uppercase font-bold text-[var(--brand-primary)]">
                        ★ Major
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        +
                      </span>
                    )}
                    <span>{dom}</span>
                    {!isMajor && (
                      <button
                        type="button"
                        onClick={() => makeMajor(dom)}
                        className="text-[11px] text-[var(--brand-primary)] hover:underline ml-0.5 cursor-pointer"
                        title="Promote to Major"
                      >
                        (Make Major)
                      </button>
                    )}
                    {selectedDomains.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDomain(dom)}
                        className="hover:opacity-80 p-0.5 ml-0.5 text-[var(--text-muted)] cursor-pointer"
                        title="Remove domain"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>

            {/* Custom Type Option */}
            <div className="pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type custom domain..."
                  value={customDomainInput}
                  onChange={(e) => setCustomDomainInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomDomain();
                    }
                  }}
                  className="w-full h-9 px-3 bg-[var(--bg-card)] text-xs text-[var(--text-primary)] rounded-xl border border-[var(--border-card)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addCustomDomain()}
                  className="h-9 px-3.5 rounded-full bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-xs font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Predefined Click-to-Toggle Domains */}
            <div className="pt-2">
              <p className="text-[11px] text-[var(--text-secondary)] mb-2 font-medium">
                Popular Domains:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_DOMAINS.map((dom) => {
                  const isSelected = selectedDomains.includes(dom);
                  return (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => toggleDomain(dom)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--brand-container)] text-[var(--brand-primary)] border border-[var(--brand-primary)]'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-[var(--brand-primary)]" />}
                      <span>{dom}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Start Month & Year */}
          <div className="space-y-1.5">
            <label
              htmlFor="start-month-year"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Start Month & Year
            </label>
            <input
              id="start-month-year"
              type="month"
              value={startMonthYear}
              onChange={(e) => setStartMonthYear(e.target.value)}
              className="w-full h-11 px-3.5 bg-[var(--bg-card)] text-[var(--text-primary)] text-xs rounded-xl border border-[var(--border-card)] focus:border-[var(--brand-primary)] focus:outline-none transition-all cursor-pointer"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <Input
                label="Password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                showPasswordToggle
                required
              />
            </div>

            <div>
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                showPasswordToggle
                required
              />
            </div>
          </div>

          {/* Authentic Google Action Row */}
          <div className="pt-4 flex items-center justify-between">
            <Link
              href="/login"
              className="text-xs text-[var(--brand-primary)] font-medium hover:underline"
            >
              Sign in instead
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
            >
              Create account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
