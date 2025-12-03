import { BibleVersion, ChapterTextResult, ChapterVerse, TextCatalogEntry } from "../types";
import kjvBible from "../bible-translations-master/bible-translations-master/KJV/KJV_bible.json";
import nivBible from "../bible-translations-master/bible-translations-master/NIV/NIV_bible.json";
import nltBible from "../bible-translations-master/bible-translations-master/NLT/NLT_bible.json";
import nkjvBible from "../bible-translations-master/bible-translations-master/NKJV/NKJV_bible.json";
import nasbBible from "../bible-translations-master/bible-translations-master/NASB/NASB_bible.json";
import gnvBible from "../bible-translations-master/bible-translations-master/GNV/GNV_bible.json";

type Catalog = TextCatalogEntry[];

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

