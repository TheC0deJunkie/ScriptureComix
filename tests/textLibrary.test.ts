import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractChapter } from '../services/textLibrary';

describe('extractChapter', () => {
  const sampleBookData: Record<string, string> = {
    '1:1': 'In the beginning God created the heavens and the earth.',
    '1:2': 'And the earth was without form, and void.',
    '1:3': 'And God said, Let there be light.',
    '2:1': 'Thus the heavens and the earth were finished.',
    '2:2': 'And on the seventh day God ended his work.',
  };

  it('returns verses for a specific chapter', () => {
    const result = extractChapter(sampleBookData, 1);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ verse: 1, text: 'In the beginning God created the heavens and the earth.' });
    expect(result[2]).toEqual({ verse: 3, text: 'And God said, Let there be light.' });
  });

  it('returns empty array for non-existent chapter', () => {
    const result = extractChapter(sampleBookData, 99);
    expect(result).toHaveLength(0);
  });

  it('sorts verses numerically not lexicographically', () => {
    const data: Record<string, string> = {
      '1:1': 'first', '1:2': 'second', '1:10': 'tenth', '1:11': 'eleventh',
    };
    const result = extractChapter(data, 1);
    expect(result.map(v => v.verse)).toEqual([1, 2, 10, 11]);
  });

  it('handles Quran flat keys (no chapter prefix)', () => {
    const quranData: Record<string, string> = {
      '1': 'All praise is due to Allah',
      '2': 'The Lord of the Worlds',
      '3': 'The Most Gracious, the Most Merciful',
    };
    const result = extractChapter(quranData, 1, true);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ verse: 1, text: 'All praise is due to Allah' });
  });

  it('returns only verses from the specified chapter (not adjacent chapters)', () => {
    const result = extractChapter(sampleBookData, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ verse: 1, text: 'Thus the heavens and the earth were finished.' });
  });
});

describe('loadChapterText source validation', () => {
  it('does not import from bible-translations-master', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('services/textLibrary.ts', 'utf-8');
    expect(source).not.toContain('bible-translations-master');
    expect(source).not.toContain('import.meta.glob');
  });

  it('loads via fetch from /data/ path', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('services/textLibrary.ts', 'utf-8');
    expect(source).toContain('/data/');
    expect(source).toContain('fetch(');
  });
});
