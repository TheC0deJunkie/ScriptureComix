/**
 * parseZuluOcr — turns the OCR text of the 1883 isiZulu Bible (American Bible
 * Society; Internet Archive item "zulu-bible", public domain) into the
 * tab-separated `slug<TAB>chapter<TAB>verse<TAB>text` file that
 * scripts/importZulu1893.ts consumes.
 *
 * The scan's OCR is rough: running page headers ("UGENESISE, 3."), chapter
 * headings ("ISAHLUKO 3.", Psalms use "ISIHLABELELO 3."), cross-reference
 * lines ("Gen. 10. 30. & 25. 6."), hyphenated line breaks and misread
 * characters are all mixed in with the verses. This script keeps the verses,
 * drops the furniture, and reports how much of the KJV versification it found.
 *
 * Usage:
 *   npx tsx scripts/parseZuluOcr.ts <ocr.txt> [out.tsv]
 *   (default out: data/sources/zul1883.txt)
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const [, , SRC, OUT = path.join(ROOT, 'data', 'sources', 'zul1883.txt')] = process.argv;
if (!SRC || !fs.existsSync(SRC)) {
  console.error('Usage: npx tsx scripts/parseZuluOcr.ts <ocr.txt> [out.tsv]');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'protestant', 'manifest.json'), 'utf8')) as {
  books: { slug: string; displayName: string; chapters: number[] }[];
};
const CANON = manifest.books.map(b => b.slug);
const CHAPTERS = new Map(manifest.books.map(b => [b.slug, b.chapters]));

// ---------------------------------------------------------------------------
// Book names as printed in the 1883 edition (running headers and titles).
// Keys are normalised (lowercase, letters only). Numbered books carry the
// number as a suffix; ordinals in titles ("YESIBILI KA JOHANE") map to it.
// ---------------------------------------------------------------------------
const NAMES: Record<string, string> = {
  genesise: 'genesis', eksodusi: 'exodus', levi: 'leviticus', imibalo: 'numbers', duteronomi: 'deuteronomy',
  joshua: 'joshua', abahluli: 'judges', yabahluli: 'judges', rute: 'ruth',
  samueli1: '1-samuel', samueli2: '2-samuel', amakosi1: '1-kings', amakosi2: '2-kings', yamakosi1: '1-kings', yamakosi2: '2-kings',
  izikronike1: '1-chronicles', izikronike2: '2-chronicles', yezikronike1: '1-chronicles', yezikronike2: '2-chronicles',
  ezra: 'ezra', nehemia: 'nehemiah', esetere: 'esther', jobe: 'job',
  izihlabelelo: 'psalms', amazwiahlakanipileyo: 'proverbs', umshumayeli: 'ecclesiastes', isihlabelelosikasolomona: 'song-of-solomon',
  isaya: 'isaiah', jeremia: 'jeremiah', isililo: 'lamentations', isililosikajeremia: 'lamentations', hezekeli: 'ezekiel', danyeli: 'daniel',
  hosea: 'hosea', joeli: 'joel', amosi: 'amos', obadia: 'obadiah', jona: 'jonah', mika: 'micah', nahume: 'nahum', habakuki: 'habakkuk',
  zefania: 'zephaniah', hagai: 'haggai', zekaria: 'zechariah', malaki: 'malachi',
  mateu: 'matthew', marko: 'mark', luka: 'luke', johane: 'john', imisebenzi: 'acts', imisebenzizabapostoli: 'acts',
  abaseroma: 'romans', seroma: 'romans', abasekorinte1: '1-corinthians', abasekorinte2: '2-corinthians', sekorinte1: '1-corinthians', sekorinte2: '2-corinthians',
  abasegalatia: 'galatians', segalatia: 'galatians', abasefesu: 'ephesians', sefesu: 'ephesians', abasefilipi: 'philippians', sefilipi: 'philippians',
  abasekolose: 'colossians', sekolose: 'colossians', abasetesalonika1: '1-thessalonians', abasetesalonika2: '2-thessalonians', setesalonika1: '1-thessalonians', setesalonika2: '2-thessalonians',
  utimote1: '1-timothy', utimote2: '2-timothy', kutimote1: '1-timothy', kutimote2: '2-timothy', titusi: 'titus', kutitusi: 'titus',
  filemone: 'philemon', kufilemone: 'philemon', amaheberu: 'hebrews', jakobe: 'james', petro1: '1-peter', petro2: '2-peter',
  johane1: '1-john', johane2: '2-john', johane3: '3-john', juda: 'jude', isambulo: 'revelation',
};
const NAME_KEYS = Object.keys(NAMES);
const STOP = new Set(['incwadi', 'ka', 'e', 'tiwa', 'sika', 'wa', 'ya', 'na', 'kwa', 'inewadi', 'incwadl', 'yabapostoli']);
const ORDINAL: Record<string, number> = { yokuqala: 1, yokugala: 1, yesibili: 2, yesitatu: 3, yesithathu: 3 };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Roman/arabic ordinal token as the OCR renders it ("I.", "II.", "TI.", "JJ.", "1.") → 1/2/3. */
function ordinalToken(t: string): number | null {
  const s = t.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!s || s.length > 3) return null;
  if (/^(III|3)$/.test(s)) return 3;
  if (/^(II|2|TI|JI|IL|IM|JJ|TL|LL|H|U|W|N)$/.test(s)) return 2;
  if (/^(I|1|T|J|L)$/.test(s)) return 1;
  return null;
}

/** Best slug for a printed name, or null. Tolerates OCR damage proportional to the name's length. */
function slugForName(raw: string, number: number | null): string | null {
  const words = raw.split(/\s+/).map(norm).filter(w => w && !STOP.has(w));
  if (!words.length) return null;
  let ordinal = number;
  const keep: string[] = [];
  for (const w of words) {
    if (ORDINAL[w] !== undefined) { ordinal = ORDINAL[w]; continue; }
    keep.push(w);
  }
  if (!keep.length) return null;
  const candidates = [keep.join(''), keep[keep.length - 1], keep[0]];
  let best: { slug: string; d: number } | null = null;
  for (const c of candidates) {
    for (const stripped of [c, c.replace(/^(u|i)/, ''), c.replace(/^(aba|ama|izi|isi|ku|se)/, '')]) {
      if (stripped.length < 3) continue;
      for (const key of NAME_KEYS) {
        const keyNum = key.match(/[123]$/)?.[0];
        const keyName = keyNum ? key.slice(0, -1) : key;
        if (keyNum && ordinal && Number(keyNum) !== ordinal) continue;
        if (keyNum && !ordinal) continue;
        if (!keyNum && ordinal && !/^(johane|samueli|amakosi|yamakosi)$/.test(keyName)) { /* un-numbered key with an ordinal: only allow when no numbered variant exists */ }
        const d = lev(stripped, keyName);
        const allowed = keyName.length >= 12 ? 4 : keyName.length >= 8 ? 3 : keyName.length >= 5 ? 2 : 1;
        if (d <= allowed && (!best || d < best.d)) best = { slug: NAMES[key], d };
      }
    }
  }
  return best?.slug ?? null;
}

// ---------------------------------------------------------------------------
// Line classifiers
// ---------------------------------------------------------------------------

/** "ISAHLUKO 12." / "ISIHLABELELO 3" (with OCR damage) → chapter number. */
function chapterMarker(line: string): number | null {
  const m = line.match(/^([A-Z]{5,14})\s+([0-9]{1,3})\.?\s*$/);
  if (!m) return null;
  const w = m[1].toLowerCase();
  if (lev(w, 'isahluko') <= 3 || lev(w, 'isihlabelelo') <= 3) return Number(m[2]);
  return null;
}

/** "UGENESISE, 3." / "I. AMAKOSI, 12." → slug (a page header: the book is on this page). */
function runningHeader(line: string): string | null {
  const m = line.match(/^([A-Z0-9][A-Z0-9 .]{2,30}?),\s*([0-9]{1,3})\.?\s*$/);
  if (!m) return null;
  const tokens = m[1].trim().split(/\s+/);
  let number: number | null = null;
  if (tokens.length > 1) { const o = ordinalToken(tokens[0]); if (o) { number = o; tokens.shift(); } }
  return slugForName(tokens.join(' '), number);
}

/** "UEKSODUSI." / "INCWADI KA JONA." / "INCWADI YESIBILI KA JOHANE." → slug; also "OBADIA." (single-chapter running header). */
function titleLine(line: string): string | null {
  if (!/^[A-Z][A-Z .]{3,40}\.?\s*$/.test(line) || /\d/.test(line)) return null;
  if (chapterMarker(line) !== null) return null;
  const tokens = line.replace(/\./g, ' ').trim().split(/\s+/);
  let number: number | null = null;
  if (tokens.length > 1) { const o = ordinalToken(tokens[0]); if (o && tokens[0].length <= 3) { number = o; tokens.shift(); } }
  return slugForName(tokens.join(' '), number);
}

/** Cross-reference furniture: "Luk. 2. 36, 7." "Gen. 10. 30. & 25. 6. 1 Ama. 4. 30." */
function isCrossRef(line: string): boolean {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 2 || tokens.length > 24) return false;
  let digits = 0, alpha = 0;
  for (const t of tokens) {
    if (/^\d+[.,;:)\]]*$/.test(t)) { digits++; continue; }
    if (/^[A-Za-z]{1,5}[.,]?$/.test(t)) { alpha++; continue; }
    if (/^(&|-|—|\||\d+\.\d+[.,]?)$/.test(t)) continue;
    return false;
  }
  // Abbreviated book names and numbers only; real verse lines have longer words.
  return digits >= 2 && (digits >= alpha || digits >= 3);
}

const isNoise = (line: string) => {
  const letters = (line.match(/[A-Za-z]/g) || []).length;
  if (letters < 2) return true;                       // page numbers, stray marks
  if (/^\(?Zulu Bible/i.test(line)) return true;
  // Short capitalised fragments are scan debris ("T AA", "e2."); a short lowercase
  // word ("ku.", "na") is the tail of a hyphenated word or a real word — keep it.
  if (letters <= 4 && line.length <= 6 && !/^[a-z]{2,}/.test(line.trim())) return true;
  // A short line with no lowercase letters at all ("NGI UYE", "E i", "T AA") is scan
  // debris; real capitals-only lines (headings, titles) were handled before this.
  if (!/[a-z]/.test(line) && line.trim().split(/\s+/).length <= 3) return true;
  return false;
};

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

type Verses = Map<string, Map<string, string>>; // slug -> "c:v" -> text
const out: Verses = new Map();
const put = (slug: string, c: number, v: number, text: string) => {
  if (!out.has(slug)) out.set(slug, new Map());
  const book = out.get(slug)!;
  const key = `${c}:${v}`;
  const prev = book.get(key);
  book.set(key, prev ? joinText(prev, text) : text);
};
const joinText = (a: string, b: string) => (a.endsWith('-') ? a.slice(0, -1) + b : `${a} ${b}`).replace(/\s+/g, ' ').trim();

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

let bookIdx = -1;          // index into CANON
let pending: number | null = null; // a later book seen in a page header/title: switch on its first chapter
let chapter = 0;
let verse = 0;
let switchedByTitle = false;
const events: string[] = [];
const trace: string[] = [];
const T = (i: number, what: string) => trace.push(`${i + 1}	${bookSlug()}	${chapter}:${verse}	${what}`);

const bookSlug = () => (bookIdx >= 0 ? CANON[bookIdx] : null);
const expectedChapters = () => (bookSlug() ? CHAPTERS.get(bookSlug()!)!.length : 0);
const expectedVerses = (c: number) => (bookSlug() ? CHAPTERS.get(bookSlug()!)![c - 1] ?? 0 : 0);

const enterBook = (idx: number, why: string) => {
  if (idx === bookIdx) return;
  bookIdx = idx;
  chapter = 0;
  verse = 0;
  pending = null;
  events.push(`${CANON[idx]} ← ${why}`);
  // Single-chapter books never print a chapter heading.
  if (expectedChapters() === 1) chapter = 1;
};

const setPending = (slug: string) => {
  const idx = CANON.indexOf(slug);
  if (idx < 0) return;
  if (idx === bookIdx) { pending = null; return; }
  if (idx > bookIdx && idx <= bookIdx + 3) pending = idx;          // only ever move forward, and not by much
  else if (bookIdx < 0) pending = idx;
};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].replace(/\s+$/, '');
  if (!line.trim()) continue;

  // Chapter heading
  const cm = chapterMarker(line.trim());
  if (cm !== null) {
    const atEnd = chapter >= expectedChapters();
    const nearEnd = chapter >= expectedChapters() - 2;
    if (bookIdx < 0) {
      enterBook(0, 'first chapter');
      chapter = 1;
    } else if ((atEnd && cm <= 2) || (cm === 1 && chapter > 0 && (nearEnd || (pending !== null && chapter >= expectedChapters() - 3)))) {
      // The book is finished (or a fresh "1" arrives at its tail): this heading belongs to the next book.
      enterBook(pending !== null ? pending : Math.min(bookIdx + 1, CANON.length - 1), `heading ${cm} after chapter ${chapter}`);
      chapter = cm >= 1 && cm <= expectedChapters() ? cm : 1;
    } else if (chapter === 0) {
      chapter = cm >= 1 && cm <= expectedChapters() ? cm : 1;
    } else {
      // Headings run in sequence; a number more than one step away from the expected one is an OCR misread.
      const next = chapter + 1;
      chapter = Math.abs(cm - next) <= 1 && cm >= 1 && cm <= expectedChapters() ? cm : Math.min(next, expectedChapters());
      if (pending !== null && !nearEnd) pending = null; // a page header we cannot trust this early in the book
    }
    verse = 0;
    switchedByTitle = false;
    T(i, `marker ${cm} -> chapter ${chapter}`);
    continue;
  }

  // Page header: the named book is on this page (may still be the previous book's tail)
  const rh = runningHeader(line.trim());
  if (rh) { setPending(rh); continue; }

  // Book title in the body
  const tl = titleLine(line.trim());
  if (tl) {
    const idx = CANON.indexOf(tl);
    const explicit = /INCWADI|\bKA\b|SIKA/.test(line) || /^U[A-Z]+\.$/.test(line.trim());
    if (idx > bookIdx && idx <= bookIdx + 3 && (explicit || CHAPTERS.get(tl)!.length === 1 && pending === idx)) {
      // A bare single-chapter name at page top is a header; wait for "KA OBADIA." or a verse restart unless nothing else will come.
      if (explicit) { enterBook(idx, `title "${line.trim()}"`); switchedByTitle = true; }
      else pending = idx;
    } else if (idx >= 0) setPending(tl);
    continue;
  }

  if (bookIdx < 0) continue;
  if (isCrossRef(line) || isNoise(line)) continue;

  // A chapter starting without its heading: the verse count starts over, or the
  // drop-cap first word of verse 1 appears ("TIXO wa kumbula uNoa"). Only trusted
  // when the current chapter is nearly complete.
  const vm = line.match(/^\s*([0-9]{1,3})[.,)\]]?\s+(.+)$/);
  // Small caps for JEHOVA / JESU / TIXO also occur mid-verse, so a drop cap alone
  // only counts once every verse of the current chapter has been seen.
  const dropCap = !vm && /^[A-Z]{3,}[A-Z'’]*\s+[a-z]/.test(line.trim()) && verse >= expectedVerses(chapter);
  const nearChapterEnd = verse >= 3 && verse >= expectedVerses(chapter) - 3;
  const n = vm ? Number(vm[1]) : dropCap ? 1 : 0;
  if (n >= 1 && n <= 2 && nearChapterEnd && chapter > 0 && !switchedByTitle) {
    // Verse 1 was printed without a number and got glued onto the previous verse: split it off at its drop cap.
    const prevSlug = bookSlug()!, prevKey = `${chapter}:${verse}`;
    let recovered: string | null = null;
    if (n === 2) {
      const prevText = out.get(prevSlug)?.get(prevKey) ?? '';
      const m = prevText.match(/^(.*\S)\s+([A-Z]{3,}[A-Z'’]*\s+[a-z].*)$/);
      if (m) { out.get(prevSlug)!.set(prevKey, m[1]); recovered = m[2]; }
    }
    const nearBookEnd = chapter >= expectedChapters() - 2;
    if (pending !== null && nearBookEnd) enterBook(pending, `${dropCap ? 'drop cap' : 'verse restart'}`);
    else if (chapter >= expectedChapters() && bookIdx + 1 < CANON.length) enterBook(bookIdx + 1, `${dropCap ? 'drop cap' : 'verse restart'} after last chapter`);
    else if (chapter < expectedChapters()) chapter = chapter + 1; // missed heading
    else { /* nothing sensible to do */ }
    if (chapter === 0 || expectedChapters() === 1) chapter = 1;
    verse = n;
    const text = vm ? vm[2] : line.trim();
    T(i, `${dropCap ? 'DROPCAP' : 'RESTART'} n=${n} "${text.slice(0, 40)}"`);
    if (recovered) put(bookSlug()!, chapter, 1, recovered);
    put(bookSlug()!, chapter, verse, text);
    continue;
  }
  if (switchedByTitle && (dropCap || (vm && n <= 2))) {
    // First words of a book that was announced by its title line.
    switchedByTitle = false;
    if (chapter === 0) chapter = 1;
    verse = n;
    put(bookSlug()!, chapter, verse, vm ? vm[2] : line.trim());
    continue;
  }

  // Verse start?
  if (vm) {
    const text = vm[2];
    if (chapter === 0) chapter = 1;
    if (n === verse + 1 || (n > verse + 1 && n <= verse + 3 && n <= expectedVerses(chapter) + 2) || (verse === 0 && n <= 3)) {
      verse = n;
      put(bookSlug()!, chapter, verse, text);
      continue;
    }
    // A number that is not the next verse: probably a misread digit or reference — keep the words.
    if (verse > 0) put(bookSlug()!, chapter, verse, text);
    continue;
  }

  // Continuation text
  if (chapter === 0) chapter = 1;
  if (verse === 0) { verse = 1; put(bookSlug()!, chapter, 1, line.trim()); continue; }
  put(bookSlug()!, chapter, verse, line.trim());
}

// ---------------------------------------------------------------------------
// Write + report
// ---------------------------------------------------------------------------

/**
 * Strips cross-reference debris that OCR glued onto verse text: runs of
 * abbreviated book names and numbers ("Luk. 6. 20. Izihl. 51. 17.") and the
 * stray capital-letter fragments that follow them ("E Aa D E AZ.").
 */
function cleanVerse(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  const refTok = (t: string) => /^(\d+[.,;:)\]]*|[A-Z][a-z]{0,5}\.|&|!|\||=\?|—|-)$/.test(t);
  // Only capitalised fragments count as trailing junk; short lowercase words are ordinary isiZulu.
  const junkTok = (t: string) => /^[A-Z][A-Za-z]{0,3}[.,;:!]?$/.test(t) && !/^(U|I|A|E|O)[a-z]/.test(t);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    // A run of 3+ reference-looking tokens with at least two numbers is a citation
    let j = i, digits = 0;
    while (j < tokens.length && refTok(tokens[j])) { if (/^\d/.test(tokens[j])) digits++; j++; }
    if (j - i >= 3 && digits >= 2) { i = j; continue; }
    out.push(tokens[i]);
    i++;
  }
  // Trailing junk: capital-letter fragments and abbreviations after the last real word.
  // Only a run that carries a number or an ALL-CAPS fragment is debris; "… uJakobe." or
  // "… Ameni." look like abbreviations but are the verse's own last word.
  const popped: string[] = [];
  while (out.length > 3) {
    const last = out[out.length - 1];
    if (refTok(last) || junkTok(last) || /^[A-Z]{1,4}[A-Z.\]]*$/.test(last)) popped.unshift(out.pop()!);
    else break;
  }
  if (popped.length && !popped.some(t => /\d/.test(t) || /^[A-Z]{2,}/.test(t))) out.push(...popped);
  return out.join(' ').replace(/\s*\|\s*/g, ' ').replace(/\s+([.,;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const rows: string[] = ['# slug\tchapter\tverse\ttext — parsed from the 1883 isiZulu Bible OCR (archive.org/details/zulu-bible)'];
let found = 0, expected = 0, extra = 0;
const perBook: string[] = [];
for (const slug of CANON) {
  const chapters = CHAPTERS.get(slug)!;
  const book = out.get(slug);
  let bFound = 0, bExpected = 0;
  chapters.forEach((n, ci) => {
    bExpected += n;
    for (let v = 1; v <= n; v++) {
      const t = book?.get(`${ci + 1}:${v}`);
      const cleaned = t ? cleanVerse(t.replace(/\t/g, ' ')) : '';
      if (cleaned.length > 0) { bFound++; rows.push(`${slug}\t${ci + 1}\t${v}\t${cleaned}`); }
    }
  });
  if (book) for (const k of book.keys()) { const [c, v] = k.split(':').map(Number); if (c > chapters.length || v > (chapters[c - 1] ?? 0)) extra++; }
  found += bFound; expected += bExpected;
  perBook.push(`${slug.padEnd(18)} ${String(bFound).padStart(5)}/${String(bExpected).padEnd(5)} ${(100 * bFound / bExpected).toFixed(0).padStart(3)}%${book ? '' : '  (not found)'}`);
}
fs.writeFileSync(OUT, rows.join('\n') + '\n', 'utf8');

console.log(events.slice(0, 80).join('\n'));
console.log('\n' + perBook.join('\n'));
console.log(`\nVerses found: ${found}/${expected} (${(100 * found / expected).toFixed(1)}%), ${extra} outside the KJV versification (dropped)`);
console.log(`Wrote ${OUT}`);
fs.writeFileSync(OUT + '.trace.txt', trace.join('\n') + '\n', 'utf8');
