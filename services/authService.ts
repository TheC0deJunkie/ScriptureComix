/**
 * Firebase Authentication: email/password, Google, and phone (SMS) sign-in.
 * Functions throw the raw FirebaseError; use `describeAuthError` for copy
 * that is safe to show a reader.
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut,
  type ConfirmationResult,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './firebase';

export type { User, ConfirmationResult, RecaptchaVerifier };

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

/**
 * Subscribe to sign-in state. Fires once with the current user (or `null`).
 * When Firebase is not configured it fires `null` once and never again.
 */
export function subscribeToAuth(cb: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

export function currentUser(): User | null {
  if (!isFirebaseConfigured) return null;
  return getFirebaseAuth().currentUser;
}

export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured) return;
  await signOut(getFirebaseAuth());
}

// ---------------------------------------------------------------------------
// Email / password
// ---------------------------------------------------------------------------

export async function signUpWithEmail(email: string, password: string, displayName?: string): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const name = displayName?.trim();
  if (name) await updateProfile(cred.user, { displayName: name });
  // Best effort: a failed verification email must not block sign-up.
  sendEmailVerification(cred.user).catch(() => {});
  return cred;
}

export function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
}

export function sendPasswordReset(email: string): Promise<void> {
  return sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

const googleProvider = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
};

/**
 * Google sign-in via popup, falling back to a full-page redirect where popups
 * are blocked or unsupported (installed PWA, some in-app browsers).
 * Resolves `null` when a redirect was started (the page will reload).
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const auth = getFirebaseAuth();
  try {
    return await signInWithPopup(auth, googleProvider());
  } catch (err: any) {
    const code = err?.code as string | undefined;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, googleProvider());
      return null;
    }
    throw err;
  }
}

/** Call once on app start to finish a redirect-based Google sign-in. */
export async function completeRedirectSignIn(): Promise<UserCredential | null> {
  if (!isFirebaseConfigured) return null;
  try {
    return await getRedirectResult(getFirebaseAuth());
  } catch (err) {
    console.warn('[auth] redirect sign-in failed', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phone (SMS)
// ---------------------------------------------------------------------------

/**
 * Creates an invisible reCAPTCHA bound to `container` (an element or its id).
 * Keep the verifier for the lifetime of the phone form and call `.clear()`
 * when the form unmounts.
 */
export function createPhoneRecaptcha(container: HTMLElement | string): RecaptchaVerifier {
  return new RecaptchaVerifier(getFirebaseAuth(), container, { size: 'invisible' });
}

/** Sends the SMS code. `phone` must be E.164 (see `normalizePhoneNumber`). */
export function startPhoneSignIn(phone: string, verifier: RecaptchaVerifier): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(getFirebaseAuth(), phone, verifier);
}

export function confirmPhoneCode(confirmation: ConfirmationResult, code: string): Promise<UserCredential> {
  return confirmation.confirm(code.replace(/\D/g, ''));
}

/**
 * Turns "+27 (82) 123-4567" into "+27821234567". Returns `null` when the input
 * cannot be a valid E.164 number (must start with "+" and have 8 to 15 digits).
 */
export function normalizePhoneNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+')) return null;
  const digits = trimmed.slice(1).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

// ---------------------------------------------------------------------------
// Errors and labels
// ---------------------------------------------------------------------------

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/email-already-in-use': 'There is already an account with that email. Try signing in instead.',
  'auth/user-not-found': 'No account matches those details.',
  'auth/wrong-password': 'No account matches those details.',
  'auth/invalid-credential': 'No account matches those details.',
  'auth/invalid-login-credentials': 'No account matches those details.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'You appear to be offline. Reconnect and try again.',
  'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
  'auth/cancelled-popup-request': 'The Google window was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
  'auth/unauthorized-domain': 'This site is not on the list of allowed sign-in domains yet.',
  'auth/account-exists-with-different-credential': 'That email is already linked to a different sign-in method.',
  'auth/operation-not-allowed': 'This sign-in method is not switched on for the app yet.',
  'auth/invalid-phone-number': 'Enter the phone number with its country code, like +27821234567.',
  'auth/missing-phone-number': 'Enter your phone number.',
  'auth/invalid-verification-code': 'That code is not right. Check the SMS and try again.',
  'auth/code-expired': 'That code has expired. Send a new one.',
  'auth/captcha-check-failed': 'The reCAPTCHA check failed. Reload and try again.',
  'auth/quota-exceeded': 'SMS limit reached for now. Try another sign-in method.',
  'auth/requires-recent-login': 'Sign in again to do that.',
};

/** Reader-facing copy for any error thrown by the auth functions above. */
export function describeAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (code) return `Sign-in failed (${code.replace('auth/', '').replace(/-/g, ' ')}).`;
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Try again.';
}

/** Which sign-in method a user is using, for the profile menu. */
export function providerLabel(user: Pick<User, 'providerData'>): string {
  const ids = user.providerData.map(p => p.providerId);
  if (ids.includes('google.com')) return 'Google';
  if (ids.includes('phone')) return 'Phone';
  if (ids.includes('password')) return 'Email';
  return 'Signed in';
}
