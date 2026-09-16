// Stage the translations that are kept out of git (copyrighted texts) into
// .texts-hosting/ so `firebase deploy --only hosting` publishes just those
// files to https://scripturecomix.web.app/data/... The app falls back to that
// origin whenever a book is missing from the deployed bundle
// (see services/scriptureStore.ts).
//
//   npm run publish:texts
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'public/data';
const OUT = '.texts-hosting';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let files = 0;
const staged = [];
for (const tradition of readdirSync(SRC)) {
  const manifestPath = join(SRC, tradition, 'manifest.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const t of manifest.translations ?? []) {
    if (t.isPublicDomain !== false) continue; // public-domain texts ship with the app bundle
    const dir = join(SRC, tradition, t.id);
    if (!existsSync(dir)) {
      console.warn(`skip ${tradition}/${t.id}: not generated locally`);
      continue;
    }
    const dest = join(OUT, 'data', tradition, t.id);
    cpSync(dir, dest, { recursive: true, filter: (p) => statSync(p).isDirectory() || p.endsWith('.json') });
    const n = readdirSync(dest).length;
    files += n;
    staged.push(`${tradition}/${t.id} (${n} books)`);
  }
}
console.log(`Staged ${files} book files into ${OUT}/:\n  ${staged.join('\n  ')}`);
if (!files) process.exit(1);
