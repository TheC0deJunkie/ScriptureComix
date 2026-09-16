/**
 * Firebase bootstrap for ScriptureComix.
 *
 * Config comes from `VITE_FIREBASE_*` env vars (see .env.example). Everything is
 * lazy so importing this module never throws — the app stays fully usable
 * offline / without a Firebase config, it just cannot sign in or sync.
 */
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const env = (import.meta as any).env ?? {};

/** Builds the Firebase options from VITE_FIREBASE_* values; `configured` is false when the essentials are missing. */
export function readFirebaseConfig(source: Record<string, string | undefined>): { config: FirebaseOptions; configured: boolean } {
  const config: FirebaseOptions = {
    apiKey: source.VITE_FIREBASE_API_KEY,
    authDomain: source.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: source.VITE_FIREBASE_PROJECT_ID,
    storageBucket: source.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: source.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: source.VITE_FIREBASE_APP_ID,
    measurementId: source.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  };
  return { config, configured: Boolean(config.apiKey && config.projectId && config.appId) };
}

const read = readFirebaseConfig(env);
export const firebaseConfig: FirebaseOptions = read.config;

/** True when enough config is present to talk to Firebase at all. */
export const isFirebaseConfigured: boolean = read.configured;

const useEmulators = String(env.VITE_FIREBASE_USE_EMULATORS ?? '').toLowerCase() === 'true';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to .env (see .env.example).');
  }
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  if (useEmulators) connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  return auth;
}

export function getDb(): Firestore {
  if (db) return db;
  const firebaseApp = getFirebaseApp();
  try {
    // Offline-first: reads and writes are queued locally and replayed when back online,
    // which matches the PWA's "works without a network" promise.
    db = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialised (e.g. HMR) — reuse the existing instance.
    db = getFirestore(firebaseApp);
  }
  if (useEmulators) connectFirestoreEmulator(db, 'localhost', 8080);
  return db;
}
