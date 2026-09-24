import { StoredUser, INITIAL_USERS } from './mock-users';
import { RegisterPayload, User, Branch } from '@/types/auth';

// In-memory runtime store for server-side route handlers
let serverUsers: StoredUser[] = [...INITIAL_USERS];

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
    const emailMatch = u.email.toLowerCase() === cleanId;
    const phoneMatch = digitsOnly.length >= 10 && u.mobile.replace(/\D/g, '').endsWith(digitsOnly.slice(-10));
    return emailMatch || phoneMatch;
  });
}

export function findUserById(id: string): StoredUser | undefined {
  return serverUsers.find((u) => u.id === id);
}

export function createUser(payload: RegisterPayload): StoredUser {
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

  const isSuperAdmin = payload.requestedRole === 'superadmin' || payload.email.trim().toLowerCase() === 'gateway.managercbe@gmail.com';
  const initialStatus = isSuperAdmin ? 'active' : 'pending';

  const newUser: StoredUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    mobile: payload.mobile.trim(),
    role: payload.requestedRole || 'intern',
    status: initialStatus,
    branch: payload.branch || 'Coimbatore',
    specialization: major,
    specializations: specsArray,
    majorSpecialization: major,
    additionalSpecializations: additionals,
    startMonthYear: payload.startMonthYear,
    startDate: payload.startDate,
    endDate: payload.endDate,
    createdAt: new Date().toISOString(),
    passwordHash: payload.password
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

export function stripSensitive(user: StoredUser): User {
  const { passwordHash: _p, ...safeUser } = user;
  return safeUser;
}
