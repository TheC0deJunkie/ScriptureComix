import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Quran data integrity', () => {
  it('Al-Fatiha verse 1 is NOT Basmala (Medina numbering)', () => {
    const filePath = path.join(process.cwd(), 'public/data/quran/yusuf-ali/al-fatiha.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    // Verse 1 should be "All praise..." not "In the name of Allah..."
    const verse1 = data['1'];
    expect(verse1).toBeDefined();
    expect(verse1.toLowerCase()).not.toContain('in the name of allah');
    // Should have exactly 6 keys (Fatiha has 6 ayahs; Basmala not counted as verse 1)
    expect(Object.keys(data)).toHaveLength(6);
  });

  it('total ayah count across all 114 surahs is 6235', () => {
    const manifestPath = path.join(process.cwd(), 'public/data/quran/manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.books).toHaveLength(114);
    const totalAyahs = manifest.books.reduce(
      (sum: number, book: any) => sum + book.chapters[0], 0
    );
    // 6235 per normalized manifest (Basmala not counted as separate ayah in Al-Fatiha)
    expect(totalAyahs).toBe(6235);
  });
});
