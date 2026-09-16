/**
 * entitlementStore — what a reader has paid for, read live from Firestore.
 * Only the payment webhook (Admin SDK) writes these documents; the browser
 * can only listen.
 */
import { doc, onSnapshot } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from './firebase';

export interface Entitlement {
  /** ISO date until which the reader is a Supporter, or null. */
  supporterUntil: string | null;
  lifetimeCents: number;
  purchases: number;
  sponsoredChapters: string[];
}

export interface SponsorEntry { name: string; message?: string; paidAt?: string }
export interface Sponsorship { names: string[]; entries: SponsorEntry[]; count: number }

export const isSupporter = (e: Entitlement | null | undefined): boolean =>
  Boolean(e?.supporterUntil) && Date.parse(e!.supporterUntil!) > Date.now();

const noop = () => {};

export function subscribeEntitlement(uid: string, cb: (e: Entitlement | null) => void): () => void {
  if (!isFirebaseConfigured) { cb(null); return noop; }
  return onSnapshot(
    doc(getDb(), 'entitlements', uid),
    (snap) => {
      if (!snap.exists()) { cb(null); return; }
      const d = snap.data();
      cb({
        supporterUntil: typeof d.supporterUntil === 'string' ? d.supporterUntil : null,
        lifetimeCents: Number(d.lifetimeCents ?? 0),
        purchases: Number(d.purchases ?? 0),
        sponsoredChapters: Array.isArray(d.sponsoredChapters) ? d.sponsoredChapters : [],
      });
    },
    (err) => { console.warn('[entitlements] listen failed', err); cb(null); },
  );
}

export function subscribeSponsorship(key: string, cb: (s: Sponsorship | null) => void): () => void {
  if (!isFirebaseConfigured) { cb(null); return noop; }
  return onSnapshot(
    doc(getDb(), 'sponsorships', key),
    (snap) => {
      if (!snap.exists()) { cb(null); return; }
      const d = snap.data();
      cb({
        names: Array.isArray(d.names) ? d.names : [],
        entries: Array.isArray(d.entries) ? d.entries : [],
        count: Number(d.count ?? 0),
      });
    },
    () => cb(null),
  );
}
