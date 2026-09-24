import { User } from '@/types/auth';

export interface StoredUser extends User {
  passwordHash: string;
}

export const INITIAL_USERS: StoredUser[] = [
  {
    id: 'GSS_SA_001',
    name: 'SABARINATHAN Muthu',
    email: 'gateway.managercbe@gmail.com',
    mobile: '7397078885',
    role: 'superadmin',
    status: 'active',
    branch: 'Coimbatore',
    specialization: 'Enterprise Operations & Systems Administration',
    startMonthYear: '2013-01',
    createdAt: '2013-01-01T00:00:00.000Z',
    passwordHash: 'GatewaySS@2013#',
    avatarUrl: ''
  }
];

