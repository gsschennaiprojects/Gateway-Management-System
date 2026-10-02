import { StoredUser, INITIAL_USERS } from './mock-users';
import { RegisterPayload, User, Branch, UserRole } from '@/types/auth';
import { hashPassword } from './password';

import { generateCustomUserId } from './user-id-generator';

// In-memory runtime store for server-side route handlers
const serverUsers: StoredUser[] = [...INITIAL_USERS];

export function getAllUsers(): StoredUser[] {
  return serverUsers;
}

export function getUsersByBranch(branch?: Branch): StoredUser[] {
  if (!branch) return serverUsers;
  return serverUsers.filter((u) => u.branch === branch);
}

export function findUserByIdentifier(identifier: string): StoredUser | undefined {
  const cleanId = identifier.trim().toLowerCase();
  const digitsOnly = identifier.replace(/\D/g, '');

  return serverUsers.find((u) => {
    const idMatch = (u.id && u.id.toLowerCase() === cleanId) || (u.employeeId && u.employeeId.toLowerCase() === cleanId);
    const emailMatch = u.email.toLowerCase() === cleanId;
    const phoneMatch = digitsOnly.length >= 10 && u.mobile.replace(/\D/g, '').endsWith(digitsOnly.slice(-10));
    return idMatch || emailMatch || phoneMatch;
  });
}

export function findUserById(id: string): StoredUser | undefined {
  return serverUsers.find((u) => u.id === id || u.employeeId === id);
}

export function generateProfessionalUserId(role?: string, existingUsers?: StoredUser[]): string {
  const list = existingUsers || serverUsers;
  const existingIds = new Set<string>();
  for (const u of list) {
    if (u.id) existingIds.add(u.id);
    if (u.employeeId) existingIds.add(u.employeeId);
  }
  return generateCustomUserId(role || 'employee', existingIds);
}

export function createUser(payload: RegisterPayload & { id?: string }): StoredUser {
  const existing = findUserByIdentifier(payload.email) || findUserByIdentifier(payload.mobile);
  if (existing) {
    throw new Error('An account with this email or mobile number already exists.');
  }

  const specsArray = Array.isArray(payload.specializations) && payload.specializations.length > 0
    ? payload.specializations
    : payload.specialization
    ? [payload.specialization]
    : ['Gen AI'];

  const major = payload.majorSpecialization || specsArray[0] || 'Gen AI';
  const additionals = payload.additionalSpecializations !== undefined
    ? payload.additionalSpecializations
    : specsArray.slice(1);

  const assignedRole = (['admin', 'hr', 'employee', 'intern'].includes(payload.requestedRole)
    ? payload.requestedRole
    : 'employee') as UserRole;
  const initialStatus = 'pending';
  const userId = payload.id || generateProfessionalUserId(assignedRole, serverUsers);

  const newUser: StoredUser = {
    id: userId,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    mobile: payload.mobile.trim(),
    role: assignedRole,
    status: initialStatus,
    branch: payload.branch || 'Coimbatore',
    specialization: major,
    specializations: specsArray,
    majorSpecialization: major,
    additionalSpecializations: additionals,
    startMonthYear: payload.startMonthYear,
    startDate: payload.startDate,
    endDate: payload.endDate,
    gender: payload.gender,
    dob: payload.dob,
    doj: payload.doj || payload.dateOfJoining,
    dateOfJoining: payload.dateOfJoining || payload.doj,
    entryTime: payload.entryTime || payload.shiftTiming?.entryTime || '09:30 AM',
    exitTime: payload.exitTime || payload.shiftTiming?.exitTime || '06:30 PM',
    shiftTiming: payload.shiftTiming || {
      entryTime: payload.entryTime || '09:30 AM',
      exitTime: payload.exitTime || '06:30 PM',
    },
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(payload.password)
  };

  serverUsers.push(newUser);
  return newUser;
}

export function upsertServerUser(user: StoredUser): StoredUser {
  const index = serverUsers.findIndex((u) => u.id === user.id);
  if (index !== -1) {
    serverUsers[index] = { ...serverUsers[index], ...user };
    return serverUsers[index];
  } else {
    serverUsers.push(user);
    return user;
  }
}

export function updateUserStatus(userId: string, status: 'active' | 'rejected', fallbackUser?: StoredUser): StoredUser {
  let user = findUserById(userId);
  if (!user && fallbackUser) {
    user = upsertServerUser(fallbackUser);
  }
  if (!user) {
    throw new Error('User not found');
  }
  user.status = status;
  return user;
}

export function updateUserRole(userId: string, role: StoredUser['role'], fallbackUser?: StoredUser): StoredUser {
  let user = findUserById(userId);
  if (!user && fallbackUser) {
    user = upsertServerUser(fallbackUser);
  }
  if (!user) {
    throw new Error('User not found');
  }
  user.role = role;
  return user;
}

export function deleteUser(userId: string): boolean {
  const index = serverUsers.findIndex((u) => u.id === userId);
  if (index !== -1) {
    serverUsers.splice(index, 1);
  }
  return true;
}

export function stripSensitive(user: User & { passwordHash?: string; password?: string }): User {
  const safeUser = { ...user } as Record<string, unknown>;
  delete safeUser.passwordHash;
  delete safeUser.password;
  return safeUser as unknown as User;
}
