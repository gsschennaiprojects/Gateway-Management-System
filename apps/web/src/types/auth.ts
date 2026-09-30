/**
 * Authentication & Authorization Domain Models
 *
 * PURPOSE:
 * Defines the core identity, role-based access control (RBAC), and branch
 * affiliation models for Gateway Software Solutions (GSS) Management System.
 *
 * DATA AUTHORITY:
 * Cloud Firestore (`users` collection) is the canonical source of truth for all
 * identity and role assignments. Client sessions are verified server-side using
 * cryptographic HMAC-SHA256 tokens stored in HTTP-only cookies.
 *
 * ARCHITECTURAL CONNECTIONS:
 * - Session Management: `apps/web/src/lib/auth/session.ts`
 * - Authorization & RBAC: `apps/web/src/lib/rbac/permissions.ts`
 * - Server Data Access: `apps/web/src/lib/firebase/firebase-admin.ts`
 * - Reporting Projection: Synchronized to `02_Staff_Directory` tab in regional branch spreadsheets.
 */

/**
 * Enterprise Roles:
 * - `superadmin`: Full organizational oversight across all 4 regional branches.
 * - `admin`: Operational branch administrator (scoped to their branch).
 * - `hr`: People operations, recruitment, and attendance monitoring.
 * - `employee`: Senior staff, domain lead, and student project mentor.
 * - `intern`: Technical contributor and assigned learner.
 */
export type UserRole = 'superadmin' | 'admin' | 'hr' | 'employee' | 'intern';

/**
 * Account Lifecycle Status:
 * - `active`: Verified account with full dashboard access.
 * - `pending`: Self-registered account awaiting Admin/Superadmin approval.
 * - `rejected`: Registration rejected by an administrator.
 * - `disabled`: Suspended or former employee account.
 */
export type UserStatus = 'active' | 'pending' | 'rejected' | 'disabled';

/**
 * Regional Operational Branches.
 * All operational data (students, tasks, attendance, spreadsheets) is strictly partitioned by branch.
 */
export type Branch = 'Coimbatore' | 'Chennai' | 'Madurai' | 'Erode';

export const BRANCHES: Branch[] = ['Coimbatore', 'Chennai', 'Madurai', 'Erode'];

export const DEFAULT_DOMAINS = [
  'Gen AI',
  'AIML',
  'Data Science',
  'Python Full Stack',
  'Full Stack Web (MERN)',
  'Cloud DevOps & AWS',
  'UI/UX & Frontend',
  'Cybersecurity & Network',
  'Mobile App (Flutter / React Native)',
  'Blockchain & Web3'
] as const;

export const SPECIALIZATIONS = DEFAULT_DOMAINS;

export type Specialization = string;

/**
 * Canonical Application User Profile.
 * Transmitted to the client only after stripping sensitive credentials (passwordHash).
 */
export interface User {
  id: string;
  uid?: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  branch: Branch;
  specialization?: string; // Comma-joined or primary
  specializations?: string[]; // Array of all domains
  majorSpecialization?: string; // The primary domain for student assignment
  additionalSpecializations?: string[]; // Secondary domains visible in profile
  startMonthYear?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  avatarUrl?: string;
}

export interface AuthSession {
  user: User;
  uid: string;
  expiresAt: number;
}

export interface LoginCredentials {
  identifier: string; // Gmail or Mobile
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  mobile: string;
  requestedRole: UserRole;
  branch: Branch;
  specializations?: string[];
  specialization?: string;
  majorSpecialization?: string;
  additionalSpecializations?: string[];
  startMonthYear: string;
  startDate?: string;
  endDate?: string;
  password: string;
}
