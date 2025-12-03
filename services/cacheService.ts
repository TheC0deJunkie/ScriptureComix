import { CachedChapter } from "../types";

const STORAGE_KEY = "scripture_cache_v1";

type CacheStore = Record<string, CachedChapter>;

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

const readStore = (): CacheStore => {
  if (!isBrowser()) return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CacheStore;
    return parsed || {};
  } catch {
    return {};
  }
};

const writeStore = (store: CacheStore) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn("Cache write failed", error);
  }
};

export const getCacheKey = (
  book: string,
  chapter: number,
  version: string,
  language: string,
  artStyle: string
) => {
  return [
    book.trim().toLowerCase(),
    chapter,
    version.trim().toLowerCase(),
    language.trim().toLowerCase(),
    artStyle.trim().toLowerCase(),
  ].join("|");
};

export const loadCachedChapter = (key: string): CachedChapter | null => {
  if (!isBrowser()) return null;
  const store = readStore();
  const cached = store[key];
  if (!cached) return null;
  try {
    return JSON.parse(JSON.stringify(cached)) as CachedChapter;
  } catch {
    return null;
  }
};

export const saveCachedChapter = (chapter: CachedChapter) => {
  if (!isBrowser()) return;
  const store = readStore();
  store[chapter.key] = chapter;
  writeStore(store);
};

export const clearCachedChapter = (key: string) => {
  if (!isBrowser()) return;
  const store = readStore();
  if (store[key]) {
    delete store[key];
    writeStore(store);
  }
};

export const clearAllChapters = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
};


