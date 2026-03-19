import { BibleVersion, ChapterVerse, ChapterTextResult, TextCatalogEntry } from '../types';
import { Tradition } from './types';
import { loadManifest, findBookSlug } from './manifestService';

// Legacy shape — kept for backward compatibility with App.tsx discovery UI
// These will be removed when the App.tsx scripture discovery UI is migrated in Plan 04
export interface ScriptureEntry {
  id: string;
  displayName: string;
  group: string;
  path: string;
  loader?: () => Promise<any>;
  data?: any;
  books?: string[];
}

const fetchJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
};

// Per-book file cache: key = "tradition/translation/slug"
const bookCache = new Map<string, Record<string, string>>();

// Load a single book's verse data from /data/
export async function loadBookFile(
  tradition: string,
  translation: string,
  slug: string
): Promise<Record<string, string>> {
  const key = `${tradition}/${translation}/${slug}`;
  if (bookCache.has(key)) return bookCache.get(key)!;
  const data = await fetchJson<Record<string, string>>(`/data/${key}.json`);
  bookCache.set(key, data);
  return data;
}

// Extract a chapter's verses from a flat verse map
export function extractChapter(
  bookData: Record<string, string>,
  chapter: number,
  isQuran: boolean = false
): ChapterVerse[] {
  if (isQuran) {
    // Quran files have no chapter prefix — keys are just "1", "2", etc.
    return Object.entries(bookData)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([key, text]) => ({ verse: Number(key), text }));
  }
  const prefix = `${chapter}:`;
  return Object.entries(bookData)
    .filter(([key]) => key.startsWith(prefix))
    .sort((a, b) => Number(a[0].split(':')[1]) - Number(b[0].split(':')[1]))
    .map(([key, text]) => ({ verse: Number(key.split(':')[1]), text }));
}

// Map BibleVersion enum to tradition + translation ID
const VERSION_TO_TRADITION: Record<string, { tradition: Tradition; translationId: string }> = {
  [BibleVersion.KJV]: { tradition: 'protestant', translationId: 'kjv' },
  [BibleVersion.GENEVA]: { tradition: 'protestant', translationId: 'gnv' },
};

// Main entry point — maintains backward-compatible signature for App.tsx
export const loadChapterText = async (
  version: BibleVersion,
  book: string,
  chapter: number
): Promise<ChapterTextResult | null> => {
  const mapping = VERSION_TO_TRADITION[version];
  if (!mapping) return null;

  const { tradition, translationId } = mapping;

  try {
    const manifest = await loadManifest(tradition);
    const slug = findBookSlug(manifest, book);
    if (!slug) return null;

    const bookData = await loadBookFile(tradition, translationId, slug);
    const isQuran = tradition === 'quran';
    const verses = extractChapter(bookData, chapter, isQuran);

    if (!verses.length) return null;

    const translationMeta = manifest.translations.find(t => t.id === translationId);
    const entry: TextCatalogEntry = {
      id: `${translationId}-${tradition}`,
      displayName: translationMeta?.displayName || version,
      language: 'English',
      license: translationMeta?.copyright || 'Public Domain',
      status: 'local',
      versions: [version],
      books: ['*'],
    };

    return { entry, verses };
  } catch (err) {
    console.warn(`Failed to load ${book} ch${chapter} (${version}):`, err);
    return null;
  }
};

// New: tradition-aware loading (for NAV-01/NAV-02 UI in Plan 04)
export async function loadChapterByTradition(
  tradition: Tradition,
  translationId: string,
  bookSlug: string,
  chapter: number
): Promise<ChapterVerse[]> {
  const bookData = await loadBookFile(tradition, translationId, bookSlug);
  return extractChapter(bookData, chapter, tradition === 'quran');
}

// ---------------------------------------------------------------------------
// Legacy stubs — kept for App.tsx backward compatibility during migration
// These functions supported the old static-import discovery UI and will be
// removed when App.tsx is refactored in Plan 04.
// ---------------------------------------------------------------------------

/** @deprecated Use loadManifest + loadBookFile instead */
export const loadTextCatalog = async (): Promise<any[]> => {
  console.warn('[textLibrary] loadTextCatalog is deprecated; use manifestService instead');
  return [];
};

/** @deprecated Scripture discovery is replaced by manifest-based navigation in Plan 04 */
export const discoverScriptures = async (): Promise<ScriptureEntry[]> => {
  console.warn('[textLibrary] discoverScriptures is deprecated; use loadManifest instead');
  return [];
};

/** @deprecated Use loadBookFile + extractChapter instead */
export const loadScriptureData = async (_entry: ScriptureEntry): Promise<any> => {
  console.warn('[textLibrary] loadScriptureData is deprecated; use loadBookFile instead');
  return null;
};

/** @deprecated Use extractChapter instead */
export const extractVersesFromScripture = (
  _data: any,
  _book: string,
  _chapter: number
): ChapterVerse[] | null => {
  console.warn('[textLibrary] extractVersesFromScripture is deprecated; use extractChapter instead');
  return null;
};
