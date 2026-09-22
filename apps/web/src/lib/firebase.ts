/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — FIREBASE CONFIGURATION
 * Centralized Firebase SDK initialization for Next.js Web Application
 * ============================================================================
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAnalytics, type Analytics, isSupported } from 'firebase/analytics';

// ─── Firebase Configuration ────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyBdu8_3m0H2a7llugxPQk1FtjjVSosmN6w",
  authDomain: "gss-management-system-eef75.firebaseapp.com",
  projectId: "gss-management-system-eef75",
  storageBucket: "gss-management-system-eef75.firebasestorage.app",
  messagingSenderId: "528394878333",
  appId: "1:528394878333:web:a9a5da85cefbe639b9a014",
  measurementId: "G-NNL9WX2Q24"
};

// ─── Singleton Firebase App Instance ───────────────────────────────────────────

let firebaseAppInstance: FirebaseApp;
let auth: Auth;
let db: Firestore;
let analytics: Analytics | null = null;

/**
 * Initialize or retrieve existing Firebase App instance.
 * Prevents duplicate initialization in Next.js hot-reload / SSR scenarios.
 */
function getFirebaseApp(): FirebaseApp {
  if (!firebaseAppInstance) {
    firebaseAppInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }
  return firebaseAppInstance;
}

/**
 * Get Firebase Authentication instance.
 * Used for email/password login, phone OTP, Google SSO, etc.
 */
function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

/**
 * Get Cloud Firestore instance.
 * Used for real-time user profiles, task metadata, and student records.
 */
function getFirestoreDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

/**
 * Get Firebase Analytics instance (client-side only).
 * Returns null on server-side rendering.
 */
async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  
  if (!analytics) {
    const supported = await isSupported();
    if (supported) {
      analytics = getAnalytics(getFirebaseApp());
    }
  }
  return analytics;
}

// ─── Exports ───────────────────────────────────────────────────────────────────

export const app = getFirebaseApp();

export {
  firebaseConfig,
  getFirebaseApp,
  getFirebaseAuth,
  getFirestoreDb,
  getFirebaseAnalytics,
};

// Default export for convenience
export default getFirebaseApp;
