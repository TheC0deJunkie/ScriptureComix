/**
 * importZulu1893 — turn the 1893 isiZulu Bible ("The Zulu Old Version",
 * IBhayibheli Elingcwele) into per-book JSON the reader can open, and list it
 * in the Protestant manifest as a second language beside the KJV.
 *
 * STATUS (2026-09-16): no digital edition of this text was found in a form we
 * can download in bulk — eBible.org carries no Zulu edition and archive.org
 * turned up nothing under "Zulu Bible 1893" / ZULB93. The script is written
 * against the two shapes such texts usually arrive in, so that the day a
 * source is found the work is `place file → run script`:
 *
 *   1. A directory of USFM files (one per book, `\id GEN` … `\c 1` … `\v 1 …`)
 *   2. One tab-separated text file: `book<TAB>chapter<TAB>verse<TAB>text`,
 *      where `book` is a USFM code (GEN), an English name (Genesis) or one of
 *      the isiZulu names below (uGenesise).
 *
 * The 1893 text itself is old enough to be out of copyright; the *digital
 * edition* you use may not be. Confirm its licence before shipping and pass
 * it in with --copyright so it is recorded in the manifest like the others.
 *
 * Writes:
 *   public/data/protestant/zul1893/<slug>.json    keyed "chapter:verse"
 *   public/data/protestant/manifest.json          translation entry added
 *
 * Usage:
 *   npx tsx scripts/importZulu1893.ts <source dir or file> [--copyright "…"]
 *   (default source: data/sources/zul1893/ or data/sources/zul1893.txt)
 *
 * After running: open Genesis 1, pick Version → "IBhayibheli Elingcwele" and
 * choose "Also show underneath → King James Version". The existing gap repair
 * flags any verse the source is missing against the manifest's verse counts.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'public', 'data');
let OUT_DIR = path.join(DATA, 'protestant', 'zul1893');
const MANIFEST = path.join(DATA, 'protestant', 'manifest.json');

const args = process.argv.slice(2);
const copyrightIdx = args.indexOf('--copyright');
const COPYRIGHT = copyrightIdx >= 0 ? args[copyrightIdx + 1] ?? null : null;
const FLAGS = new Set(['--copyright', '--id', '--name']);
const positional = args.filter((a, i) => !FLAGS.has(a) && !(i > 0 && FLAGS.has(args[i - 1])));
const SOURCE =
  positional[0] ||
  (fs.existsSync(path.join(ROOT, 'data', 'sources', 'zul1893')) ? path.join(ROOT, 'data', 'sources', 'zul1893') : path.join(ROOT, 'data', 'sources', 'zul1893.txt'));

const flag = (name: string): string | null => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] ?? null : null; };
const TRANSLATION = {
  id: flag('--id') || 'zul1893',
  displayName: flag('--name') || 'IBhayibheli Elingcwele (isiZulu 1893)',
  language: 'zu',
  isPublicDomain: true,
  copyright: COPYRIGHT,
};
OUT_DIR = path.join(DATA, 'protestant', TRANSLATION.id);

/** USFM book code → our slug (the 66 Protestant books). */
const USFM_TO_SLUG: Record<string, string> = {
  GEN: 'genesis', EXO: 'exodus', LEV: 'leviticus', NUM: 'numbers', DEU: 'deuteronomy', JOS: 'joshua', JDG: 'judges', RUT: 'ruth',
  '1SA': '1-samuel', '2SA': '2-samuel', '1KI': '1-kings', '2KI': '2-kings', '1CH': '1-chronicles', '2CH': '2-chronicles', EZR: 'ezra', NEH: 'nehemiah',
  EST: 'esther', JOB: 'job', PSA: 'psalms', PRO: 'proverbs', ECC: 'ecclesiastes', SNG: 'song-of-solomon', ISA: 'isaiah', JER: 'jeremiah', LAM: 'lamentations',
  EZK: 'ezekiel', DAN: 'daniel', HOS: 'hosea', JOL: 'joel', AMO: 'amos', OBA: 'obadiah', JON: 'jonah', MIC: 'micah', NAM: 'nahum', HAB: 'habakkuk',
  ZEP: 'zephaniah', HAG: 'haggai', ZEC: 'zechariah', MAL: 'malachi',
  MAT: 'matthew', MRK: 'mark', LUK: 'luke', JHN: 'john', ACT: 'acts', ROM: 'romans', '1CO': '1-corinthians', '2CO': '2-corinthians', GAL: 'galatians',
  EPH: 'ephesians', PHP: 'philippians', COL: 'colossians', '1TH': '1-thessalonians', '2TH': '2-thessalonians', '1TI': '1-timothy', '2TI': '2-timothy',
  TIT: 'titus', PHM: 'philemon', HEB: 'hebrews', JAS: 'james', '1PE': '1-peter', '2PE': '2-peter', '1JN': '1-john', '2JN': '2-john', '3JN': '3-john',
  JUD: 'jude', REV: 'revelation',
};

/** isiZulu book names (as printed in the old version and its successors) → slug. Loose matching strips prefixes and case. */
const ZULU_TO_SLUG: Record<string, string> = {
  genesise: 'genesis', eksodusi: 'exodus', levitikusi: 'leviticus', numeri: 'numbers', duteronomi: 'deuteronomy',
  joshuwa: 'joshua', abahluleli: 'judges', ruthe: 'ruth', samuweli1: '1-samuel', samuweli2: '2-samuel', amakhosi1: '1-kings', amakhosi2: '2-kings',
  izikronike1: '1-chronicles', izikronike2: '2-chronicles', ezra: 'ezra', nehemiya: 'nehemiah', esteri: 'esther', jobe: 'job',
  amahubo: 'psalms', izaga: 'proverbs', umshumayeli: 'ecclesiastes', isihlabelelo: 'song-of-solomon', isaya: 'isaiah', jeremiya: 'jeremiah',
  izililo: 'lamentations', hezekeli: 'ezekiel', daniyeli: 'daniel', hoseya: 'hosea', joweli: 'joel', amose: 'amos', obadiya: 'obadiah',
  jona: 'jonah', mika: 'micah', nahume: 'nahum', habakuki: 'habakkuk', zefaniya: 'zephaniah', hagayi: 'haggai', zakariya: 'zechariah', malaki: 'malachi',
  mathewu: 'matthew', marku: 'mark', luka: 'luke', johane: 'john', izenzo: 'acts', roma: 'romans', korinte1: '1-corinthians', korinte2: '2-corinthians',
  galathiya: 'galatians', efesu: 'ephesians', filipi: 'philippians', kolose: 'colossians', thesalonika1: '1-thessalonians', thesalonika2: '2-thessalonians',
  thimothewu1: '1-timothy', thimothewu2: '2-timothy', thithu: 'titus', filemoni: 'philemon', hebheru: 'hebrews', jakobe: 'james',
  petru1: '1-peter', petru2: '2-peter', johane1: '1-john', johane2: '2-john', johane3: '3-john', juda: 'jude', isambulo: 'revelation',
};

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Map whatever a source calls a book to our slug, or null. */
function slugFor(raw: string, manifestBooks: { slug: string; displayName: string }[]): string | null {
  const code = raw.trim().toUpperCase();
  if (USFM_TO_SLUG[code]) return USFM_TO_SLUG[code];
  const n = normalise(raw);
  const byName = manifestBooks.find(b => normalise(b.displayName) === n || normalise(b.slug) === n);
  if (byName) return byName.slug;
  // "1 Samuweli" / "1Samuweli" / "uSamuweli 1" / "Samuweli wokuQala" → samuweli1
  const num = (raw.match(/\b([123])\b/) || [])[1];
  const word = n.replace(/^(u|i|ama|izi|isi|aba|um|eyoku|eyesi|eyesithathu)/, '').replace(/[123]/g, '');
  const stripped = word.replace(/^(u|i)/, '');
  for (const cand of [word + (num ?? ''), stripped + (num ?? ''), word, stripped]) {
    if (ZULU_TO_SLUG[cand]) return ZULU_TO_SLUG[cand];
  }
  return null;
}

type Books = Map<string, Record<string, string>>;

const put = (books: Books, slug: string, chapter: number, verse: number, text: string) => {
  if (!books.has(slug)) books.set(slug, {});
  const book = books.get(slug)!;
  const key = `${chapter}:${verse}`;
  const clean = text.replace(/\s+/g, ' ').trim();
  book[key] = book[key] ? `${book[key]} ${clean}` : clean;
};

/** USFM: strip footnotes/cross-refs and inline markers, keep the words. */
const stripUsfm = (s: string) =>
  s
    .replace(/\\f\s.*?\\f\*/g, '')
    .replace(/\\x\s.*?\\x\*/g, '')
    .replace(/\\[a-z]+\d*\*/g, '')
    .replace(/\\\+?[a-z]+\d*\s?/g, '')
    .replace(/\|[^|]*$/g, '')
    .trim();

function parseUsfm(text: string, books: Books, manifestBooks: { slug: string; displayName: string }[], fileName: string) {
  let slug: string | null = null;
  let chapter = 0;
  let verse = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const id = line.match(/^\\id\s+(\S+)/);
    if (id) { slug = slugFor(id[1], manifestBooks); if (!slug) console.warn(`  ${fileName}: unknown book code ${id[1]} — skipped`); chapter = 0; verse = 0; continue; }
    if (!slug) continue;
    const c = line.match(/^\\c\s+(\d+)/);
    if (c) { chapter = Number(c[1]); verse = 0; continue; }
    if (!chapter) continue;
    // One line may hold several \v markers
    const parts = line.split(/(?=\\v\s+\d+)/);
    for (const part of parts) {
      const v = part.match(/^\\v\s+(\d+)(?:-\d+)?\s*(.*)$/);
      if (v) { verse = Number(v[1]); put(books, slug, chapter, verse, stripUsfm(v[2])); continue; }
      if (/^\\(p|q\d?|m|pi\d?|b|nb|li\d?)\b/.test(part) && verse) { const rest = stripUsfm(part); if (rest) put(books, slug, chapter, verse, rest); continue; }
      if (/^\\(s\d?|r|ms\d?|mr|d|sp|h|toc\d|mt\d?|ide|rem|usfm|cl)\b/.test(part)) continue; // headings and metadata
      if (verse && !part.startsWith('\\')) put(books, slug, chapter, verse, part);
    }
  }
}

function parseTabbed(text: string, books: Books, manifestBooks: { slug: string; displayName: string }[]) {
  const unknown = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.startsWith('#')) continue;
    const cols = raw.split('\t');
    if (cols.length < 4) continue;
    const [b, c, v, ...rest] = cols;
    const slug = slugFor(b, manifestBooks);
    if (!slug) { unknown.add(b); continue; }
    const chapter = Number(c), verse = Number(v);
    if (!Number.isFinite(chapter) || !Number.isFinite(verse)) continue;
    put(books, slug, chapter, verse, rest.join('\t'));
  }
  if (unknown.size) console.warn('Unknown book names (add them to ZULU_TO_SLUG):', Array.from(unknown).join(', '));
}

const chapterCounts = (verses: Record<string, string>): number[] => {
  const counts: number[] = [];
  for (const k of Object.keys(verses)) {
    const [c, v] = k.split(':').map(Number);
    counts[c - 1] = Math.max(counts[c - 1] || 0, v);
  }
  for (let i = 0; i < counts.length; i++) counts[i] = counts[i] || 0;
  return counts;
};

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p: string, v: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8');
};

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}\nPut the isiZulu 1893 text there (a USFM folder or a tab-separated file) and run again.`);
    process.exit(1);
  }
  const manifest = readJson(MANIFEST);
  const manifestBooks = manifest.books as { slug: string; displayName: string; chapters: number[] }[];
  const books: Books = new Map();

  if (fs.statSync(SOURCE).isDirectory()) {
    const files = fs.readdirSync(SOURCE).filter(f => /\.(usfm|sfm|txt)$/i.test(f)).sort();
    if (!files.length) { console.error(`No .usfm/.sfm/.txt files in ${SOURCE}`); process.exit(1); }
    for (const f of files) parseUsfm(fs.readFileSync(path.join(SOURCE, f), 'utf8'), books, manifestBooks, f);
  } else {
    const text = fs.readFileSync(SOURCE, 'utf8');
    if (/^\\id\s/m.test(text)) parseUsfm(text, books, manifestBooks, path.basename(SOURCE));
    else parseTabbed(text, books, manifestBooks);
  }

  if (!books.size) { console.error('Nothing parsed — is the source in one of the two supported shapes?'); process.exit(1); }
  console.log(`Parsed ${books.size} books`);
  const missing = manifestBooks.map(b => b.slug).filter(s => !books.has(s));
  if (missing.length) console.warn(`Missing books (${missing.length}):`, missing.join(', '));

  // Verse counts against the manifest — the reader's gap repair will flag these too, but say it here
  let short = 0;
  for (const [slug, verses] of books) {
    const expected = manifestBooks.find(b => b.slug === slug)?.chapters ?? [];
    const got = chapterCounts(verses);
    expected.forEach((n, i) => { if ((got[i] || 0) < n) short++; });
    writeJson(path.join(OUT_DIR, `${slug}.json`), verses);
  }
  if (short) console.warn(`${short} chapter(s) have fewer verses than the KJV versification — the reader will show "—" for those in the companion line and gap repair will flag them.`);

  manifest.translations = [...manifest.translations.filter((t: { id: string }) => t.id !== TRANSLATION.id), TRANSLATION];
  writeJson(MANIFEST, manifest);
  console.log(`Protestant: ${books.size} books written to public/data/protestant/${TRANSLATION.id}, manifest lists "${TRANSLATION.displayName}" (language zu${COPYRIGHT ? `, copyright recorded` : ', copyright: null — confirm the edition is public domain'})`);
}

main();
