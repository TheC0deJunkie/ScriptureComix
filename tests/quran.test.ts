import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Standard (Kufic) numbering, as in every printed mushaf: Al-Fatiha has 7
 * ayahs with the Basmala as ayah 1, and the Quran has 6236 ayahs in total.
 */
describe('Quran data integrity', () => {
  it('Al-Fatiha has 7 ayahs and ayah 1 is the Basmala', () => {
    const filePath = path.join(process.cwd(), 'public/data/quran/yusuf-ali/al-fatiha.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(Object.keys(data)).toHaveLength(7);
    expect(data['1'].toLowerCase()).toContain('in the name of allah');
    expect(data['2'].toLowerCase()).toContain('praise');
  });

  it('total ayah count across all 114 surahs is 6236', () => {
    const manifestPath = path.join(process.cwd(), 'public/data/quran/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.books).toHaveLength(114);
    const totalAyahs = manifest.books.reduce((sum: number, book: any) => sum + book.chapters[0], 0);
    expect(totalAyahs).toBe(6236);
  });

  it('uses the public-domain Yusuf Ali translation with no footnotes glued in', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/quran/manifest.json'), 'utf-8'));
    const tr = manifest.translations.find((t: any) => t.id === 'yusuf-ali');
    expect(tr.isPublicDomain).toBe(true);
    expect(tr.displayName).toMatch(/Yusuf Ali/);
    const fatiha = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/quran/yusuf-ali/al-fatiha.json'), 'utf-8'));
    for (const text of Object.values(fatiha) as string[]) {
      expect(text.length).toBeLessThan(300);
      expect(text).not.toMatch(/parlance|qirā/);
    }
  });
});
