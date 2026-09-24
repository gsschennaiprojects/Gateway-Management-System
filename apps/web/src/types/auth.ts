export type UserRole = 'superadmin' | 'admin' | 'hr' | 'employee' | 'intern';
export type UserStatus = 'active' | 'pending' | 'rejected';
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

export interface User {
  id: string;
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
  password?: string; // Visible only to Super Admin in User Management
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

export interface LoginCredentials {
  identifier: string; // Gmail or Mobile
  password?: string;
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
