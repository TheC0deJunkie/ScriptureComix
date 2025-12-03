/**
 * Node script scaffold to bulk-import public-domain canons (KJV, WEB, Enoch, etc.)
 * into the JSON shape used by `public/library/*.json`.
 *
 * Usage (from project root, after wiring real sources):
 *   npx ts-node scripts/importPublicDomainCanons.ts
 *
 * This file is intentionally minimal and does NOT ship to the browser.
 */

import { promises as fs } from 'fs';
import path from 'path';

interface LibraryJson {
  meta: {
    id: string;
    name: string;
    language: string;
    license: string;
  };
  books: Record<string, Record<string, string[]>>;
}

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'library');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeLibraryFile(id: string, data: LibraryJson) {
  await ensureDir(OUTPUT_DIR);
  const target = path.join(OUTPUT_DIR, `${id}.json`);
  await fs.writeFile(target, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${target}`);
}

async function importFromSource(id: string, meta: LibraryJson['meta']) {
  // Expects a source JSON at data/sources/<id>.json shaped as:
  // { "Genesis": { "1": ["verse1", "verse2", ...], "2": [...] }, "Exodus": { ... } }
  const sourcePath = path.join(process.cwd(), 'data', 'sources', `${id}.json`);
  const raw = await fs.readFile(sourcePath, 'utf8');
  const books = JSON.parse(raw) as Record<string, Record<string, string[]>>;
  const library: LibraryJson = { meta, books };
  await writeLibraryFile(id, library);
}

async function main() {
  // KJV
  await importFromSource('kjv', {
    id: 'kjv',
    name: 'King James Version',
    language: 'English',
    license: 'Public Domain',
  });

  // WEB (World English Bible)
  await importFromSource('web', {
    id: 'web',
    name: 'World English Bible',
    language: 'English',
    license: 'Public Domain',
  });

  // Add more public-domain canons as you download them:
  // await importFromSource('douay', { id: 'douay', name: 'Douay-Rheims', language: 'English', license: 'Public Domain' });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


