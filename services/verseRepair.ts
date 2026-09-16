/**
 * verseRepair — fills gaps in a chapter so the reader never sees a hole.
 *
 * When a chapter is missing verses (absent keys, empty strings, or the
 * "[Text pending …]" placeholders left by the data import), we resolve them in
 * order of trust and store the result permanently in the scripture store:
 *
 *   1. borrow   — the same verse from another public-domain translation that
 *                 carries the same book (same tradition first, then others)
 *   2. reconstruct — ask the AI to reproduce the verse text (one request per
 *                 chapter, not per verse). Tagged 'reconstructed' so the UI can
 *                 warn the reader that this text was not sourced from a
 *                 printed edition.
 *
 * A manifest chapter with verse count 0 means "count unknown" (books that
 * were imported as placeholders, e.g. 1 Enoch and Jubilees). For those the
 * whole chapter is borrowed or reconstructed in one go.
 *
 * In development the repaired verses are also written back into
 * public/data/… through the Vite dev middleware so the bundled dataset itself
 * becomes complete and consistent for every future user.
 */

import { CanonManifest, ManifestBook, Tradition } from './types';
import { loadAllManifests } from './manifestService';
import { getBook, patchBook, setLearnedChapterCount, isPlaceholderText, VerseSource } from './scriptureStore';
import { reconstructVerses as aiReconstructVerses } from './geminiService';
import { runtimeAIEnabled } from './runtimeConfig';

export const verseKey = (chapter: number, verse: number, isQuran: boolean) =>
  isQuran ? String(verse) : `${chapter}:${verse}`;

const verseNumberOf = (key: string) => Number(key.split(':').pop());

/** Keys in this chapter that hold real (non-placeholder) text. */
const realChapterKeys = (verses: Record<string, string>, chapter: number, isQuran: boolean): string[] =>
  Object.keys(verses).filter(
    k => (isQuran || k.startsWith(`${chapter}:`)) && !isPlaceholderText(verses[k])
  );

/** Verse numbers (1-based) that are absent or placeholder in this chapter. */
export function findMissingVerses(
  verses: Record<string, string>,
  chapter: number,
  expectedCount: number,
  isQuran: boolean
): number[] {
  const missing: number[] = [];
  for (let v = 1; v <= expectedCount; v++) {
    if (isPlaceholderText(verses[verseKey(chapter, v, isQuran)])) missing.push(v);
  }
  return missing;
}

/**
 * Look for the missing verses in other public-domain translations that carry
 * the same book slug. Only verses that are bundled (not themselves borrowed or
 * reconstructed) are eligible, so provenance never launders.
 *
 * With `missing` empty and `wholeChapter` true, every real verse of the chapter
 * is taken from the first sibling that has any.
 */
export async function borrowVerses(
  tradition: Tradition,
  translationId: string,
  slug: string,
  chapter: number,
  missing: number[],
  isQuran: boolean,
  wholeChapter: boolean = false
): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  if (!missing.length && !wholeChapter) return found;

  const manifests = await loadAllManifests();
  const candidates: { tradition: Tradition; translation: string }[] = [];
  const consider = (t: Tradition, m: CanonManifest) => {
    if (!m.books.some(b => b.slug === slug)) return;
    for (const tr of m.translations) {
      if (!tr.isPublicDomain) continue;
      if (t === tradition && tr.id === translationId) continue;
      candidates.push({ tradition: t, translation: tr.id });
    }
  };
  const own = manifests.get(tradition);
  if (own) consider(tradition, own);
  for (const [t, m] of manifests) if (t !== tradition) consider(t, m);

  const remaining = new Set(missing);
  for (const c of candidates) {
    if (!wholeChapter && !remaining.size) break;
    let book;
    try {
      book = await getBook(c.tradition, c.translation, slug);
    } catch {
      continue;
    }
    if (wholeChapter) {
      const keys = realChapterKeys(book.verses, chapter, isQuran).filter(k => !book.provenance[k]);
      if (keys.length) {
        for (const k of keys) found[k] = book.verses[k];
        break;
      }
      continue;
    }
    for (const v of Array.from(remaining)) {
      const k = verseKey(chapter, v, isQuran);
      const text = book.verses[k];
      if (!isPlaceholderText(text) && !book.provenance[k]) {
        found[k] = text;
        remaining.delete(v);
      }
    }
  }
  return found;
}

/** True when the stored chapter has gaps that repairChapter would try to fill. */
export function chapterNeedsRepair(
  stored: { verses: Record<string, string>; provenance: Record<string, VerseSource>; chapterCounts?: Record<string, number> },
  book: ManifestBook,
  chapter: number,
  isQuran: boolean
): boolean {
  const expected = (book.chapters[chapter - 1] ?? 0) || stored.chapterCounts?.[String(chapter)] || 0;
  if (expected > 0) return findMissingVerses(stored.verses, chapter, expected, isQuran).length > 0;
  return realChapterKeys(stored.verses, chapter, isQuran).filter(k => !stored.provenance[k]).length === 0;
}

export interface RepairResult {
  verses: Record<string, string>;
  provenance: Record<string, VerseSource>;
  borrowed: number[];
  reconstructed: number[];
  unresolved: number[];
}

export interface RepairOptions {
  tradition: Tradition;
  translationId: string;
  manifest: CanonManifest;
  book: ManifestBook;
  chapter: number;
  /** Override the runtime AI rule (see runtimeConfig). Default: dev on, production off. */
  allowAI?: boolean;
}

/**
 * Ensure a chapter is complete. Returns the full book verse map (with any
 * repairs merged) plus what was done. Safe to call on every chapter load —
 * complete chapters return immediately with no network or AI work.
 */
export async function repairChapter(opts: RepairOptions): Promise<RepairResult> {
  const { tradition, translationId, manifest, book, chapter } = opts;
  const allowAI = opts.allowAI ?? runtimeAIEnabled();
  const isQuran = tradition === 'quran';
  const slug = book.slug;

  const stored = await getBook(tradition, translationId, slug);
  // Manifest count, else a count learned from an earlier whole-chapter fill, else unknown
  const expected = (book.chapters[chapter - 1] ?? 0) || stored.chapterCounts?.[String(chapter)] || 0;

  const result: RepairResult = {
    verses: stored.verses,
    provenance: stored.provenance,
    borrowed: [],
    reconstructed: [],
    unresolved: [],
  };

  // Known verse count → list the gaps. Unknown (0) → the chapter is either
  // already populated (nothing to do) or must be filled as a whole.
  let missing: number[] = [];
  let wholeChapter = false;
  if (expected > 0) {
    missing = findMissingVerses(stored.verses, chapter, expected, isQuran);
    if (!missing.length) return result;
  } else {
    // Only bundled text counts as "already populated"; a partial repair from an
    // earlier session without a learned count gets refilled as a whole.
    const bundledReal = realChapterKeys(stored.verses, chapter, isQuran).filter(k => !stored.provenance[k]);
    if (bundledReal.length) return result;
    wholeChapter = true;
  }

  const patched: Record<string, string> = {};
  const patchedProvenance: Record<string, VerseSource> = {};

  // 1. Borrow from sibling translations
  const borrowed = await borrowVerses(tradition, translationId, slug, chapter, missing, isQuran, wholeChapter);
  if (Object.keys(borrowed).length) {
    await patchBook(tradition, translationId, slug, borrowed, 'borrowed');
    for (const k of Object.keys(borrowed)) {
      patched[k] = borrowed[k];
      patchedProvenance[k] = 'borrowed';
      result.borrowed.push(verseNumberOf(k));
    }
  }

  // 2. Reconstruct the rest with AI — one request for the whole gap list
  let stillMissing = missing.filter(v => !borrowed[verseKey(chapter, v, isQuran)]);
  const needAI = wholeChapter ? !Object.keys(borrowed).length : stillMissing.length > 0;
  if (needAI && allowAI) {
    try {
      const translationMeta = manifest.translations.find(t => t.id === translationId);
      const generated = await aiReconstructVerses({
        tradition,
        translationName: translationMeta?.displayName || translationId,
        bookName: book.displayName,
        chapter,
        verses: wholeChapter ? [] : stillMissing,
        isQuran,
        wholeChapter,
      });
      const toStore: Record<string, string> = {};
      const wanted = wholeChapter
        ? Object.keys(generated).map(Number).filter(n => n > 0).sort((a, b) => a - b)
        : stillMissing;
      for (const v of wanted) {
        const text = generated[v];
        if (typeof text === 'string' && text.trim()) {
          toStore[verseKey(chapter, v, isQuran)] = text.trim();
        }
      }
      if (Object.keys(toStore).length) {
        await patchBook(tradition, translationId, slug, toStore, 'reconstructed');
        for (const k of Object.keys(toStore)) {
          patched[k] = toStore[k];
          patchedProvenance[k] = 'reconstructed';
          result.reconstructed.push(verseNumberOf(k));
        }
        stillMissing = stillMissing.filter(v => !toStore[verseKey(chapter, v, isQuran)]);
      }
    } catch (err) {
      console.warn(`[verseRepair] AI reconstruction failed for ${slug} ${chapter}`, err);
    }
  }
  result.unresolved = wholeChapter && !Object.keys(patched).length ? [1] : stillMissing;

  // A whole-chapter fill teaches us the chapter's verse count
  let learnedCount = 0;
  if (wholeChapter && Object.keys(patched).length) {
    learnedCount = Math.max(...Object.keys(patched).map(verseNumberOf));
    await setLearnedChapterCount(tradition, translationId, slug, chapter, learnedCount);
  }

  // 3. Persist to the project dataset (dev server only; no-op elsewhere)
  if (Object.keys(patched).length) {
    void persistToProject(tradition, translationId, slug, patched, patchedProvenance, {
      chapter,
      chapterCount: learnedCount,
    });
  }

  const final = await getBook(tradition, translationId, slug);
  result.verses = final.verses;
  result.provenance = final.provenance;
  return result;
}

/**
 * Write repaired verses back into public/data via the dev middleware so the
 * bundled dataset is consistent for everyone. Silently ignored in production.
 */
export async function persistToProject(
  tradition: string,
  translation: string,
  slug: string,
  verses: Record<string, string>,
  provenance: Record<string, VerseSource>,
  learned?: { chapter: number; chapterCount: number }
): Promise<boolean> {
  const isDev = typeof import.meta !== 'undefined' && !!(import.meta as any).env?.DEV;
  if (!isDev || typeof fetch !== 'function') return false;
  try {
    const res = await fetch('/__scripture/patch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradition,
        translation,
        slug,
        verses,
        provenance,
        chapter: learned?.chapter,
        chapterCount: learned?.chapterCount || 0,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
