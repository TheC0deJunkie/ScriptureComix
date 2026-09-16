/**
 * circles — study circles without a server (yet).
 *
 * A circle is shared as an invite: a short string that carries the circle's
 * name, focus and the chapter everyone is reading. Paste it (or open the
 * link) on another device and the same circle appears there. Reflections
 * are written on each device; syncing them needs a backend, which is the
 * next step — the UI says so plainly instead of pretending.
 */
import { StudyGroup } from '../types';

const PREFIX = 'SC1.';

interface InvitePayload {
  k: string;          // circle code (id)
  n: string;          // name
  f?: string;         // focus
  t?: string;         // tradition (canon) of the shared chapter
  b?: string;         // target book
  c?: number;         // target chapter
}

const toBase64Url = (s: string) =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return decodeURIComponent(escape(atob(b64)));
};

export function generateCircleCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes).map(b => alphabet[b % alphabet.length]).join('');
}

export function encodeInvite(group: StudyGroup): string {
  const p: InvitePayload = { k: group.code, n: group.name };
  if (group.focus) p.f = group.focus;
  if (group.targetBook && group.targetChapter) { p.b = group.targetBook; p.c = group.targetChapter; }
  if (group.tradition) p.t = group.tradition;
  return PREFIX + toBase64Url(JSON.stringify(p));
}

export function inviteUrl(group: StudyGroup): string {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  return `${base}?circle=${encodeURIComponent(encodeInvite(group))}`;
}

/** Accepts an invite string, a full invite link, or a bare 6-character code from this device. */
export function decodeInvite(input: string): Omit<StudyGroup, 'members' | 'reflections' | 'createdAt' | 'id'> | null {
  let raw = input.trim();
  if (!raw) return null;
  try {
    if (raw.includes('circle=')) {
      const url = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
      raw = url.searchParams.get('circle') || '';
    }
  } catch { /* not a URL — fall through */ }
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const p = JSON.parse(fromBase64Url(raw.slice(PREFIX.length))) as InvitePayload;
    if (!p || typeof p.k !== 'string' || typeof p.n !== 'string' || !p.k || !p.n) return null;
    return {
      code: p.k.toUpperCase(),
      name: p.n,
      focus: p.f || '',
      tradition: typeof p.t === 'string' ? p.t : undefined,
      targetBook: p.b,
      targetChapter: typeof p.c === 'number' ? p.c : undefined,
    };
  } catch {
    return null;
  }
}

/** Read and clear a ?circle= invite from the current URL, if any. */
export function takeInviteFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const invite = url.searchParams.get('circle');
  if (!invite) return null;
  url.searchParams.delete('circle');
  window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);
  return invite;
}

/* ------------------------------------------------------------------ */
/* Members — a stable colour per name, used for avatars now and for     */
/* the outline of a member's shared highlights once marks sync.          */
/* ------------------------------------------------------------------ */

const MEMBER_PALETTE = [
  { bg: 'bg-emerald-400', text: 'text-black', ring: 'ring-emerald-500', hex: '#34d399' },
  { bg: 'bg-sky-400', text: 'text-black', ring: 'ring-sky-500', hex: '#38bdf8' },
  { bg: 'bg-rose-400', text: 'text-black', ring: 'ring-rose-500', hex: '#fb7185' },
  { bg: 'bg-violet-400', text: 'text-black', ring: 'ring-violet-500', hex: '#a78bfa' },
  { bg: 'bg-orange-400', text: 'text-black', ring: 'ring-orange-500', hex: '#fb923c' },
  { bg: 'bg-lime-400', text: 'text-black', ring: 'ring-lime-500', hex: '#a3e635' },
  { bg: 'bg-fuchsia-400', text: 'text-black', ring: 'ring-fuchsia-500', hex: '#e879f9' },
  { bg: 'bg-cyan-400', text: 'text-black', ring: 'ring-cyan-500', hex: '#22d3ee' },
] as const;

export type MemberColor = (typeof MEMBER_PALETTE)[number];

/** The same name always gets the same colour, on every device. */
export function memberColor(name: string): MemberColor {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MEMBER_PALETTE[h % MEMBER_PALETTE.length];
}

/** "Thandi Ngcobo" → "TN", "shaun" → "S". */
export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 1) : parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}
