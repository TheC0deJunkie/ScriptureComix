import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function loadManifest(tradition: string) {
  const filePath = path.join(process.cwd(), `public/data/${tradition}/manifest.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('canon completeness', () => {
  it('protestant has exactly 66 books', () => {
    const m = loadManifest('protestant');
    expect(m).not.toBeNull();
    expect(m.books).toHaveLength(66);
    expect(m.tradition).toBe('protestant');
  });

  it('catholic has exactly 73 books', () => {
    const m = loadManifest('catholic');
    expect(m).not.toBeNull();
    expect(m.books).toHaveLength(73);
    expect(m.tradition).toBe('catholic');
    // Verify deuterocanonical books are present
    const slugs = m.books.map((b: any) => b.slug);
    expect(slugs).toContain('tobit');
    expect(slugs).toContain('judith');
    expect(slugs).toContain('wisdom');
    expect(slugs).toContain('sirach');
    expect(slugs).toContain('baruch');
    expect(slugs).toContain('1-maccabees');
    expect(slugs).toContain('2-maccabees');
  });

  it('ethiopian includes enoch and jubilees', () => {
    const m = loadManifest('ethiopian');
    expect(m).not.toBeNull();
    expect(m.tradition).toBe('ethiopian');
    const slugs = m.books.map((b: any) => b.slug);
    expect(slugs).toContain('1-enoch');
    expect(slugs).toContain('jubilees');
    // Verify Additional Books section
    const enochEntry = m.books.find((b: any) => b.slug === '1-enoch');
    expect(enochEntry.section).toBe('Additional Books');
  });

  it('quran has exactly 114 surahs', () => {
    const m = loadManifest('quran');
    expect(m).not.toBeNull();
    expect(m.books).toHaveLength(114);
    expect(m.tradition).toBe('quran');
  });

  it('quran Al-Fatiha has 7 ayahs (standard numbering, Basmala is ayah 1)', () => {
    const m = loadManifest('quran');
    expect(m).not.toBeNull();
    const fatiha = m.books[0];
    expect(fatiha.slug).toBe('al-fatiha');
    expect(fatiha.chapters[0]).toBe(7);
  });

  it('quran total ayah count is 6236 (standard numbering, Basmala is 1:1)', () => {
    const m = loadManifest('quran');
    expect(m).not.toBeNull();
    // Per project decision (CANON-04): Basmala NOT counted as verse 1.
    // Standard Kufic count of 6236, matching our public/data/quran/manifest.json.
    const total = m.books.reduce((sum: number, b: any) => sum + b.chapters[0], 0);
    expect(total).toBe(6236);
  });
});
