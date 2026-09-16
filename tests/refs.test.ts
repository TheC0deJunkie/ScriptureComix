import { describe, it, expect } from 'vitest';
import { formatVerseRanges, parseVerseRanges, firstVerseOfKey, passageRef } from '../services/refs';

describe('verse references', () => {
  it('formats runs and singles', () => {
    expect(formatVerseRanges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe('1-10');
    expect(formatVerseRanges([3, 1, 2, 7, 10, 9])).toBe('1-3, 7, 9-10');
    expect(formatVerseRanges([5])).toBe('5');
    expect(formatVerseRanges([])).toBe('');
    expect(formatVerseRanges([2, 2, 3])).toBe('2-3');
  });

  it('parses what it formats, plus human variants', () => {
    expect(parseVerseRanges('1-10')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(parseVerseRanges('1–3, 7 , 9-10')).toEqual([1, 2, 3, 7, 9, 10]);
    expect(parseVerseRanges('10-8')).toEqual([8, 9, 10]);
    expect(parseVerseRanges('abc')).toEqual([]);
    expect(firstVerseOfKey('4')).toBe(4);
    expect(firstVerseOfKey('1-10')).toBe(1);
    expect(Number.isNaN(firstVerseOfKey('x'))).toBe(true);
  });

  it('writes passage references the way people do', () => {
    expect(passageRef('Exodus 4', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], false)).toBe('Exodus 4:1-10');
    expect(passageRef('Exodus 4', [], false)).toBe('Exodus 4');
    expect(passageRef('Al-Fatiha', [1, 2], true)).toBe('Al-Fatiha, ayahs 1-2');
    expect(passageRef('Al-Fatiha', [5], true)).toBe('Al-Fatiha, ayah 5');
  });
});
