/**
 * djvuColumns — rebuilds page text from an Internet Archive `_djvu.xml` OCR
 * file (word bounding boxes) so that two-column pages come out one column at
 * a time instead of interleaved line by line.
 *
 * The plain `_djvu.txt` for a two-column scan puts the left and right column
 * of each printed line on one text line ("3 Kodwa izinhlamvu … 18 U ya
 * kukuvezela …"), which scrambles verses. Here every word is assigned to a
 * column by its x position, and each page is emitted as: full-width header
 * lines, then the left column top to bottom, then the right column.
 *
 * Usage:
 *   npx tsx scripts/djvuColumns.ts <book_djvu.xml> <out.txt>
 */
import fs from 'fs';

const [, , SRC, OUT] = process.argv;
if (!SRC || !OUT || !fs.existsSync(SRC)) {
  console.error('Usage: npx tsx scripts/djvuColumns.ts <book_djvu.xml> <out.txt>');
  process.exit(1);
}

interface Word { x1: number; x2: number; top: number; bottom: number; text: string }
interface Line { words: Word[]; top: number }

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const xml = fs.readFileSync(SRC, 'utf8');
const pages = xml.split('<OBJECT ').slice(1);
const out: string[] = [];
let twoColumn = 0, oneColumn = 0, mergedPages = 0;

for (const page of pages) {
  const width = Number(page.match(/width="(\d+)"/)?.[1] ?? 0);
  const lines: Line[] = [];
  const lineRe = /<LINE(?:\s[^>]*)?>([\s\S]*?)<\/LINE>/g;
  let lm: RegExpExecArray | null;
  while ((lm = lineRe.exec(page))) {
    const words: Word[] = [];
    const wordRe = /<WORD coords="(\d+),(\d+),(\d+),(\d+)"[^>]*>([\s\S]*?)<\/WORD>/g;
    let wm: RegExpExecArray | null;
    while ((wm = wordRe.exec(lm[1]))) {
      const text = decode(wm[5]).trim();
      if (!text) continue;
      // DjVu coords are left, bottom, right, top
      words.push({ x1: Number(wm[1]), bottom: Number(wm[2]), x2: Number(wm[3]), top: Number(wm[4]), text });
    }
    if (words.length) lines.push({ words, top: Math.min(...words.map(w => w.top)) });
  }
  if (!lines.length) { out.push(''); continue; }

  const all = lines.flatMap(l => l.words);
  const minX = Math.min(...all.map(w => w.x1));
  const maxX = Math.max(...all.map(w => w.x2));
  const span = maxX - minX;

  // Find the gutter from where right-column lines begin. On a two-column page many
  // lines start close to the middle of the text block; on a single-column page none do.
  // Merged OCR lines (both columns on one LINE) still start at the left margin, so
  // we look at word starts too: any word that begins a run after a wide gap.
  // The gutter is the vertical strip in the middle of the text block that no real word
  // crosses. Coverage is measured at ~14px resolution; the printed column rule ("|")
  // and other punctuation-only fragments sit in the gutter and are ignored.
  const BINS = 200;
  const cover = new Array(BINS).fill(0);
  const real = all.filter(w => /[A-Za-z0-9]/.test(w.text));
  for (const w of real) {
    const a = Math.max(0, Math.floor(((w.x1 - minX) / span) * BINS));
    const b = Math.min(BINS - 1, Math.floor(((w.x2 - minX) / span) * BINS));
    for (let i = a; i <= b; i++) cover[i]++;
  }
  let best = -1, bestCount = Infinity;
  for (let i = Math.floor(BINS * 0.35); i <= Math.floor(BINS * 0.65); i++) {
    if (cover[i] < bestCount) { bestCount = cover[i]; best = i; }
  }
  // Widen to the whole empty strip and take its centre.
  let lo = best, hi = best;
  while (lo > 0 && cover[lo - 1] <= bestCount) lo--;
  while (hi < BINS - 1 && cover[hi + 1] <= bestCount) hi++;
  const isTwoColumn = lines.length > 8 && best >= 0 && bestCount <= Math.max(2, lines.length * 0.05);
  const gutter = isTwoColumn ? minX + ((lo + hi + 1) / 2 / BINS) * span : Infinity;
  if (isTwoColumn) twoColumn++; else oneColumn++;

  const pageTop = Math.min(...lines.map(l => l.top));
  const pageBottom = Math.max(...all.map(w => w.bottom));
  const headerBand = pageTop + (pageBottom - pageTop) * 0.06;

  // Skewed scans make the gutter a slanted band, so each merged line is split at
  // its own widest gap inside the middle of the page. Lines without such a gap
  // (a short left line, or a right-column-only line) go by their position
  // relative to the page's median split.
  const isReal = (w: Word) => /[A-Za-z0-9]/.test(w.text);
  const bandLo = minX + span * 0.33, bandHi = minX + span * 0.67;
  const splitAt = (line: Line): number | null => {
    const ws = [...line.words].sort((a, b) => a.x1 - b.x1);
    let bestGap = 0, at: number | null = null;
    for (let i = 1; i < ws.length; i++) {
      if (!isReal(ws[i]) ) continue;
      // previous real word (skip the column rule "|")
      let j = i - 1; while (j >= 0 && !isReal(ws[j])) j--;
      if (j < 0) continue;
      const gap = ws[i].x1 - ws[j].x2;
      if (ws[i].x1 >= bandLo && ws[i].x1 <= bandHi && gap > bestGap) { bestGap = gap; at = ws[i].x1; }
    }
    return bestGap > span * 0.02 ? at : null;
  };
  const firstPass = lines.map(splitAt);
  const found0 = firstPass.filter((x): x is number => x !== null).sort((a, b) => a - b);
  const pageSplit = found0.length >= 5 ? found0[Math.floor(found0.length / 2)] : isTwoColumn ? gutter : null;

  const splits = firstPass;
  const found = found0;
  const twoCol = pageSplit !== null && (found.length >= Math.max(6, lines.length * 0.2) || isTwoColumn);

  // Scans are often slightly rotated, so the gutter drifts down the page. Fit a line
  // x = a + b·top through the split positions we found and use it for lines without a gap.
  const pts = lines.map((l, i) => [l.top, splits[i]] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  let gutterAt = (_top: number) => pageSplit ?? Infinity;
  if (pts.length >= 6) {
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
    const b = sxx > 0 ? pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx : 0;
    const a = my - b * mx;
    // Only trust a gentle slope; anything steeper is noise from stray splits.
    if (Math.abs(b) < 0.05) gutterAt = (top: number) => a + b * top;
  }

  // Drop the printed column rule and other punctuation-only fragments so hyphenated
  // words still end their line with "-" and join cleanly.
  const text = (l: Line) => l.words.filter(w => /[A-Za-z0-9]/.test(w.text)).map(w => w.text).join(' ');

  if (!twoCol) {
    for (const line of lines) out.push(text(line));
    out.push('');
    continue;
  }

  // Keep the OCR's own line order (it is right wherever the OCR separated the
  // columns itself). Only a merged line is split: its left part stays in place and
  // its right part is deferred until the right column reaches that height.
  const isMerged = (line: Line, idx: number) => {
    if (splits[idx] !== null) return true;
    // Real words clearly on both sides of the (skew-corrected) gutter: merged even without
    // a visible gap (a short right-column fragment such as "uTixo ku-" glued onto a left line).
    // Require a clear reach into both columns; short strays near the gutter are usually
    // OCR noise on one side rather than a real fragment of the other column.
    const g = gutterAt(line.top);
    const real = line.words.filter(w => /[A-Za-z0-9]/.test(w.text));
    const x1 = Math.min(...real.map(w => w.x1)), x2 = Math.max(...real.map(w => w.x2));
    return x1 < g - span * 0.12 && x2 > g + span * 0.12;
  };
  const centreOf = (line: Line) => (Math.min(...line.words.map(w => w.x1)) + Math.max(...line.words.map(w => w.x2))) / 2;
  // Pages the OCR already read column by column are left exactly in its order: the
  // rebuild only helps where lines were merged across the gutter. A page counts as
  // merged when several of its lines split at a mid-page gap.
  const mergedLines = lines.filter((l, i) => isMerged(l, i)).length;
  if (mergedLines < 3) {
    for (const line of lines) out.push(text(line));
    out.push('');
    continue;
  }
  mergedPages++;

  // Merged page: running headers first, then the left column in OCR order, then
  // everything right of the gutter (split-off parts and OCR-separated lines alike)
  // in top-to-bottom order.
  const headers: Line[] = [];
  const leftCol: Line[] = [];
  const rightCol: Line[] = [];
  lines.forEach((line, idx) => {
    const cut = splits[idx] ?? gutterAt(line.top);
    const l = line.words.filter(w => w.x1 < cut - span * 0.01);
    const r = line.words.filter(w => w.x1 >= cut - span * 0.01);
    // A running header is a short capitals-only line in the top band that straddles the gutter.
    const capsOnly = line.words.every(w => !/[a-z]/.test(w.text));
    if (line.top <= headerBand && l.length && r.length && line.words.length <= 5 && capsOnly) { headers.push(line); return; }
    if (isMerged(line, idx)) {
      if (l.length) leftCol.push({ words: l, top: line.top });
      if (r.length) rightCol.push({ words: r, top: line.top });
      return;
    }
    if (centreOf(line) >= gutterAt(line.top)) rightCol.push(line);
    else leftCol.push(line);
  });
  for (const h of headers) out.push(text(h));
  for (const l of leftCol) out.push(text(l));
  out.push('');
  const row = (l: Line) => Math.round(l.top / 50);
  const indexed = rightCol.map((l, i) => ({ l, i }));
  indexed.sort((a, b) => row(a.l) - row(b.l) || a.i - b.i);
  for (const { l } of indexed) out.push(text(l));
  out.push('');
}

fs.writeFileSync(OUT, out.join('\n') + '\n', 'utf8');
console.log(`${pages.length} pages: ${twoColumn} two-column (${mergedPages} rebuilt because lines were merged), ${oneColumn} single-column → ${OUT}`);
