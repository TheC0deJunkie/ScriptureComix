/**
 * Firestore-backed per-reader data. Layout (owner-only, see firestore.rules):
 *
 *   users/{uid}                 - account + reader profile (name, tradition, level)
 *   users/{uid}/state/stats     - streak, xp, chapters read, bookmarks, tier
 *
 * The app keeps working from localStorage; this store mirrors that data to the
 * cloud when a reader is signed in so it follows them across devices.
 */
import { doc, getDoc, setDoc, serverTimestamp, type DocumentData } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getDb } from './firebase';
import { UserTier, type ReaderProfile, type UserStats } from '../types';

export const USERS_COLLECTION = 'users';

const userRef = (uid: string) => doc(getDb(), USERS_COLLECTION, uid);
const statsRef = (uid: string) => doc(getDb(), USERS_COLLECTION, uid, 'state', 'stats');

export interface CloudUserData {
  profile: Partial<ReaderProfile> | null;
  stats: UserStats | null;
}

/** Creates or refreshes the account document on every sign-in. */
export async function ensureUserDocument(user: User): Promise<void> {
  const snap = await getDoc(userRef(user.uid));
  const base: DocumentData = {
    email: user.email ?? null,
    phoneNumber: user.phoneNumber ?? null,
    photoURL: user.photoURL ?? null,
    providers: user.providerData.map(p => p.providerId),
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!snap.exists()) {
    base.createdAt = serverTimestamp();
    if (user.displayName) base.displayName = user.displayName;
  }
  await setDoc(userRef(user.uid), base, { merge: true });
}

export async function loadUserData(uid: string): Promise<CloudUserData> {
  const [profileSnap, statsSnap] = await Promise.all([getDoc(userRef(uid)), getDoc(statsRef(uid))]);
  const p = profileSnap.exists() ? profileSnap.data() : null;
  const profile: Partial<ReaderProfile> | null = p
    ? {
        displayName: typeof p.displayName === 'string' ? p.displayName : undefined,
        faithTradition: p.faithTradition,
        exploreLevel: p.exploreLevel,
      }
    : null;
  const stats = statsSnap.exists() ? (statsSnap.data() as UserStats) : null;
  return { profile, stats };
}

export async function saveUserProfile(uid: string, profile: ReaderProfile): Promise<void> {
  await setDoc(
    userRef(uid),
    {
      displayName: profile.displayName,
      faithTradition: profile.faithTradition,
      exploreLevel: profile.exploreLevel,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveUserStats(uid: string, stats: UserStats): Promise<void> {
  await setDoc(statsRef(uid), { ...stats, updatedAt: serverTimestamp() }, { merge: true });
}

const TIER_RANK: Record<string, number> = {
  [UserTier.FREE]: 0,
  [UserTier.EXPLORER]: 1,
  [UserTier.SCHOLAR]: 2,
};

/**
 * Combines what this device knows with what the cloud knows. Progress never
 * goes backwards: the higher streak/xp/chapter count wins, bookmarks are the
 * union, the higher tier wins, and the most recent visit sets the date fields.
 */
export function mergeStats(local: UserStats, cloud: UserStats | null): UserStats {
  if (!cloud) return local;
  const newer = (cloud.lastVisit || '') > (local.lastVisit || '') ? cloud : local;
  const localTier = local.tier ?? UserTier.FREE;
  const cloudTier = cloud.tier ?? UserTier.FREE;
  return {
    streak: Math.max(local.streak ?? 0, cloud.streak ?? 0),
    lastVisit: newer.lastVisit ?? '',
    xp: Math.max(local.xp ?? 0, cloud.xp ?? 0),
    chaptersRead: Math.max(local.chaptersRead ?? 0, cloud.chaptersRead ?? 0),
    bookmarks: Array.from(new Set([...(local.bookmarks ?? []), ...(cloud.bookmarks ?? [])])),
    tier: (TIER_RANK[cloudTier] ?? 0) >= (TIER_RANK[localTier] ?? 0) ? cloudTier : localTier,
    dailyAiUsage: newer.dailyAiUsage ?? 0,
    lastAiUsageDate: newer.lastAiUsageDate ?? '',
  };
}
