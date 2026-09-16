/**
 * importYusufAli — replace the Quran translation with Abdullah Yusuf Ali's
 * public-domain 1934 English translation (via tanzil.net / quran-api).
 *
 * The previous data was a footnoted modern translation mislabelled as
 * Yusuf Ali. This writes the real thing with standard (Kufic) ayah numbering:
 * Al-Fatiha has 7 ayahs with the Basmala as ayah 1, 6236 ayahs in total.
 *
 * Usage:
 *   npx tsx scripts/importYusufAli.ts [path/to/eng-abdullahyusufal.json]
 *   (default: data/sources/quran-yusufali-tanzil.json — from
 *    https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/eng-abdullahyusufal.json)
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'public', 'data');
const SOURCE = process.argv[2] || path.join(ROOT, 'data', 'sources', 'quran-yusufali-tanzil.json');

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p: string, v: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8');
};

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    process.exit(1);
  }
  const rows: { chapter: number; verse: number; text: string }[] = readJson(SOURCE).quran;
  const manifestPath = path.join(DATA, 'quran', 'manifest.json');
  const manifest = readJson(manifestPath);
  if (manifest.books.length !== 114) throw new Error('Quran manifest must list 114 surahs in order');

  const bySurah = new Map<number, Record<string, string>>();
  for (const r of rows) {
    if (!bySurah.has(r.chapter)) bySurah.set(r.chapter, {});
    bySurah.get(r.chapter)![String(r.verse)] = r.text.trim();
  }

  let total = 0;
  for (let n = 1; n <= 114; n++) {
    const book = manifest.books[n - 1];
    const verses = bySurah.get(n);
    if (!verses) throw new Error(`Surah ${n} missing from source`);
    const count = Object.keys(verses).length;
    writeJson(path.join(DATA, 'quran', 'yusuf-ali', `${book.slug}.json`), verses);
    book.chapters = [count];
    total += count;
  }
  manifest.translations = [
    {
      id: 'yusuf-ali',
      displayName: 'Abdullah Yusuf Ali (1934)',
      isPublicDomain: true,
      copyright: null,
    },
    ...manifest.translations.filter((t: any) => t.id !== 'yusuf-ali'),
  ];
  delete manifest.basmala; // Basmala is ayah 1:1 in standard numbering
  writeJson(manifestPath, manifest);
  console.log(`Quran: 114 surahs written, ${total} ayahs (standard numbering), manifest updated`);
}

main();
