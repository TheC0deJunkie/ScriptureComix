import { BibleVersion, ChapterTextResult, ChapterVerse, TextCatalogEntry } from "../types";
import kjvBible from "../bible-translations-master/bible-translations-master/KJV/KJV_bible.json";
import nivBible from "../bible-translations-master/bible-translations-master/NIV/NIV_bible.json";
import nltBible from "../bible-translations-master/bible-translations-master/NLT/NLT_bible.json";
import nkjvBible from "../bible-translations-master/bible-translations-master/NKJV/NKJV_bible.json";
import nasbBible from "../bible-translations-master/bible-translations-master/NASB/NASB_bible.json";
import gnvBible from "../bible-translations-master/bible-translations-master/GNV/GNV_bible.json";

type Catalog = TextCatalogEntry[];

// Dynamic imports for scripture datasets (non-eager, loaded on demand)
const repoBibleModules = import.meta.glob(
  '../bible-translations-master/bible-translations-master/**/**.json',
  { as: 'json' }
) as Record<string, () => Promise<any>>;

const repoQuranModules = import.meta.glob(
  '../AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION/**/**.json',
  { as: 'json' }
) as Record<string, () => Promise<any>>;

const repoDeutModules = import.meta.glob(
  '../bible-nabre-json-dataset-including-deutoronocanical/**/**.json',
  { as: 'json' }
) as Record<string, () => Promise<any>>;

// Interface for discovered scripture entries
export interface ScriptureEntry {
  id: string;
  displayName: string;
  group: string; // 'Bible', 'Quran', 'Deuterocanonical', 'Library'
  path: string;
  loader?: () => Promise<any>;
  data?: any;
  books?: string[]; // list of book keys or chapter numbers (as strings) contained in this entry
}

interface TranslationFile {
  books: Record<string, Record<string, string[]>>;
}

const BASE_PATH = '/';
const CATALOG_PATH = `${BASE_PATH}library/catalog.json`;
const DATA_BASE_PATH = `${BASE_PATH}library/`;

let catalogPromise: Promise<Catalog> | null = null;
const translationCache = new Map<string, TranslationFile>();

const VERSION_MAP: Partial<Record<BibleVersion | string, string>> = {
  [BibleVersion.KJV]: "KJV",
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`);
  }
  return (await res.json()) as T;
};

export const loadTextCatalog = async (): Promise<Catalog> => {
  if (!catalogPromise) {
    catalogPromise = fetchJson<Catalog>(CATALOG_PATH).catch(err => {
      catalogPromise = null;
      throw err;
    });
  }
  return catalogPromise;
};

// Discover all available scripture sources (Bible translations, Quran, Deuterocanonical)
export const discoverScriptures = async (): Promise<ScriptureEntry[]> => {
  const results: ScriptureEntry[] = [];
  try {
    // Build a reference set of main Bible books from the KJV (represents canonical books)
    const kjvBooks = new Set(Object.keys(kjvBible).map(k => k.toLowerCase()));

    // --- Process Bible translations: look for *_bible.json files per translation folder ---
    const addedTranslations = new Set<string>();
    for (const path in repoBibleModules) {
      const parts = path.split('/');
      const file = parts[parts.length - 1];
      const folder = parts[parts.length - 2] || file.replace(/\.[^.]+$/, '');
      // Prefer files named like <CODE>_bible.json
      if (!/_bible\.json$/i.test(file)) continue;
      if (addedTranslations.has(folder)) continue;
      addedTranslations.add(folder);

      // Load the module to probe for friendly metadata (if present)
      try {
        const mod = await repoBibleModules[path]();
        const data = mod && mod.default ? mod.default : mod;
        // Try to extract a human-friendly title from meta if available
        const title = (data?.meta?.title || data?.meta?.name || folder).toString();
        // Try to extract book keys if present (top-level keys or data.books)
        let books: string[] = [];
        if (data && typeof data === 'object') {
          if (data.books && typeof data.books === 'object') {
            books = Object.keys(data.books);
          } else {
            // top-level keys often are book names
            const keys = Object.keys(data).filter(k => typeof data[k] === 'object');
            // Heuristic: only include keys that look like book names (letters and spaces)
            books = keys.filter(k => /^[A-Za-z0-9 '\-()]+$/.test(k));
          }
        }
        // Create entry; loader returns the same module
        results.push({ id: `bible-${folder}`, displayName: title, group: 'Bible', path, loader: repoBibleModules[path], books });
      } catch (err) {
        // Fallback to folder code as displayName
        results.push({ id: `bible-${folder}`, displayName: folder, group: 'Bible', path, loader: repoBibleModules[path], books: [] });
      }
    }

    // --- Process Quran datasets ---
    for (const path in repoQuranModules) {
      // Ignore small unrelated JSONs; prefer ones with 'quran' or 'AL-QURAN' in path
      if (!/quran|AL-QURAN/i.test(path)) continue;
      try {
        const mod = await repoQuranModules[path]();
        const data = mod && mod.default ? mod.default : mod;
        const title = data?.meta?.title || data?.meta?.name || 'Quran';
        // gather chapter keys
        const books: string[] = [];
        if (data?.chapters && typeof data.chapters === 'object') {
          Object.keys(data.chapters).forEach(k => books.push(String(k)));
        } else if (data?.surahs && Array.isArray(data.surahs)) {
          data.surahs.forEach((s: any) => { if (s && s.number) books.push(String(s.number)); });
        }
        results.push({ id: `quran-${path.split('/').pop()}`, displayName: title, group: 'Quran', path, loader: repoQuranModules[path], books });
        break; // prefer first matching quran dataset
      } catch (err) {
        // try still to add an entry pointing to the file
        const name = path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Quran';
        results.push({ id: `quran-${name}`, displayName: 'Quran', group: 'Quran', path, loader: repoQuranModules[path], books: [] });
        break;
      }
    }

    // --- Process Deuterocanonical books: include only those not in kjvBooks ---
    const seenDeut = new Set<string>();
    for (const path in repoDeutModules) {
      try {
        const mod = await repoDeutModules[path]();
        const data = mod && mod.default ? mod.default : mod;
        // Determine book name: try meta.title, or single key in data.books, or filename
        let bookName: string | null = null;
        if (data?.meta?.title) bookName = data.meta.title;
        else if (data?.books && typeof data.books === 'object') {
          const keys = Object.keys(data.books);
          if (keys.length === 1) bookName = keys[0];
        } else if (data && typeof data === 'object') {
          const keys = Object.keys(data);
          if (keys.length === 1) bookName = keys[0];
        }
        if (!bookName) {
          const filename = path.split('/').pop() || '';
          bookName = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        }
        const normalized = bookName.trim().toLowerCase();
        if (seenDeut.has(normalized)) continue;
        seenDeut.add(normalized);
        // If this book is already in the canonical KJV set, skip it
        if (kjvBooks.has(normalized)) continue;
  // Attempt to extract verse/chapter keys for deut files
  let booksList: string[] = [];
  if (data?.books && typeof data.books === 'object') booksList = Object.keys(data.books);
  else if (data && typeof data === 'object') booksList = Object.keys(data);
  results.push({ id: `deut-${normalized}`, displayName: bookName, group: 'Deuterocanonical', path, loader: repoDeutModules[path], books: booksList });
      } catch (err) {
        // ignore malformed entries
        continue;
      }
    }

    return results;
  } catch (err) {
    console.warn('discoverScriptures failed:', err);
    return results;
  }
};

// Load scripture data on demand (called when user selects a scripture source)
export const loadScriptureData = async (entry: ScriptureEntry): Promise<any> => {
  try {
    if (entry.loader) {
      const mod = await entry.loader();
      return mod && mod.default ? mod.default : mod;
    }
    // Fallback: fetch from path
    return await fetchJson<any>(entry.path);
  } catch (err) {
    console.warn(`Failed to load scripture ${entry.displayName}:`, err);
    return null;
  }
};

// Extract verses from a scripture dataset (supports various formats)
export const extractVersesFromScripture = (
  data: any,
  book: string,
  chapter: number
): ChapterVerse[] | null => {
  if (!data) return null;

  const cleanTranslation = (raw: any): string => {
    if (!raw) return '';
    let txt = String(raw);
    // Remove inline footnote numeric markers that appear embedded in the translation (e.g. "Allah,1Lord" or "... blessed1—such")
    // Strategy: remove short digit sequences that are adjacent to punctuation/letters and collapse whitespace.
    txt = txt.replace(/(?<=\D)\d{1,3}(?=\D)/g, '');
    txt = txt.replace(/\s{2,}/g, ' ').trim();
    return txt;
  };

  // Format 1: Bible format (book -> chapter -> verse mapping)
  if (data[book]) {
    const chapterObj = data[book]?.[String(chapter)];
    if (chapterObj) {
      const entries = Object.entries(chapterObj) as [string, string][];
      return entries
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([verseNum, text]) => ({
          verse: Number(verseNum),
          text,
        }));
    }
  }

  // Format 2: Translation format ({ books: { BookName: { chapter: [verseText, ...] } } })
  if (data.books && data.books[book] && data.books[book][chapter]) {
    const verses = data.books[book][chapter];
    if (Array.isArray(verses)) {
      return verses.map((text, idx) => ({ verse: idx + 1, text }));
    }
  }

  // Format 3: Quran format ({ surahs: [{ number, ayahs: [{ text }] }] })
  // New format seen in provided JSON: top-level `chapters` object keyed by surah number
  if (data.chapters && typeof data.chapters === 'object') {
    const key = String(book) || String(chapter);
    const surah = data.chapters[String(book)] || data.chapters[String(chapter)];
    if (surah && surah.verses && typeof surah.verses === 'object') {
      const entries = Object.entries(surah.verses) as [string, any][];
      return entries
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([vnum, obj]) => ({
          verse: Number(vnum),
          // prefer translation_eng (English) when available, otherwise the Arabic content
          text: cleanTranslation(obj.translation_eng || obj.translation || obj.content || JSON.stringify(obj)),
        }));
    }
  }

  if (data.surahs && Array.isArray(data.surahs)) {
    const surah = data.surahs.find(
      (s: any) => Number(s.number) === Number(chapter) || s.name === book
    );
    if (surah && surah.ayahs && Array.isArray(surah.ayahs)) {
      return surah.ayahs.map((ayah: any, idx: number) => ({
        verse: idx + 1,
        text: cleanTranslation(ayah.translation || ayah.text || JSON.stringify(ayah)),
      }));
    }
  }

  return null;
};

const findCatalogEntry = (catalog: Catalog, version: string, book: string): TextCatalogEntry | undefined => {
  const byVersion = catalog.find(entry => entry.versions?.includes(version));
  if (byVersion) return byVersion;
  return catalog.find(entry => entry.books?.includes(book) && entry.status === "local");
};

const loadTranslationFile = async (entry: TextCatalogEntry): Promise<TranslationFile | null> => {
  if (!entry.file) return null;
  if (translationCache.has(entry.id)) {
    return translationCache.get(entry.id)!;
  }
  try {
    const data = await fetchJson<TranslationFile>(`${DATA_BASE_PATH}${entry.file}`);
    translationCache.set(entry.id, data);
    return data;
  } catch (error) {
    console.warn("Unable to load translation file", entry.id, error);
    return null;
  }
};

const normalizeVersion = (version: string): string => {
  return VERSION_MAP[version as BibleVersion] || version;
};

const extractVersesFromBibleJson = (
  source: any,
  book: string,
  chapter: number
): ChapterVerse[] | null => {
  if (!source || !source[book]) return null;
  const chapterObj = source[book]?.[String(chapter)];
  if (!chapterObj) return null;
  const entries = Object.entries(chapterObj) as [string, string][];
  return entries
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([verseNum, text]) => ({
      verse: Number(verseNum),
      text,
    }));
};

export const loadChapterText = async (
  version: BibleVersion,
  book: string,
  chapter: number
): Promise<ChapterTextResult | null> => {
  // 1) Native Bibles from bible-translations-master repo
  const localSource =
    version === BibleVersion.KJV ? kjvBible :
    version === BibleVersion.NIV ? nivBible :
    version === BibleVersion.NLT ? nltBible :
    version === BibleVersion.NKJV ? nkjvBible :
    version === BibleVersion.NASB ? nasbBible :
    version === BibleVersion.GENEVA ? gnvBible :
    null;

  if (localSource) {
    const verses = extractVersesFromBibleJson(localSource, book, chapter);
    if (verses && verses.length) {
      const entry: TextCatalogEntry = {
        id: `${version}-local`,
        displayName: version,
        language: "English",
        license: "See bible-translations-master LICENSE",
        status: "local",
        versions: [version],
        books: ["*"],
      };
      return { entry, verses };
    }
  }

  // 2) Fallback to library catalog (lost books, Enoch, etc.)
  const catalog = await loadTextCatalog();
  const versionKey = normalizeVersion(version);
  const entry = findCatalogEntry(catalog, versionKey, book);
  if (!entry || entry.status !== "local") return null;

  const translation = await loadTranslationFile(entry);
  if (!translation?.books?.[book]?.[chapter]) return null;

  const verses = translation.books[book][chapter].map<ChapterVerse>((text, index) => ({
    verse: index + 1,
    text
  }));

  return { entry, verses };
};

