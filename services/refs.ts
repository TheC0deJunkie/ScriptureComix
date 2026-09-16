/**
 * refs — turning a set of verse numbers into the way people write them
 * ("1-10", "1-3, 7") and back. Used for multi-verse highlights, notes,
 * copied quotes and what gets shared with a circle.
 */

/** [1,2,3,7,9,10] → "1-3, 7, 9-10" */
export function formatVerseRanges(verses: number[]): string {
  const v = Array.from(new Set(verses.filter(n => Number.isFinite(n)))).sort((a, b) => a - b);
  if (!v.length) return '';
  const parts: string[] = [];
  let start = v[0], prev = v[0];
  for (let i = 1; i <= v.length; i++) {
    const n = v[i];
    if (n === prev + 1) { prev = n; continue; }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    start = n; prev = n;
  }
  return parts.join(', ');
}

/** "1-3, 7, 9-10" → [1,2,3,7,9,10]; tolerant of en dashes and spaces. */
export function parseVerseRanges(s: string): number[] {
  const out = new Set<number>();
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) out.add(n);
  }
  return Array.from(out).sort((a, b) => a - b);
}

/** Every verse number in a range spec, or [] for something unparseable. */
export const versesOfKey = (key: string): number[] => parseVerseRanges(key);

/** The first verse a note key ("4" or "1-10") belongs to; NaN if none. */
export const firstVerseOfKey = (key: string): number => versesOfKey(key)[0] ?? NaN;

/** "Exodus 4" + [1..10] → "Exodus 4:1-10"; "Al-Fatiha" + [1,2] (Quran) → "Al-Fatiha, ayahs 1-2". */
export function passageRef(label: string, verses: number[], isQuran: boolean): string {
  const r = formatVerseRanges(verses);
  if (!r) return label;
  if (isQuran) return `${label}, ${verses.length > 1 ? 'ayahs' : 'ayah'} ${r}`;
  return `${label}:${r}`;
}

/** Whether a stored ref points at the chapter that is open. */
export const sameChapter = (a: { book: string; chapter: number }, book: string, chapter: number) =>
  a.book.toLowerCase() === book.toLowerCase() && a.chapter === chapter;
