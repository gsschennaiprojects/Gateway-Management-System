/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — FIREBASE AUTH SERVICE
 * Authentication operations: Sign In, Sign Up, Sign Out, Password Reset,
 * Profile Management, and Session Listener
 * ============================================================================
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  message: string;
  user?: User;
}

// ─── Email/Password Authentication ─────────────────────────────────────────────

/**
 * Sign in with email and password.
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const auth = getFirebaseAuth();
    const credential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
    return {
      success: true,
      message: `Welcome back, ${credential.user.displayName || credential.user.email}!`,
      user: credential.user,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const errorMessages: Record<string, string> = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-email': 'Invalid email format.',
      'auth/user-disabled': 'This account has been disabled. Contact your branch admin.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
    };
    return {
      success: false,
      message: errorMessages[err.code || ''] || err.message || 'Authentication failed.',
    };
  }
}

/**
 * Create a new user account with email and password.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResult> {
  try {
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    // Set display name on the Firebase Auth profile
    await updateProfile(credential.user, { displayName });

    return {
      success: true,
      message: `Account created successfully for ${displayName}. Pending admin approval.`,
      user: credential.user,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'Invalid email format.',
      'auth/operation-not-allowed': 'Email/password accounts are not enabled. Contact admin.',
    };
    return {
      success: false,
      message: errorMessages[err.code || ''] || err.message || 'Registration failed.',
    };
  }
}

// ─── Google Sign-In ────────────────────────────────────────────────────────────

/**
 * Sign in with Google account popup.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    const credential = await signInWithPopup(auth, provider);
    return {
      success: true,
      message: `Welcome, ${credential.user.displayName}!`,
      user: credential.user,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'auth/popup-closed-by-user') {
      return { success: false, message: 'Sign-in popup was closed.' };
    }
    return {
      success: false,
      message: err.message || 'Google sign-in failed.',
    };
  }
}

// ─── Sign Out ──────────────────────────────────────────────────────────────────

/**
 * Sign out the currently authenticated user.
 */
export async function firebaseSignOut(): Promise<AuthResult> {
  try {
    const auth = getFirebaseAuth();
    await signOut(auth);
    return { success: true, message: 'Signed out successfully.' };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, message: err.message || 'Sign out failed.' };
  }
}

// ─── Password Reset ────────────────────────────────────────────────────────────

/**
 * Send a password reset email.
 */
export async function sendResetEmail(email: string): Promise<AuthResult> {
  try {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
    return {
      success: true,
      message: `Password reset email sent to ${email}. Check your inbox.`,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'auth/user-not-found') {
      return { success: false, message: 'No account found with this email.' };
    }
    return { success: false, message: err.message || 'Failed to send reset email.' };
  }
}

// ─── Auth State Observer ───────────────────────────────────────────────────────

/**
 * Subscribe to auth state changes. Returns unsubscribe function.
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the currently signed-in user (synchronous check).
 */
export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth.currentUser;
}

/**
 * Get the current user's ID token for API authorization headers.
 */
export async function getIdToken(): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;
  return user.getIdToken();
}
