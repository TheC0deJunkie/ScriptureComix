/**
 * Firebase Admin for the Vercel functions. Server-only.
 *
 * Credentials come from FIREBASE_SERVICE_ACCOUNT: the service-account JSON
 * from Firebase console → Project settings → Service accounts, either raw or
 * base64-encoded (base64 survives env-var editors that mangle newlines).
 */
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

export { FieldValue, Timestamp };

export const adminReady = (): boolean => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT?.trim());

function serviceAccount(): Record<string, string> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, string>;
}

let app: App | null = null;
export function admin(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) return (app = existing);
  const sa = serviceAccount();
  app = initializeApp({ credential: cert(sa as never), projectId: sa.project_id });
  return app;
}

export const db = () => getFirestore(admin());

export interface Caller { uid: string; email?: string; name?: string }

/** The signed-in reader behind a request, from its Firebase ID token. Null when absent or invalid. */
export async function callerOf(req: Request): Promise<Caller | null> {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const t = await getAuth(admin()).verifyIdToken(m[1]);
    return { uid: t.uid, email: t.email, name: typeof t.name === 'string' ? t.name : undefined };
  } catch {
    return null;
  }
}
