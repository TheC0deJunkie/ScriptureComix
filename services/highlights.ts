/**
 * highlights — per-verse highlights and notes, kept on this device.
 *
 * Keyed by chapter ("tradition/slug/chapter") then verse key ("4" or "1-10").
 * A mark belongs to the verse, not to a translation: a highlight on Genesis
 * 1:1 shows whether you are reading it in the KJV, the WEB, or with a second
 * language underneath. Older stores keyed marks by translation as well
 * ("tradition/translation/slug/chapter"); those keys are folded together on
 * read, and everything is written back in the new shape.
 *
 * Every mark carries `visibility` — 'private' by default. Nothing leaves the
 * device unless a person shares one mark on purpose; 'circle' marks are what a
 * future sync will send to the circle, with the author's name attached.
 */
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; className: string }[] = [
  { id: 'yellow', label: 'Yellow', className: 'bg-yellow-200' },
  { id: 'green', label: 'Green', className: 'bg-green-200' },
  { id: 'blue', label: 'Blue', className: 'bg-sky-200' },
  { id: 'pink', label: 'Pink', className: 'bg-pink-200' },
  { id: 'orange', label: 'Orange', className: 'bg-orange-200' },
];

/** Who may see a mark. Private marks never leave the device (or, later, the owner's account). */
export type Visibility = 'private' | 'circle';

export interface MarkMeta {
  visibility: Visibility;
  /** Display name of the person who made it (absent for marks made before names were recorded). */
  author?: string;
  /** ISO time of the last edit. */
  at?: string;
}

export interface HighlightMark extends MarkMeta { color: HighlightColor }
export interface NoteMark extends MarkMeta { text: string }

export interface ReaderPrefs {
  fontScale: number; // 0.85 .. 1.6
  serif: boolean;
}

const HIGHLIGHT_KEY = 'scriptureComix_highlights_v1';
const NOTES_KEY = 'scriptureComix_verseNotes_v1';
const PREFS_KEY = 'scriptureComix_readerPrefs_v1';

type HighlightStore = Record<string, Record<string, HighlightMark>>;
type NoteStore = Record<string, Record<string, NoteMark>>;

const read = <T,>(key: string, fallback: T): T => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — ignore */
  }
};

/** "tradition/slug/chapter" — the key every mark is filed under. */
export const markChapterKey = (tradition: string, slug: string, chapter: number): string => `${tradition}/${slug}/${chapter}`;

/**
 * Accepts either key shape and returns the verse-owned one. A four-part key
 * ("protestant/kjv/genesis/1") drops its translation segment.
 */
export function normaliseChapterKey(key: string): string {
  const parts = key.split('/');
  if (parts.length >= 4) return [parts[0], ...parts.slice(2)].join('/');
  return key;
}

const isColor = (v: unknown): v is HighlightColor => HIGHLIGHT_COLORS.some(c => c.id === v);
const isVisibility = (v: unknown): v is Visibility => v === 'private' || v === 'circle';

const asHighlight = (v: unknown): HighlightMark | null => {
  if (isColor(v)) return { color: v, visibility: 'private' };
  if (v && typeof v === 'object' && isColor((v as HighlightMark).color)) {
    const m = v as Partial<HighlightMark>;
    return { color: m.color!, visibility: isVisibility(m.visibility) ? m.visibility : 'private', ...(m.author ? { author: m.author } : {}), ...(m.at ? { at: m.at } : {}) };
  }
  return null;
};

const asNote = (v: unknown): NoteMark | null => {
  if (typeof v === 'string') return v.trim() ? { text: v, visibility: 'private' } : null;
  if (v && typeof v === 'object' && typeof (v as NoteMark).text === 'string') {
    const m = v as Partial<NoteMark>;
    if (!m.text!.trim()) return null;
    return { text: m.text!, visibility: isVisibility(m.visibility) ? m.visibility : 'private', ...(m.author ? { author: m.author } : {}), ...(m.at ? { at: m.at } : {}) };
  }
  return null;
};

/** Read a store, upgrading legacy values (bare colours / strings, translation-keyed chapters) as it goes. */
function readStore<M>(key: string, coerce: (v: unknown) => M | null): Record<string, Record<string, M>> {
  const raw = read<Record<string, Record<string, unknown>>>(key, {});
  const out: Record<string, Record<string, M>> = {};
  for (const [chapterKey, marks] of Object.entries(raw)) {
    if (!marks || typeof marks !== 'object') continue;
    const target = normaliseChapterKey(chapterKey);
    const chapter = (out[target] ||= {});
    for (const [verseKey, value] of Object.entries(marks)) {
      const mark = coerce(value);
      if (mark && !(verseKey in chapter)) chapter[verseKey] = mark; // first translation wins when two stores collide
    }
    if (!Object.keys(chapter).length) delete out[target];
  }
  return out;
}

const readHighlights = () => readStore<HighlightMark>(HIGHLIGHT_KEY, asHighlight);
const readNotes = () => readStore<NoteMark>(NOTES_KEY, asNote);

const stamp = <M extends MarkMeta>(prev: M | undefined, next: Omit<M, keyof MarkMeta>, meta?: Partial<MarkMeta>): M => ({
  ...(next as M),
  visibility: meta?.visibility ?? prev?.visibility ?? 'private',
  ...((meta?.author ?? prev?.author) ? { author: meta?.author ?? prev?.author } : {}),
  at: new Date().toISOString(),
});

const toColors = (marks: Record<string, HighlightMark>): Record<string, HighlightColor> =>
  Object.fromEntries(Object.entries(marks).map(([k, m]) => [k, m.color]));
const toTexts = (marks: Record<string, NoteMark>): Record<string, string> =>
  Object.fromEntries(Object.entries(marks).map(([k, m]) => [k, m.text]));

/* ---------------------------------------------------------------- */
/* Highlights                                                        */
/* ---------------------------------------------------------------- */

export function getHighlightMarks(chapterKey: string): Record<string, HighlightMark> {
  return readHighlights()[normaliseChapterKey(chapterKey)] || {};
}

/** Verse → colour, for rendering. */
export function getHighlights(chapterKey: string): Record<string, HighlightColor> {
  return toColors(getHighlightMarks(chapterKey));
}

/** Set (or clear, with null) one verse's highlight. Keeps its visibility unless `meta` says otherwise. */
export function setHighlight(chapterKey: string, verse: number, color: HighlightColor | null, meta?: Partial<MarkMeta>): Record<string, HighlightColor> {
  const store = readHighlights();
  const key = normaliseChapterKey(chapterKey);
  const chapter = { ...(store[key] || {}) };
  const vk = String(verse);
  if (color) chapter[vk] = stamp<HighlightMark>(chapter[vk], { color }, meta);
  else delete chapter[vk];
  if (Object.keys(chapter).length) store[key] = chapter;
  else delete store[key];
  write(HIGHLIGHT_KEY, store);
  return toColors(chapter);
}

/* ---------------------------------------------------------------- */
/* Notes                                                             */
/* ---------------------------------------------------------------- */

export function getNoteMarks(chapterKey: string): Record<string, NoteMark> {
  return readNotes()[normaliseChapterKey(chapterKey)] || {};
}

/** Note key ("4" or "1-10") → text, for rendering. */
export function getVerseNotes(chapterKey: string): Record<string, string> {
  return toTexts(getNoteMarks(chapterKey));
}

/** Notes may cover a range: the key is a range spec ("1-10") rather than one verse. Empty text deletes. */
export function setRangeNote(chapterKey: string, rangeKey: string, text: string, meta?: Partial<MarkMeta>): Record<string, string> {
  const store = readNotes();
  const key = normaliseChapterKey(chapterKey);
  const chapter = { ...(store[key] || {}) };
  if (text.trim()) chapter[rangeKey] = stamp<NoteMark>(chapter[rangeKey], { text }, meta);
  else delete chapter[rangeKey];
  if (Object.keys(chapter).length) store[key] = chapter;
  else delete store[key];
  write(NOTES_KEY, store);
  return toTexts(chapter);
}

export function setVerseNote(chapterKey: string, verse: number, text: string, meta?: Partial<MarkMeta>): Record<string, string> {
  return setRangeNote(chapterKey, String(verse), text, meta);
}

/* ---------------------------------------------------------------- */
/* Visibility — the deliberate act of sharing one mark               */
/* ---------------------------------------------------------------- */

/** Flip one highlight or note between private and circle. Returns false if there is no such mark. */
export function setMarkVisibility(chapterKey: string, kind: 'highlight' | 'note', markKey: string, visibility: Visibility): boolean {
  const key = normaliseChapterKey(chapterKey);
  if (kind === 'highlight') {
    const store = readHighlights();
    const mark = store[key]?.[markKey];
    if (!mark) return false;
    store[key][markKey] = { ...mark, visibility, at: new Date().toISOString() };
    write(HIGHLIGHT_KEY, store);
    return true;
  }
  const store = readNotes();
  const mark = store[key]?.[markKey];
  if (!mark) return false;
  store[key][markKey] = { ...mark, visibility, at: new Date().toISOString() };
  write(NOTES_KEY, store);
  return true;
}

/* ---------------------------------------------------------------- */
/* Everything on this device                                         */
/* ---------------------------------------------------------------- */

export interface HighlightRow extends HighlightMark { chapterKey: string; verse: number }
export interface NoteRow extends NoteMark { chapterKey: string; verse: number; ref: string }

/** Every highlighted verse on this device. */
export function listAllHighlights(): HighlightRow[] {
  const out: HighlightRow[] = [];
  for (const [chapterKey, verses] of Object.entries(readHighlights())) {
    for (const [v, mark] of Object.entries(verses)) out.push({ chapterKey, verse: Number(v), ...mark });
  }
  return out;
}

/** Every verse note on this device. `ref` is the stored key: "4" for one verse, "1-10" for a range. */
export function listAllVerseNotes(): NoteRow[] {
  const out: NoteRow[] = [];
  for (const [chapterKey, verses] of Object.entries(readNotes())) {
    for (const [v, mark] of Object.entries(verses)) out.push({ chapterKey, verse: Number(v), ref: v, ...mark });
  }
  return out;
}

/**
 * Rewrite both stores in the current shape (verse-owned keys, mark objects).
 * Reads already upgrade on the fly; this makes the upgrade permanent so an
 * exported study file carries the new shape. Safe to call on every start.
 */
export function migrateMarkStores(): void {
  const h = readHighlights();
  const n = readNotes();
  if (Object.keys(h).length) write(HIGHLIGHT_KEY, h);
  if (Object.keys(n).length) write(NOTES_KEY, n);
}

/* ---------------------------------------------------------------- */
/* Reader preferences                                                */
/* ---------------------------------------------------------------- */

export function getReaderPrefs(): ReaderPrefs {
  const p = read<Partial<ReaderPrefs>>(PREFS_KEY, {});
  return { fontScale: typeof p.fontScale === 'number' ? p.fontScale : 1, serif: p.serif !== false };
}

export function setReaderPrefs(prefs: ReaderPrefs): void {
  write(PREFS_KEY, prefs);
}

/* ---------------------------------------------------------------- */
/* First-run hints — shown once, then never again                     */
/* ---------------------------------------------------------------- */

const SEEN_KEY = 'scriptureComix_seen_v1';
export type SeenHint = 'verseTap' | 'companion' | 'circlePill';

export function hasSeen(hint: SeenHint): boolean {
  return !!read<Partial<Record<SeenHint, boolean>>>(SEEN_KEY, {})[hint];
}

export function markSeen(hint: SeenHint): void {
  const seen = read<Partial<Record<SeenHint, boolean>>>(SEEN_KEY, {});
  if (seen[hint]) return;
  write(SEEN_KEY, { ...seen, [hint]: true });
}
