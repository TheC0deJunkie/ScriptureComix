import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getHighlights, getHighlightMarks, setHighlight, getVerseNotes, getNoteMarks, setRangeNote, setVerseNote,
  setMarkVisibility, listAllHighlights, listAllVerseNotes, normaliseChapterKey, markChapterKey, migrateMarkStores,
} from '../services/highlights';

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

describe('marks belong to the verse, not the translation', () => {
  it('builds and normalises chapter keys', () => {
    expect(markChapterKey('protestant', 'genesis', 1)).toBe('protestant/genesis/1');
    expect(normaliseChapterKey('protestant/kjv/genesis/1')).toBe('protestant/genesis/1');
    expect(normaliseChapterKey('protestant/genesis/1')).toBe('protestant/genesis/1');
  });

  it('shows a highlight made in one translation when reading another', () => {
    setHighlight('protestant/kjv/genesis/1', 1, 'yellow');
    expect(getHighlights('protestant/web/genesis/1')).toEqual({ '1': 'yellow' });
    expect(getHighlights('protestant/genesis/1')).toEqual({ '1': 'yellow' });
  });

  it('upgrades a legacy store (bare colours and strings, translation-keyed) on read', () => {
    localStorage.setItem('scriptureComix_highlights_v1', JSON.stringify({ 'protestant/kjv/exodus/4': { '3': 'green' } }));
    localStorage.setItem('scriptureComix_verseNotes_v1', JSON.stringify({ 'protestant/kjv/exodus/4': { '1-10': 'The signs' } }));
    expect(getHighlightMarks('protestant/exodus/4')).toEqual({ '3': { color: 'green', visibility: 'private' } });
    expect(getNoteMarks('protestant/exodus/4')).toEqual({ '1-10': { text: 'The signs', visibility: 'private' } });
    migrateMarkStores();
    const raw = JSON.parse(localStorage.getItem('scriptureComix_highlights_v1')!);
    expect(Object.keys(raw)).toEqual(['protestant/exodus/4']);
    expect(raw['protestant/exodus/4']['3'].visibility).toBe('private');
  });
});

describe('visibility', () => {
  it('is private by default and records the author when given', () => {
    setHighlight('protestant/genesis/1', 2, 'blue', { author: 'Thandi' });
    setVerseNote('protestant/genesis/1', 2, 'light', { author: 'Thandi' });
    expect(getHighlightMarks('protestant/genesis/1')['2']).toMatchObject({ color: 'blue', visibility: 'private', author: 'Thandi' });
    expect(getNoteMarks('protestant/genesis/1')['2']).toMatchObject({ text: 'light', visibility: 'private', author: 'Thandi' });
    expect(listAllHighlights()[0].visibility).toBe('private');
    expect(listAllVerseNotes()[0].author).toBe('Thandi');
  });

  it('is a deliberate act on one mark and survives an edit', () => {
    setRangeNote('protestant/exodus/4', '1-10', 'The signs');
    expect(setMarkVisibility('protestant/exodus/4', 'note', '1-10', 'circle')).toBe(true);
    expect(getNoteMarks('protestant/exodus/4')['1-10'].visibility).toBe('circle');
    setRangeNote('protestant/exodus/4', '1-10', 'The signs, edited');
    expect(getNoteMarks('protestant/exodus/4')['1-10']).toMatchObject({ text: 'The signs, edited', visibility: 'circle' });
    expect(setMarkVisibility('protestant/exodus/4', 'highlight', '99', 'circle')).toBe(false);
  });

  it('clears a mark completely', () => {
    setHighlight('protestant/genesis/1', 1, 'yellow');
    setHighlight('protestant/genesis/1', 1, null);
    expect(getHighlights('protestant/genesis/1')).toEqual({});
    setRangeNote('protestant/genesis/1', '1', 'x');
    setRangeNote('protestant/genesis/1', '1', '   ');
    expect(getVerseNotes('protestant/genesis/1')).toEqual({});
  });
});
