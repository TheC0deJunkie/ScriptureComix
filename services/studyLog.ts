/**
 * studyLog — where the reader is, and everything they have marked, in one
 * place. Lets the app reopen where you left off and lets you carry your
 * study (highlights, notes, bookmarks, circles, journeys) to another device
 * as a single file. Everything lives in localStorage; nothing leaves the
 * device unless you export it.
 */
import { listAllHighlights, listAllVerseNotes, HighlightColor, Visibility } from './highlights';
import { firstVerseOfKey } from './refs';

export interface LastRead {
  tradition: string;
  bookSlug: string | null;
  bookName: string;
  chapter: number;
  translationId: string | null;
  at: string;
}

const LAST_READ_KEY = 'scriptureComix_lastRead_v1';

/** Every key this app writes; the export/import pair moves exactly these. */
export const STUDY_KEYS = [
  'scriptureComix_stats',
  'scriptureComix_notes',
  'scriptureComix_journeys',
  'scriptureComix_activeJourney',
  'scriptureComix_groups',
  'scriptureComix_customHeroes',
  'scriptureComix_activeHeroes',
  'scriptureComix_offlinePacks',
  'scriptureComix_readerProfile',
  'scriptureComix_readerMode',
  'scriptureComix_highlights_v1',
  'scriptureComix_verseNotes_v1',
  'scriptureComix_readerPrefs_v1',
  'scriptureComix_companion_v1',
  'scriptureComix_seen_v1',
  LAST_READ_KEY,
] as const;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function getLastRead(): LastRead | null {
  const v = read<LastRead | null>(LAST_READ_KEY, null);
  return v && v.bookName && v.chapter ? v : null;
}

export function setLastRead(v: Omit<LastRead, 'at'>): void {
  try {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify({ ...v, at: new Date().toISOString() }));
  } catch { /* ignore */ }
}

/**
 * "tradition/slug/chapter" (marks are owned by the verse) or the older
 * "tradition/translation/slug/chapter" → its parts. `translation` is only set
 * for the older shape.
 */
export function parseChapterKey(key: string): { tradition: string; translation?: string; slug: string; chapter: number } | null {
  const parts = key.split('/');
  if (parts.length < 3) return null;
  const chapter = Number(parts[parts.length - 1]);
  if (!Number.isFinite(chapter)) return null;
  if (parts.length === 3) return { tradition: parts[0], slug: parts[1], chapter };
  return { tradition: parts[0], translation: parts[1], slug: parts.slice(2, -1).join('/'), chapter };
}

/** "1-samuel" → "1 Samuel", "song-of-solomon" → "Song of Solomon". */
export function slugToName(slug: string): string {
  const small = new Set(['of', 'the', 'and']);
  return slug
    .split('-')
    .map((w, i) => (small.has(w) && i > 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export interface StudiedChapter {
  key: string;
  tradition: string;
  /** Only present for marks saved before marks were owned by the verse. */
  translation?: string;
  slug: string;
  bookName: string;
  chapter: number;
  highlights: { verse: number; color: HighlightColor; visibility: Visibility }[];
  /** `verse` is the first verse the note covers; `ref` is the full key ("4" or "1-10"). */
  notes: { verse: number; ref: string; text: string; visibility: Visibility }[];
}

/** Every chapter with at least one highlight or verse note, most-marked first. */
export function listStudiedChapters(): StudiedChapter[] {
  const map = new Map<string, StudiedChapter>();
  const ensure = (key: string) => {
    let c = map.get(key);
    if (!c) {
      const p = parseChapterKey(key);
      if (!p) return null;
      c = { key, ...p, bookName: slugToName(p.slug), highlights: [], notes: [] };
      map.set(key, c);
    }
    return c;
  };
  for (const h of listAllHighlights()) ensure(h.chapterKey)?.highlights.push({ verse: h.verse, color: h.color, visibility: h.visibility });
  for (const n of listAllVerseNotes()) {
    const first = Number.isFinite(n.verse) ? n.verse : firstVerseOfKey(n.ref);
    if (!Number.isFinite(first)) continue;
    ensure(n.chapterKey)?.notes.push({ verse: first, ref: n.ref, text: n.text, visibility: n.visibility });
  }
  for (const c of map.values()) {
    c.highlights.sort((a, b) => a.verse - b.verse);
    c.notes.sort((a, b) => a.verse - b.verse);
  }
  return Array.from(map.values()).sort((a, b) => (b.highlights.length + b.notes.length) - (a.highlights.length + a.notes.length));
}

export interface StudyExport {
  app: 'ScriptureComix';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function exportStudy(): StudyExport {
  const data: Record<string, unknown> = {};
  for (const k of STUDY_KEYS) {
    const raw = localStorage.getItem(k);
    if (raw !== null) {
      try { data[k] = JSON.parse(raw); } catch { data[k] = raw; }
    }
  }
  return { app: 'ScriptureComix', version: 1, exportedAt: new Date().toISOString(), data };
}

/** Merge a study file into this device. Returns how many keys were written; throws on a bad file. */
export function importStudy(json: unknown): number {
  const file = json as Partial<StudyExport>;
  if (!file || file.app !== 'ScriptureComix' || typeof file.data !== 'object' || !file.data) {
    throw new Error('Not a ScriptureComix study file');
  }
  let written = 0;
  for (const k of STUDY_KEYS) {
    if (!(k in file.data)) continue;
    const value = (file.data as Record<string, unknown>)[k];
    localStorage.setItem(k, typeof value === 'string' ? value : JSON.stringify(value));
    written++;
  }
  return written;
}

/** Saves plain text (Markdown, CSV…) as a file download. */
export function downloadText(filename: string, text: string, mime = 'text/markdown'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
