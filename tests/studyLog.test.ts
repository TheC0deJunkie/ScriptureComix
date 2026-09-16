import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setHighlight, setVerseNote } from '../services/highlights';
import { getLastRead, setLastRead, listStudiedChapters, exportStudy, importStudy, parseChapterKey, slugToName } from '../services/studyLog';

// In-memory localStorage (jsdom's opaque origin and Node's own localStorage both get in the way)
const makeStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
};

beforeEach(() => {
  const storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
});

describe('studyLog', () => {
  it('remembers where the reader left off', () => {
    expect(getLastRead()).toBeNull();
    setLastRead({ tradition: 'protestant', bookSlug: 'exodus', bookName: 'Exodus', chapter: 3, translationId: 'kjv' });
    const lr = getLastRead();
    expect(lr?.bookName).toBe('Exodus');
    expect(lr?.chapter).toBe(3);
    expect(lr?.at).toBeTruthy();
  });

  it('parses chapter keys and prettifies slugs', () => {
    expect(parseChapterKey('protestant/kjv/1-samuel/17')).toEqual({ tradition: 'protestant', translation: 'kjv', slug: '1-samuel', chapter: 17 });
    expect(parseChapterKey('protestant/1-samuel/17')).toEqual({ tradition: 'protestant', slug: '1-samuel', chapter: 17 });
    expect(parseChapterKey('nope')).toBeNull();
    expect(slugToName('1-samuel')).toBe('1 Samuel');
    expect(slugToName('song-of-solomon')).toBe('Song of Solomon');
  });

  it('lists every chapter with a highlight or note, most-marked first', () => {
    setHighlight('protestant/kjv/genesis/1', 1, 'yellow');
    setHighlight('protestant/kjv/genesis/1', 3, 'green');
    setVerseNote('protestant/kjv/genesis/1', 2, 'There was nothing');
    setVerseNote('protestant/kjv/exodus/3', 14, 'I AM');
    const list = listStudiedChapters();
    // Marks belong to the verse, not the translation: the key drops "kjv"
    expect(list.map(c => c.key)).toEqual(['protestant/genesis/1', 'protestant/exodus/3']);
    expect(list[0].translation).toBeUndefined();
    expect(list[0].bookName).toBe('Genesis');
    expect(list[0].highlights.map(h => h.verse)).toEqual([1, 3]);
    expect(list[0].notes[0].text).toBe('There was nothing');
  });

  it('keeps range notes ("1-10") and files them under their first verse', async () => {
    const { setRangeNote } = await import('../services/highlights');
    setRangeNote('protestant/kjv/exodus/4', '1-10', 'The signs');
    const list = listStudiedChapters();
    expect(list[0].notes).toEqual([{ verse: 1, ref: '1-10', text: 'The signs', visibility: 'private' }]);
  });

  it('exports and imports the same study', () => {
    setHighlight('protestant/kjv/genesis/1', 1, 'yellow');
    setVerseNote('protestant/kjv/genesis/1', 2, 'note');
    localStorage.setItem('scriptureComix_stats', JSON.stringify({ xp: 745, bookmarks: ['Genesis 1'] }));
    const file = exportStudy();
    expect(file.app).toBe('ScriptureComix');
    localStorage.clear();
    expect(listStudiedChapters()).toHaveLength(0);
    const n = importStudy(file);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(listStudiedChapters()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('scriptureComix_stats')!).xp).toBe(745);
  });

  it('rejects files that are not study exports', () => {
    expect(() => importStudy({ hello: 'world' })).toThrow();
    expect(() => importStudy(null)).toThrow();
  });
});
