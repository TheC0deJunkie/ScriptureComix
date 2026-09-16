import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBook,
  peekBook,
  patchBook,
  getStoreStats,
  clearScriptureStore,
  isPlaceholderText,
  __resetScriptureStoreForTests,
} from '../services/scriptureStore';

const GENESIS = { '1:1': 'In the beginning God created the heaven and the earth.', '1:2': 'And the earth was without form, and void;' };
const ENOCH = { '1:1': '[Text pending -- R.H. Charles 1912 translation to be sourced]' };

const makeFetch = () =>
  vi.fn(async (url: string) => {
    const map: Record<string, Record<string, string>> = {
      '/data/protestant/kjv/genesis.json': GENESIS,
      '/data/ethiopian/kjv/1-enoch.json': ENOCH,
    };
    const body = map[url];
    if (!body) return { ok: false, status: 404, json: async () => ({}) } as any;
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) } as any;
  });

describe('scriptureStore', () => {
  let fetchMock: ReturnType<typeof makeFetch>;

  beforeEach(async () => {
    // Fresh IndexedDB + fresh module state for every test
    (globalThis as any).indexedDB = new IDBFactory();
    __resetScriptureStoreForTests();
    fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('detects placeholder and empty verse text', () => {
    expect(isPlaceholderText('[Text pending -- something]')).toBe(true);
    expect(isPlaceholderText('')).toBe(true);
    expect(isPlaceholderText(undefined)).toBe(true);
    expect(isPlaceholderText('In the beginning')).toBe(false);
  });

  it('fetches a book once and serves it from memory afterwards', async () => {
    const a = await getBook('protestant', 'kjv', 'genesis');
    const b = await getBook('protestant', 'kjv', 'genesis');
    expect(a.verses['1:1']).toMatch(/^In the beginning/);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent requests for the same book', async () => {
    const [a, b, c] = await Promise.all([
      getBook('protestant', 'kjv', 'genesis'),
      getBook('protestant', 'kjv', 'genesis'),
      getBook('protestant', 'kjv', 'genesis'),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('persists to IndexedDB so a fresh session never re-fetches', async () => {
    await getBook('protestant', 'kjv', 'genesis');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Simulate a page reload: memory gone, IndexedDB intact
    __resetScriptureStoreForTests();
    const peeked = await peekBook('protestant', 'kjv', 'genesis');
    expect(peeked?.verses['1:2']).toMatch(/without form/);

    const again = await getBook('protestant', 'kjv', 'genesis');
    expect(again.verses['1:1']).toMatch(/^In the beginning/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on a missing book file', async () => {
    await expect(getBook('protestant', 'kjv', 'nope')).rejects.toThrow(/404/);
  });

  it('falls back to the remote text host when a book is not in the bundle', async () => {
    const NLT = { '1:1': 'In the beginning God created the heavens and the earth.' };
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://scripturecomix.web.app/data/protestant/nlt/genesis.json') {
        return { ok: true, status: 200, json: async () => ({ ...NLT }) } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    });
    const book = await getBook('protestant', 'nlt', 'genesis');
    expect(book.verses).toEqual(NLT);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/data/protestant/nlt/genesis.json',
      'https://scripturecomix.web.app/data/protestant/nlt/genesis.json',
    ]);
    // stored permanently: a fresh module instance reads it back without the network
    fetchMock.mockClear();
    __resetScriptureStoreForTests();
    expect((await peekBook('protestant', 'nlt', 'genesis'))?.verses).toEqual(NLT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('patchBook replaces placeholders, keeps bundled text, and records provenance', async () => {
    const before = await getBook('ethiopian', 'kjv', '1-enoch');
    expect(isPlaceholderText(before.verses['1:1'])).toBe(true);

    const after = await patchBook(
      'ethiopian',
      'kjv',
      '1-enoch',
      { '1:1': 'The words of the blessing of Enoch', '1:2': 'And he took up his parable' },
      'reconstructed'
    );
    expect(after.verses['1:1']).toBe('The words of the blessing of Enoch');
    expect(after.verses['1:2']).toBe('And he took up his parable');
    expect(after.provenance['1:1']).toBe('reconstructed');
    expect(after.provenance['1:2']).toBe('reconstructed');

    // Bundled text must never be overwritten
    const gen = await patchBook('protestant', 'kjv', 'genesis', { '1:1': 'WRONG' }, 'borrowed');
    expect(gen.verses['1:1']).toMatch(/^In the beginning/);
    expect(gen.provenance['1:1']).toBeUndefined();

    // Patches survive a reload
    __resetScriptureStoreForTests();
    const reloaded = await peekBook('ethiopian', 'kjv', '1-enoch');
    expect(reloaded?.verses['1:2']).toBe('And he took up his parable');
    expect(reloaded?.provenance['1:2']).toBe('reconstructed');
  });

  it('reports store statistics and clears', async () => {
    await getBook('protestant', 'kjv', 'genesis');
    await patchBook('ethiopian', 'kjv', '1-enoch', { '1:1': 'x', '1:2': 'y' }, 'reconstructed');
    const stats = await getStoreStats();
    expect(stats.persistent).toBe(true);
    expect(stats.books).toBe(2);
    expect(stats.verses).toBe(4);
    expect(stats.reconstructed).toBe(2);
    expect(stats.borrowed).toBe(0);

    await clearScriptureStore();
    const empty = await getStoreStats();
    expect(empty.books).toBe(0);
  });

  it('falls back to memory-only when IndexedDB is unavailable', async () => {
    (globalThis as any).indexedDB = undefined;
    __resetScriptureStoreForTests();
    const book = await getBook('protestant', 'kjv', 'genesis');
    expect(book.verses['1:1']).toMatch(/^In the beginning/);
    const stats = await getStoreStats();
    expect(stats.persistent).toBe(false);
    expect(stats.books).toBe(1);
  });
});
