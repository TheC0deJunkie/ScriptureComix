/**
 * textLibrary — the single entry point the UI uses to read scripture.
 *
 *   loadChapter()  →  manifest (cached)  →  scriptureStore (memory/IndexedDB/network)
 *                  →  verseRepair (borrow / AI-reconstruct missing verses, stored forever)
 *
 * Nothing in the UI fetches JSON directly; every read goes through the
 * permanent store so a book is downloaded at most once per device.
 */
import { BibleVersion, ChapterVerse, ChapterTextResult, TextCatalogEntry } from '../types';
import { Tradition, CanonManifest, ManifestBook } from './types';
import { loadManifest, findBookSlug } from './manifestService';
import { getBook, prefetchBooks, VerseSource } from './scriptureStore';
import { repairChapter, chapterNeedsRepair } from './verseRepair';

// Legacy shape — still referenced by App.tsx discovery UI (dead path, returns nothing)
export interface ScriptureEntry {
  id: string;
  displayName: string;
  group: string;
  path: string;
  loader?: () => Promise<any>;
  data?: any;
  books?: string[];
}

export const DEFAULT_TRANSLATION: Record<Tradition, string> = {
  protestant: 'nlt',
  catholic: 'drb',
  ethiopian: 'kjv',
  quran: 'yusuf-ali',
};

// Load a single book's verse map through the permanent store
export async function loadBookFile(
  tradition: string,
  translation: string,
  slug: string
): Promise<Record<string, string>> {
  return (await getBook(tradition, translation, slug)).verses;
}

// Extract a chapter's verses from a flat verse map, tagging each verse's source
export function extractChapter(
  bookData: Record<string, string>,
  chapter: number,
  isQuran: boolean = false,
  provenance: Record<string, VerseSource> = {}
): ChapterVerse[] {
  if (isQuran) {
    // Quran files have no chapter prefix — keys are just "1", "2", etc.
    return Object.entries(bookData)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([key, text]) => ({ verse: Number(key), text, source: provenance[key] ?? 'bundled' }));
  }
  const prefix = `${chapter}:`;
  return Object.entries(bookData)
    .filter(([key]) => key.startsWith(prefix))
    .sort((a, b) => Number(a[0].split(':')[1]) - Number(b[0].split(':')[1]))
    .map(([key, text]) => ({ verse: Number(key.split(':')[1]), text, source: provenance[key] ?? 'bundled' }));
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Find a book by slug, display name, or a loose spelling of either. */
export function resolveBook(manifest: CanonManifest, slugOrName: string): ManifestBook | undefined {
  if (!slugOrName) return undefined;
  const bySlug = manifest.books.find(b => b.slug === slugOrName);
  if (bySlug) return bySlug;
  const byNameSlug = findBookSlug(manifest, slugOrName);
  if (byNameSlug) return manifest.books.find(b => b.slug === byNameSlug);
  const target = normalise(slugOrName);
  return manifest.books.find(b => normalise(b.displayName) === target || normalise(b.slug) === target);
}

export interface LoadChapterOptions {
  /** Override the runtime AI rule for gap repair. Default: dev on, production off. */
  allowAI?: boolean;
  /**
   * 'await'      — return only once gaps are repaired (default; used for comics)
   * 'background' — return stored text immediately; if gaps exist, `pending`
   *                resolves to the repaired chapter (used by the reader so
   *                reading is never slowed by generation)
   * 'none'       — never repair
   */
  repair?: 'await' | 'background' | 'none';
}

/**
 * Main entry point. Returns a complete chapter (repairing gaps if needed) or
 * null when the book/chapter does not exist in this tradition.
 */
export async function loadChapter(
  tradition: Tradition,
  translationId: string | null | undefined,
  bookSlugOrName: string,
  chapter: number,
  opts: LoadChapterOptions = {}
): Promise<ChapterTextResult | null> {
  const manifest = await loadManifest(tradition);
  const book = resolveBook(manifest, bookSlugOrName);
  if (!book) return null;

  const isQuran = tradition === 'quran';
  const translation =
    translationId && manifest.translations.some(t => t.id === translationId)
      ? translationId
      : manifest.translations[0]?.id ?? DEFAULT_TRANSLATION[tradition];

  const effectiveChapter = isQuran ? 1 : chapter;
  if (!isQuran && (chapter < 1 || chapter > book.chapters.length)) return null;

  const meta = manifest.translations.find(t => t.id === translation);
  const entry: TextCatalogEntry = {
    id: `${translation}-${tradition}`,
    displayName: meta?.displayName || translation,
    language: 'English',
    license: meta?.copyright || 'Public Domain',
    status: 'local',
    versions: [translation],
    books: ['*'],
  };
  const build = (
    verses: ChapterVerse[],
    provenance: { borrowed: number[]; reconstructed: number[]; unresolved: number[] }
  ): ChapterTextResult => ({
    entry,
    verses,
    tradition,
    translationId: translation,
    bookSlug: book.slug,
    bookDisplayName: book.displayName,
    chapter: effectiveChapter,
    provenance,
  });
  const repairOpts = { tradition, translationId: translation, manifest, book, chapter: effectiveChapter, allowAI: opts.allowAI };
  const fromRepair = async (): Promise<ChapterTextResult | null> => {
    const repaired = await repairChapter(repairOpts);
    const verses = extractChapter(repaired.verses, effectiveChapter, isQuran, repaired.provenance);
    if (!verses.length) return null;
    return build(verses, { borrowed: repaired.borrowed, reconstructed: repaired.reconstructed, unresolved: repaired.unresolved });
  };

  const mode = opts.repair ?? 'await';
  if (mode === 'await') return fromRepair();

  // Fast path: what is on the device, right now. Repair (if any) runs behind it.
  const stored = await getBook(tradition, translation, book.slug);
  const verses = extractChapter(stored.verses, effectiveChapter, isQuran, stored.provenance).filter(
    v => !/^\s*\[text pending/i.test(v.text)
  );
  const summary = { borrowed: [] as number[], reconstructed: [] as number[], unresolved: [] as number[] };
  for (const v of verses) {
    if (v.source === 'borrowed') summary.borrowed.push(v.verse);
    else if (v.source === 'reconstructed') summary.reconstructed.push(v.verse);
  }
  const immediate = build(verses, summary);
  const needs = mode === 'background' && chapterNeedsRepair(stored, book, effectiveChapter, isQuran);
  if (needs) immediate.pending = fromRepair().catch(() => null);
  if (!verses.length && !needs) return null;
  return immediate;
}

/** Warm the store with the books either side of the current one. Best effort. */
export async function prefetchNeighbours(
  tradition: Tradition,
  translationId: string,
  bookSlug: string
): Promise<void> {
  try {
    const manifest = await loadManifest(tradition);
    const idx = manifest.books.findIndex(b => b.slug === bookSlug);
    if (idx < 0) return;
    const slugs = [manifest.books[idx + 1]?.slug, manifest.books[idx - 1]?.slug].filter(Boolean) as string[];
    await prefetchBooks(tradition, translationId, slugs);
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Legacy API — BibleVersion-based loading, routed through loadChapter
// ---------------------------------------------------------------------------
const VERSION_TO_TRADITION: Record<string, { tradition: Tradition; translationId: string }> = {
  [BibleVersion.KJV]: { tradition: 'protestant', translationId: 'kjv' },
  [BibleVersion.GENEVA]: { tradition: 'protestant', translationId: 'gnv' },
};

export const loadChapterText = async (
  version: BibleVersion,
  book: string,
  chapter: number
): Promise<ChapterTextResult | null> => {
  const mapping = VERSION_TO_TRADITION[version];
  if (!mapping) return null;
  try {
    return await loadChapter(mapping.tradition, mapping.translationId, book, chapter);
  } catch (err) {
    console.warn(`Failed to load ${book} ch${chapter} (${version}):`, err);
    return null;
  }
};

export async function loadChapterByTradition(
  tradition: Tradition,
  translationId: string,
  bookSlug: string,
  chapter: number
): Promise<ChapterVerse[]> {
  const result = await loadChapter(tradition, translationId, bookSlug, chapter);
  return result?.verses ?? [];
}

// ---------------------------------------------------------------------------
// Deprecated stubs — App.tsx still imports these for a dead discovery path.
// ---------------------------------------------------------------------------

/** @deprecated Use loadManifest + loadChapter instead */
export const loadTextCatalog = async (): Promise<any[]> => [];

/** @deprecated Scripture discovery is replaced by manifest-based navigation */
export const discoverScriptures = async (): Promise<ScriptureEntry[]> => [];

/** @deprecated Use loadChapter instead */
export const loadScriptureData = async (_entry: ScriptureEntry): Promise<any> => null;

/** @deprecated Use extractChapter instead */
export const extractVersesFromScripture = (
  _data: any,
  _book: string,
  _chapter: number
): ChapterVerse[] | null => null;
