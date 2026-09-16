/**
 * importDouayRheims — turn the public-domain Douay-Rheims Bible (Project
 * Gutenberg #8300, 1899 American Edition) into per-book JSON.
 *
 * Writes:
 *   public/data/catholic/drb/<slug>.json          all 73 books
 *   public/data/ethiopian/kjv/<deutero slug>.json  the 7 deuterocanonical books
 *                                                  (replacing copyrighted NABRE copies)
 * and updates both manifests (translation list + chapter verse counts).
 *
 * Usage:
 *   npx tsx scripts/importDouayRheims.ts [path/to/pg8300.txt]
 *   (default source: data/sources/douay-rheims-pg8300.txt — download from
 *    https://www.gutenberg.org/files/8300/8300-0.txt)
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'public', 'data');
const SOURCE = process.argv[2] || path.join(ROOT, 'data', 'sources', 'douay-rheims-pg8300.txt');

// Douay-Rheims book title → the slug used by the app's canon manifests
const DRB_TO_SLUG: Record<string, string> = {
  'Genesis': 'genesis', 'Exodus': 'exodus', 'Leviticus': 'leviticus', 'Numbers': 'numbers', 'Deuteronomy': 'deuteronomy',
  'Josue': 'joshua', 'Judges': 'judges', 'Ruth': 'ruth',
  '1 Kings': '1-samuel', '2 Kings': '2-samuel', '3 Kings': '1-kings', '4 Kings': '2-kings',
  '1 Paralipomenon': '1-chronicles', '2 Paralipomenon': '2-chronicles',
  '1 Esdras': 'ezra', '2 Esdras': 'nehemiah',
  'Tobias': 'tobit', 'Judith': 'judith', 'Esther': 'esther', 'Job': 'job', 'Psalms': 'psalms',
  'Proverbs': 'proverbs', 'Ecclesiastes': 'ecclesiastes', 'Canticle of Canticles': 'song-of-solomon',
  'Wisdom': 'wisdom', 'Ecclesiasticus': 'sirach',
  'Isaias': 'isaiah', 'Jeremias': 'jeremiah', 'Lamentations': 'lamentations', 'Baruch': 'baruch',
  'Ezechiel': 'ezekiel', 'Daniel': 'daniel', 'Osee': 'hosea', 'Joel': 'joel', 'Amos': 'amos', 'Abdias': 'obadiah',
  'Jonas': 'jonah', 'Micheas': 'micah', 'Nahum': 'nahum', 'Habacuc': 'habakkuk', 'Sophonias': 'zephaniah',
  'Aggeus': 'haggai', 'Zacharias': 'zechariah', 'Malachias': 'malachi',
  '1 Machabees': '1-maccabees', '2 Machabees': '2-maccabees',
  'Matthew': 'matthew', 'Mark': 'mark', 'Luke': 'luke', 'John': 'john', 'Acts': 'acts', 'Romans': 'romans',
  '1 Corinthians': '1-corinthians', '2 Corinthians': '2-corinthians', 'Galatians': 'galatians', 'Ephesians': 'ephesians',
  'Philippians': 'philippians', 'Colossians': 'colossians', '1 Thessalonians': '1-thessalonians', '2 Thessalonians': '2-thessalonians',
  '1 Timothy': '1-timothy', '2 Timothy': '2-timothy', 'Titus': 'titus', 'Philemon': 'philemon', 'Hebrews': 'hebrews',
  'James': 'james', '1 Peter': '1-peter', '2 Peter': '2-peter', '1 John': '1-john', '2 John': '2-john', '3 John': '3-john',
  'Jude': 'jude', 'Apocalypse': 'revelation',
};

const DEUTERO = ['tobit', 'judith', '1-maccabees', '2-maccabees', 'wisdom', 'sirach', 'baruch'];

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p: string, v: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8');
};

function parse(text: string): Map<string, Record<string, string>> {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => /^\*\*\* START OF/.test(l));
  const end = lines.findIndex(l => /^\*\*\* END OF/.test(l));
  const body = lines.slice(start + 1, end > 0 ? end : undefined);

  const books = new Map<string, Record<string, string>>();
  let currentBook: string | null = null;
  let currentKey: string | null = null;

  const flushLine = (l: string) => {
    if (!currentBook || !currentKey) return;
    const book = books.get(currentBook)!;
    book[currentKey] = (book[currentKey] + ' ' + l.trim()).replace(/\s+/g, ' ').trim();
  };

  for (const raw of body) {
    const line = raw.replace(/\s+$/, '');
    const chapterHeader = line.match(/^([A-Za-z0-9 ]+?) Chapter (\d+)$/);
    if (chapterHeader && DRB_TO_SLUG[chapterHeader[1]]) {
      currentBook = DRB_TO_SLUG[chapterHeader[1]];
      if (!books.has(currentBook)) books.set(currentBook, {});
      currentKey = null;
      continue;
    }
    const verse = line.match(/^(\d+):(\d+)\.\s*(.*)$/);
    if (verse && currentBook) {
      currentKey = `${verse[1]}:${verse[2]}`;
      const book = books.get(currentBook)!;
      book[currentKey] = verse[3].trim();
      continue;
    }
    if (!line.trim()) {
      currentKey = null; // blank line ends a verse (commentary paragraphs follow)
      continue;
    }
    if (currentKey) flushLine(line);
  }
  return books;
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

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}\nDownload https://www.gutenberg.org/files/8300/8300-0.txt to that path.`);
    process.exit(1);
  }
  const books = parse(fs.readFileSync(SOURCE, 'utf8'));
  console.log(`Parsed ${books.size} books`);
  const missing = Object.values(DRB_TO_SLUG).filter(s => !books.has(s));
  if (missing.length) console.warn('Missing books:', missing.join(', '));

  // 1. Catholic: write every book, add the translation, refresh chapter counts
  const catholicManifestPath = path.join(DATA, 'catholic', 'manifest.json');
  const catholic = readJson(catholicManifestPath);
  let written = 0;
  // The Catholic manifest may spell a slug differently (e.g. song-of-songs)
  const ALIASES: Record<string, string[]> = { 'song-of-solomon': ['song-of-songs', 'canticle-of-canticles'] };
  for (const [slug, verses] of books) {
    const target =
      catholic.books.some((b: any) => b.slug === slug)
        ? slug
        : (ALIASES[slug] || []).find(a => catholic.books.some((b: any) => b.slug === a)) || slug;
    writeJson(path.join(DATA, 'catholic', 'drb', `${target}.json`), verses);
    written++;
    const book = catholic.books.find((b: any) => b.slug === target);
    if (book) book.chapters = chapterCounts(verses);
    else console.warn(`  catholic manifest has no book "${slug}" — file written but not listed`);
  }
  const drbMeta = {
    id: 'drb',
    displayName: 'Douay-Rheims (1899 American Edition)',
    isPublicDomain: true,
    copyright: null,
  };
  catholic.translations = [drbMeta, ...catholic.translations.filter((t: any) => t.id !== 'drb')];
  writeJson(catholicManifestPath, catholic);
  console.log(`Catholic: ${written} books written to public/data/catholic/drb, manifest updated`);

  // 2. Ethiopian: replace the 7 NABRE-copied deuterocanonical books, relabel the translation honestly
  const ethManifestPath = path.join(DATA, 'ethiopian', 'manifest.json');
  const eth = readJson(ethManifestPath);
  for (const slug of DEUTERO) {
    const verses = books.get(slug);
    if (!verses) continue;
    writeJson(path.join(DATA, 'ethiopian', 'kjv', `${slug}.json`), verses);
    const book = eth.books.find((b: any) => b.slug === slug);
    if (book) book.chapters = chapterCounts(verses);
  }
  const ethTr = eth.translations.find((t: any) => t.id === 'kjv');
  if (ethTr) {
    ethTr.displayName = 'KJV + Douay-Rheims (public domain)';
    ethTr.isPublicDomain = true;
    ethTr.copyright = null;
  }
  writeJson(ethManifestPath, eth);
  console.log(`Ethiopian: ${DEUTERO.length} deuterocanonical books replaced with Douay-Rheims text, manifest relabelled`);
}

main();
