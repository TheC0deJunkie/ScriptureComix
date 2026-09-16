import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// AI is mocked: returns "AI <n>" for every requested verse number
const reconstructVerses = vi.fn(async ({ verses }: { verses: number[] }) =>
  Object.fromEntries(verses.map(v => [v, `AI ${v}`])) as Record<number, string>
);
vi.mock('../services/geminiService', () => ({ reconstructVerses: (a: any) => reconstructVerses(a) }));

import { findMissingVerses, repairChapter, borrowVerses, verseKey } from '../services/verseRepair';
import { __resetScriptureStoreForTests, getBook } from '../services/scriptureStore';
import { CanonManifest } from '../services/types';

const protestant: CanonManifest = {
  tradition: 'protestant',
  displayName: 'Protestant',
  books: [
    { slug: 'genesis', displayName: 'Genesis', section: 'Old Testament', chapters: [3] },
    { slug: 'ruth', displayName: 'Ruth', section: 'Old Testament', chapters: [2] },
  ],
  translations: [
    { id: 'kjv', displayName: 'King James Version', isPublicDomain: true },
    { id: 'web', displayName: 'World English Bible', isPublicDomain: true },
    { id: 'niv', displayName: 'NIV', isPublicDomain: false, copyright: 'c' },
  ],
};
const ethiopian: CanonManifest = {
  tradition: 'ethiopian',
  displayName: 'Ethiopian Orthodox',
  books: [
    { slug: 'genesis', displayName: 'Genesis', section: 'Old Testament', chapters: [3] },
    { slug: '1-enoch', displayName: '1 Enoch', section: 'Additional Books', chapters: [2] },
  ],
  translations: [{ id: 'kjv', displayName: 'King James Version', isPublicDomain: true }],
};

const files: Record<string, any> = {
  '/data/protestant/manifest.json': protestant,
  '/data/ethiopian/manifest.json': ethiopian,
  // kjv genesis is missing verse 2 and has a placeholder for verse 3
  '/data/protestant/kjv/genesis.json': { '1:1': 'KJV 1', '1:3': '[Text pending -- x]' },
  // web has verse 2 but is also missing verse 3
  '/data/protestant/web/genesis.json': { '1:1': 'WEB 1', '1:2': 'WEB 2' },
  // niv is complete but copyrighted — must never be borrowed from
  '/data/protestant/niv/genesis.json': { '1:1': 'NIV 1', '1:2': 'NIV 2', '1:3': 'NIV 3' },
  '/data/ethiopian/kjv/genesis.json': { '1:1': 'ETH 1', '1:2': 'ETH 2', '1:3': 'ETH 3' },
  '/data/ethiopian/kjv/1-enoch.json': { '1:1': '[Text pending -- R.H. Charles 1912]' },
  '/data/protestant/kjv/ruth.json': { '1:1': 'Ruth 1', '1:2': 'Ruth 2' },
};

describe('verseRepair', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    __resetScriptureStoreForTests();
    reconstructVerses.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = files[url];
        if (!body) return { ok: false, status: 404, json: async () => ({}) } as any;
        return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) } as any;
      })
    );
  });

  it('builds verse keys per tradition', () => {
    expect(verseKey(3, 4, false)).toBe('3:4');
    expect(verseKey(1, 4, true)).toBe('4');
  });

  it('finds absent and placeholder verses', () => {
    const missing = findMissingVerses({ '1:1': 'a', '1:3': '[Text pending]' }, 1, 4, false);
    expect(missing).toEqual([2, 3, 4]);
    expect(findMissingVerses({ '1': 'a', '2': 'b' }, 1, 2, true)).toEqual([]);
  });

  it('borrows only from public-domain translations, same tradition first', async () => {
    const found = await borrowVerses('protestant', 'kjv', 'genesis', 1, [2, 3], false);
    // verse 2 comes from WEB (same tradition, PD); verse 3 is not in WEB, so it
    // comes from the Ethiopian KJV copy — never from the copyrighted NIV.
    expect(found['1:2']).toBe('WEB 2');
    expect(found['1:3']).toBe('ETH 3');
  });

  it('repairs a chapter without AI when siblings have the verses', async () => {
    const result = await repairChapter({
      tradition: 'protestant',
      translationId: 'kjv',
      manifest: protestant,
      book: protestant.books[0],
      chapter: 1,
    });
    expect(result.verses['1:1']).toBe('KJV 1');
    expect(result.verses['1:2']).toBe('WEB 2');
    expect(result.verses['1:3']).toBe('ETH 3');
    expect(result.borrowed.sort()).toEqual([2, 3]);
    expect(result.reconstructed).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.provenance['1:2']).toBe('borrowed');
    expect(reconstructVerses).not.toHaveBeenCalled();
  });

  it('falls back to AI for verses no translation has, and stores them forever', async () => {
    const result = await repairChapter({
      tradition: 'ethiopian',
      translationId: 'kjv',
      manifest: ethiopian,
      book: ethiopian.books[1],
      chapter: 1,
    });
    expect(reconstructVerses).toHaveBeenCalledTimes(1);
    expect(reconstructVerses.mock.calls[0][0]).toMatchObject({
      tradition: 'ethiopian',
      bookName: '1 Enoch',
      chapter: 1,
      verses: [1, 2],
    });
    expect(result.verses['1:1']).toBe('AI 1');
    expect(result.verses['1:2']).toBe('AI 2');
    expect(result.reconstructed).toEqual([1, 2]);
    expect(result.provenance['1:1']).toBe('reconstructed');

    // Second load: complete, so no AI and no fetch of the book file
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const before = fetchMock.mock.calls.length;
    const again = await repairChapter({
      tradition: 'ethiopian',
      translationId: 'kjv',
      manifest: ethiopian,
      book: ethiopian.books[1],
      chapter: 1,
    });
    expect(reconstructVerses).toHaveBeenCalledTimes(1);
    expect(again.verses['1:2']).toBe('AI 2');
    expect(fetchMock.mock.calls.length).toBe(before);

    // And it survives a reload (IndexedDB)
    __resetScriptureStoreForTests();
    const stored = await getBook('ethiopian', 'kjv', '1-enoch');
    expect(stored.verses['1:1']).toBe('AI 1');
    expect(stored.provenance['1:1']).toBe('reconstructed');
  });

  it('reports unresolved verses when AI is disabled and nothing can be borrowed', async () => {
    const result = await repairChapter({
      tradition: 'ethiopian',
      translationId: 'kjv',
      manifest: ethiopian,
      book: ethiopian.books[1],
      chapter: 1,
      allowAI: false,
    });
    expect(reconstructVerses).not.toHaveBeenCalled();
    expect(result.unresolved).toEqual([1, 2]);
  });

  it('fills a whole chapter when the manifest count is unknown, then remembers the count', async () => {
    const unknown: CanonManifest = {
      ...ethiopian,
      books: [{ slug: '1-enoch', displayName: '1 Enoch', section: 'Additional Books', chapters: [0, 0] }],
    };
    reconstructVerses.mockImplementationOnce(async () => ({ 1: 'E 1', 2: 'E 2', 3: 'E 3' }));
    const result = await repairChapter({
      tradition: 'ethiopian',
      translationId: 'kjv',
      manifest: unknown,
      book: unknown.books[0],
      chapter: 1,
    });
    expect(reconstructVerses).toHaveBeenCalledTimes(1);
    expect(reconstructVerses.mock.calls[0][0]).toMatchObject({ wholeChapter: true, verses: [] });
    expect(result.reconstructed).toEqual([1, 2, 3]);
    expect(result.verses['1:3']).toBe('E 3');
    expect(result.unresolved).toEqual([]);

    const stored = await getBook('ethiopian', 'kjv', '1-enoch');
    expect(stored.chapterCounts?.['1']).toBe(3);

    // Now the count is known: a later load lists gaps instead of refetching everything
    delete stored.verses['1:2'];
    const again = await repairChapter({
      tradition: 'ethiopian',
      translationId: 'kjv',
      manifest: unknown,
      book: unknown.books[0],
      chapter: 1,
    });
    expect(reconstructVerses).toHaveBeenCalledTimes(2);
    expect(reconstructVerses.mock.calls[1][0]).toMatchObject({ wholeChapter: false, verses: [2] });
    expect(again.verses['1:2']).toBe('AI 2');
  });

  it('is a no-op for complete chapters', async () => {
    const result = await repairChapter({
      tradition: 'protestant',
      translationId: 'kjv',
      manifest: protestant,
      book: protestant.books[1],
      chapter: 1,
    });
    expect(result.borrowed).toEqual([]);
    expect(result.reconstructed).toEqual([]);
    expect(reconstructVerses).not.toHaveBeenCalled();
  });
});
