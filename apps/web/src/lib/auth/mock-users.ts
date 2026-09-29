import { User } from '@/types/auth';

export interface StoredUser extends User {
  passwordHash: string;
}

// Runtime auth must come from the configured identity store. A seeded account
// here would be a production backdoor because this module is shipped to deploys.
export const INITIAL_USERS: StoredUser[] = [];
