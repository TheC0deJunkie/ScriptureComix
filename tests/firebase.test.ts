import { describe, it, expect, vi } from 'vitest';
import { normalizePhoneNumber, describeAuthError, providerLabel } from '../services/authService';
import { mergeStats } from '../services/userStore';
import { UserTier, type UserStats } from '../types';

const baseStats: UserStats = {
  streak: 0,
  lastVisit: '',
  xp: 0,
  chaptersRead: 0,
  bookmarks: [],
  tier: UserTier.FREE,
  dailyAiUsage: 0,
  lastAiUsageDate: '',
};

// The auth service is exercised in its "no Firebase config" mode, regardless of
// whether a real .env.local is present on this machine.
vi.mock('../services/firebase', () => ({
  isFirebaseConfigured: false,
  getFirebaseAuth: () => { throw new Error('Firebase is not configured.'); },
  getDb: () => { throw new Error('Firebase is not configured.'); },
}));

describe('firebase bootstrap', () => {
  it('treats missing VITE_FIREBASE_* keys as unconfigured', async () => {
    const { readFirebaseConfig } = await vi.importActual<typeof import('../services/firebase')>('../services/firebase');
    expect(readFirebaseConfig({}).configured).toBe(false);
    expect(readFirebaseConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' }).configured).toBe(false);
    const full = readFirebaseConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'a', VITE_FIREBASE_MEASUREMENT_ID: '' });
    expect(full.configured).toBe(true);
    expect(full.config.measurementId).toBeUndefined();
  });

  it('reports a signed-out reader immediately when unconfigured', async () => {
    const { subscribeToAuth, currentUser } = await import('../services/authService');
    const seen: unknown[] = [];
    const unsubscribe = subscribeToAuth(u => seen.push(u));
    expect(seen).toEqual([null]);
    expect(currentUser()).toBeNull();
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe('normalizePhoneNumber', () => {
  it('strips spaces, dashes and brackets but keeps the country code', () => {
    expect(normalizePhoneNumber('+27 (82) 123-4567')).toBe('+27821234567');
    expect(normalizePhoneNumber('  +1 650 555 0100 ')).toBe('+16505550100');
  });

  it('rejects numbers without a leading + or with an impossible length', () => {
    expect(normalizePhoneNumber('0821234567')).toBeNull();
    expect(normalizePhoneNumber('+123')).toBeNull();
    expect(normalizePhoneNumber('+1234567890123456')).toBeNull();
  });
});

describe('describeAuthError', () => {
  it('maps known Firebase codes to reader-friendly copy', () => {
    expect(describeAuthError({ code: 'auth/wrong-password' })).toBe('No account matches those details.');
    expect(describeAuthError({ code: 'auth/invalid-verification-code' })).toMatch(/code is not right/);
  });

  it('falls back sensibly for unknown codes and plain errors', () => {
    expect(describeAuthError({ code: 'auth/something-new' })).toBe('Sign-in failed (something new).');
    expect(describeAuthError(new Error('boom'))).toBe('boom');
    expect(describeAuthError(undefined)).toBe('Something went wrong. Try again.');
  });
});

describe('providerLabel', () => {
  it('prefers Google, then phone, then email', () => {
    const p = (...ids: string[]) => ({ providerData: ids.map(providerId => ({ providerId })) as any });
    expect(providerLabel(p('password', 'google.com'))).toBe('Google');
    expect(providerLabel(p('phone'))).toBe('Phone');
    expect(providerLabel(p('password'))).toBe('Email');
    expect(providerLabel(p())).toBe('Signed in');
  });
});

describe('mergeStats', () => {
  it('returns local data untouched when the cloud has nothing yet', () => {
    const local = { ...baseStats, xp: 40, bookmarks: ['Genesis 1'] };
    expect(mergeStats(local, null)).toBe(local);
  });

  it('never lets progress go backwards and unions bookmarks', () => {
    const local: UserStats = { ...baseStats, streak: 3, xp: 40, chaptersRead: 5, bookmarks: ['Genesis 1', 'John 3'], lastVisit: '2026-09-10T00:00:00.000Z', dailyAiUsage: 2, lastAiUsageDate: '2026-09-10' };
    const cloud: UserStats = { ...baseStats, streak: 7, xp: 25, chaptersRead: 9, bookmarks: ['John 3', 'Psalms 23'], lastVisit: '2026-09-15T00:00:00.000Z', tier: UserTier.EXPLORER, dailyAiUsage: 5, lastAiUsageDate: '2026-09-15' };
    const merged = mergeStats(local, cloud);
    expect(merged.streak).toBe(7);
    expect(merged.xp).toBe(40);
    expect(merged.chaptersRead).toBe(9);
    expect(merged.bookmarks.sort()).toEqual(['Genesis 1', 'John 3', 'Psalms 23']);
    expect(merged.tier).toBe(UserTier.EXPLORER);
    // The more recent visit decides the date-bound fields
    expect(merged.lastVisit).toBe(cloud.lastVisit);
    expect(merged.dailyAiUsage).toBe(5);
  });

  it('keeps a higher local tier over a lower cloud tier', () => {
    const local: UserStats = { ...baseStats, tier: UserTier.SCHOLAR };
    const cloud: UserStats = { ...baseStats, tier: UserTier.FREE };
    expect(mergeStats(local, cloud).tier).toBe(UserTier.SCHOLAR);
  });
});
