/**
 * scriptureStore — the permanent, on-device scripture library.
 *
 * Every book file the app ever touches goes through here and is kept forever:
 *
 *   memory (Map)  →  IndexedDB (persistent)  →  network (/data/*.json)
 *
 * Once a book has been stored, the network is never asked for it again
 * (unless SCRIPTURE_DATA_VERSION is bumped). Verses that were missing from the
 * bundled data and were filled in later (borrowed from another translation or
 * reconstructed by AI) are patched into the same record with a provenance tag,
 * so the data stays consistent across sessions.
 */

export type VerseSource = 'bundled' | 'borrowed' | 'reconstructed';

export interface StoredBook {
  key: string;                       // "tradition/translation/slug"
  tradition: string;
  translation: string;
  slug: string;
  verses: Record<string, string>;    // "ch:v" → text  (Quran: "v" → text)
  provenance: Record<string, VerseSource>; // only non-bundled verses are listed
  /** Verse counts learned for chapters the manifest lists as unknown (0). */
  chapterCounts?: Record<string, number>;
  dataVersion: number;
  savedAt: string;
  updatedAt: string;
}

export interface ScriptureStoreStats {
  persistent: boolean;   // false when IndexedDB is unavailable (memory only)
  books: number;
  verses: number;
  borrowed: number;
  reconstructed: number;
}

/** Bump when the bundled /data files change shape and stored copies must be refetched. */
export const SCRIPTURE_DATA_VERSION = 3; // v3: isiZulu 1883 rebuilt column-by-column (v2: Douay-Rheims, Yusuf Ali, PD deuterocanon)

const DB_NAME = 'scripturecomix-scripture';
const DB_VERSION = 4; // v2 quizzes, v3 context, v4 scenes
const STORE = 'books';
export const QUIZ_STORE = 'quizzes';
export const CONTEXT_STORE = 'context';
export const SCENE_STORE = 'scenes';
const ALL_STORES = [STORE, QUIZ_STORE, CONTEXT_STORE, SCENE_STORE];

const PLACEHOLDER_RE = /^\s*\[text pending/i;

export const isPlaceholderText = (text: string | undefined | null): boolean =>
  !text || !text.trim() || PLACEHOLDER_RE.test(text);

export const bookKey = (tradition: string, translation: string, slug: string) =>
  `${tradition}/${translation}/${slug}`;

// ---------------------------------------------------------------------------
// Memory tier
// ---------------------------------------------------------------------------
const memory = new Map<string, StoredBook>();
const inflight = new Map<string, Promise<StoredBook>>();

// ---------------------------------------------------------------------------
// IndexedDB tier
// ---------------------------------------------------------------------------
let dbPromise: Promise<IDBDatabase | null> | null = null;

const hasIndexedDB = () => typeof indexedDB !== 'undefined' && indexedDB !== null;

const openDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;
  if (!hasIndexedDB()) {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ALL_STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'key' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[scriptureStore] IndexedDB unavailable, using memory only', req.error);
        resolve(null);
      };
      req.onblocked = () => resolve(null);
    } catch (err) {
      console.warn('[scriptureStore] IndexedDB open threw, using memory only', err);
      resolve(null);
    }
  });
  return dbPromise;
};

const idbRequest = <T,>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Generic record helpers shared by the scripture and quiz stores. */
export async function idbGetRecord<T>(store: string, key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(store, 'readonly');
    const result = await idbRequest(tx.objectStore(store).get(key));
    return (result as T | undefined) ?? null;
  } catch (err) {
    console.warn('[scriptureStore] read failed', store, key, err);
    return null;
  }
}

export async function idbPutRecord<T extends { key: string }>(store: string, record: T): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    // Quota or other failure: memory copy still serves this session.
    console.warn('[scriptureStore] write failed', store, record.key, err);
  }
}

export async function idbGetAllRecords<T>(store: string): Promise<T[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const tx = db.transaction(store, 'readonly');
    return (await idbRequest(tx.objectStore(store).getAll())) as T[];
  } catch {
    return [];
  }
}

const idbGet = (key: string) => idbGetRecord<StoredBook>(STORE, key);
const idbPut = (book: StoredBook) => idbPutRecord(STORE, book);
const idbGetAll = () => idbGetAllRecords<StoredBook>(STORE);

const idbClear = async (): Promise<void> => {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------------------
// Network tier
// ---------------------------------------------------------------------------
const fetchBundled = async (key: string): Promise<Record<string, string>> => {
  const res = await fetch(`/data/${key}.json`);
  if (!res.ok) throw new Error(`Failed to load /data/${key}.json: ${res.status}`);
  const json = (await res.json()) as Record<string, string>;
  if (!json || typeof json !== 'object') throw new Error(`Malformed book file: ${key}`);
  return json;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return a book without touching the network. null if never stored. */
export async function peekBook(tradition: string, translation: string, slug: string): Promise<StoredBook | null> {
  const key = bookKey(tradition, translation, slug);
  const cached = memory.get(key);
  if (cached) return cached;
  const stored = await idbGet(key);
  if (stored && stored.dataVersion === SCRIPTURE_DATA_VERSION) {
    memory.set(key, stored);
    return stored;
  }
  return null;
}

/**
 * Get a book: memory → IndexedDB → network. The first network fetch is
 * persisted so subsequent loads (even after a reload or offline) never fetch.
 */
export async function getBook(tradition: string, translation: string, slug: string): Promise<StoredBook> {
  const key = bookKey(tradition, translation, slug);
  const cached = memory.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const stored = await peekBook(tradition, translation, slug);
    if (stored) return stored;

    const verses = await fetchBundled(key);
    const now = new Date().toISOString();
    const book: StoredBook = {
      key,
      tradition,
      translation,
      slug,
      verses,
      provenance: {},
      dataVersion: SCRIPTURE_DATA_VERSION,
      savedAt: now,
      updatedAt: now,
    };
    memory.set(key, book);
    await idbPut(book);
    return book;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Merge verses into a stored book and tag their provenance. Used when missing
 * verses were borrowed from another translation or reconstructed by AI.
 * Bundled verses are never overwritten.
 */
export async function patchBook(
  tradition: string,
  translation: string,
  slug: string,
  verses: Record<string, string>,
  source: VerseSource
): Promise<StoredBook> {
  const book = await getBook(tradition, translation, slug);
  let changed = false;
  for (const [k, text] of Object.entries(verses)) {
    if (!text || !text.trim()) continue;
    const existing = book.verses[k];
    if (existing && !isPlaceholderText(existing) && !book.provenance[k]) continue; // keep bundled
    book.verses[k] = text;
    book.provenance[k] = source;
    changed = true;
  }
  if (changed) {
    book.updatedAt = new Date().toISOString();
    memory.set(book.key, book);
    await idbPut(book);
  }
  return book;
}

/** Remember how many verses a chapter has when the manifest did not know. */
export async function setLearnedChapterCount(
  tradition: string,
  translation: string,
  slug: string,
  chapter: number,
  count: number
): Promise<void> {
  if (!(count > 0)) return;
  const book = await getBook(tradition, translation, slug);
  book.chapterCounts = { ...(book.chapterCounts || {}), [String(chapter)]: count };
  book.updatedAt = new Date().toISOString();
  memory.set(book.key, book);
  await idbPut(book);
}

/** Warm the store with books the user is likely to open next. Errors are swallowed. */
export async function prefetchBooks(tradition: string, translation: string, slugs: string[]): Promise<void> {
  for (const slug of slugs) {
    try {
      await getBook(tradition, translation, slug);
    } catch {
      /* best effort */
    }
  }
}

export async function getStoreStats(): Promise<ScriptureStoreStats> {
  const db = await openDb();
  const books = db ? await idbGetAll() : Array.from(memory.values());
  let verses = 0;
  let borrowed = 0;
  let reconstructed = 0;
  for (const b of books) {
    verses += Object.keys(b.verses).length;
    for (const src of Object.values(b.provenance)) {
      if (src === 'borrowed') borrowed++;
      else if (src === 'reconstructed') reconstructed++;
    }
  }
  return { persistent: !!db, books: books.length, verses, borrowed, reconstructed };
}

export async function clearScriptureStore(): Promise<void> {
  memory.clear();
  inflight.clear();
  await idbClear();
}

/** Test hook: drop memory + connection so a fresh fake IndexedDB can be used. */
export function __resetScriptureStoreForTests() {
  memory.clear();
  inflight.clear();
  dbPromise = null;
}
