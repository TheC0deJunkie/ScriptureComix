import { describe, it, expect } from 'vitest';
import { TRADITIONS, TRADITION_LABELS, NAV_LABELS } from '../services/types';

describe('tradition navigation', () => {
  it('TRADITIONS has 4 entries', () => {
    expect(TRADITIONS).toHaveLength(4);
    expect(TRADITIONS).toEqual(['protestant', 'catholic', 'ethiopian', 'quran']);
  });

  it('TRADITION_LABELS maps all traditions to display names', () => {
    expect(TRADITION_LABELS.protestant).toBe('Protestant');
    expect(TRADITION_LABELS.catholic).toBe('Catholic');
    expect(TRADITION_LABELS.ethiopian).toBe('Ethiopian Orthodox');
    expect(TRADITION_LABELS.quran).toBe('Quran');
  });

  it('Quran uses Surah/Ayah labels not Book/Verse', () => {
    expect(NAV_LABELS.quran.book).toBe('Surah');
    expect(NAV_LABELS.quran.verse).toBe('Ayah');
  });

  it('Bible traditions use Book/Chapter/Verse labels', () => {
    for (const tradition of ['protestant', 'catholic', 'ethiopian'] as const) {
      expect(NAV_LABELS[tradition].book).toBe('Book');
      expect(NAV_LABELS[tradition].chapter).toBe('Chapter');
      expect(NAV_LABELS[tradition].verse).toBe('Verse');
    }
  });

  it('tradition switcher', () => {
    // All traditions are accessible as constants
    expect(TRADITIONS).toContain('protestant');
    expect(TRADITIONS).toContain('catholic');
    expect(TRADITIONS).toContain('ethiopian');
    expect(TRADITIONS).toContain('quran');
  });

  it('quran labels', () => {
    // Quran uses Surah and Ayah — not Book and Verse
    expect(NAV_LABELS.quran.book).toBe('Surah');
    expect(NAV_LABELS.quran.chapter).toBe('Surah');
    expect(NAV_LABELS.quran.verse).toBe('Ayah');
  });
});
