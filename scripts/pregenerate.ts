/**
 * pregenerate — produce content ONCE so every reader gets it without AI.
 *
 * Writes into public/data (which ships with the app):
 *   quizzes/<tradition>/<translation>/<slug>/<chapter>.json   comprehension quizzes
 *   context/<tradition>/<translation>/<slug>/<chapter>.json   neutral study context
 *   <tradition>/<translation>/<slug>.json                     missing verses (whole-chapter reconstruction)
 *
 * Resumable: anything already on disk is skipped, so you can stop and rerun.
 *
 * Usage (needs GEMINI_API_KEY or VITE_GEMINI_API_KEY in .env):
 *   npx tsx scripts/pregenerate.ts --tradition protestant --translation kjv --books genesis,exodus --chapters 1-3
 *   npx tsx scripts/pregenerate.ts --tradition quran --books al-fatiha,al-baqara --what quiz,context
 *   npx tsx scripts/pregenerate.ts --tradition ethiopian --books 1-enoch --chapters 1-10 --what verses
 *
 * Options:
 *   --books      comma list of slugs, or "all"          (default: all)
 *   --chapters   "1-5", "3", or "all"                    (default: all)
 *   --what       comma list of quiz,context,verses,scenes (default: quiz,context)
 *   --style      art style for scene pictures            (default: Modern American Comic)
 *   --no-images  plan scenes but skip drawing pictures
 *   --quizzes    AI quiz sets to keep per chapter        (default: 2)
 *   --delay      ms between API calls                    (default: 1200)
 *   --dry        list the work without calling the API
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'public', 'data');

// --- .env (no dotenv dependency) ---------------------------------------------
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^['"]|['"]$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
}

// --- args --------------------------------------------------------------------
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(a.slice(2), next);
      i++;
    } else args.set(a.slice(2), 'true');
  }
}
const tradition = args.get('tradition') || 'protestant';
const what = new Set((args.get('what') || 'quiz,context').split(',').map(s => s.trim()));
const quizTarget = Number(args.get('quizzes') || 2);
const delayMs = Number(args.get('delay') || 1200);
const dry = args.get('dry') === 'true';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p: string, v: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8');
};

const parseRange = (spec: string | undefined, max: number): number[] => {
  if (!spec || spec === 'all') return Array.from({ length: max }, (_, i) => i + 1);
  const out: number[] = [];
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = a; i <= Math.min(b, max); i++) out.push(i);
  }
  return out;
};

async function main() {
  const manifestPath = path.join(DATA, tradition, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`No manifest for tradition "${tradition}"`);
  const manifest = readJson(manifestPath);
  const translation = args.get('translation') || manifest.translations[0]?.id;
  const isQuran = tradition === 'quran';

  const wantBooks = (args.get('books') || 'all').split(',').map(s => s.trim());
  const books = manifest.books.filter((b: any) => wantBooks[0] === 'all' || wantBooks.includes(b.slug));
  if (!books.length) throw new Error('No matching books');

  // Import after env is set so the service picks up the key
  const { extractChapter } = await import('../services/textLibrary');
  const { generateGroundedQuiz, generateChapterContext, reconstructVerses, generateScenePlan, generatePanelImage } = await import('../services/geminiService');
  const { ArtStyle } = await import('../types');
  const styleName = (args.get('style') || ArtStyle.COMIC_MODERN) as any;
  const styleSlug = String(styleName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let calls = 0;
  let skipped = 0;
  let failed = 0;
  const started = Date.now();

  for (const book of books) {
    const bookFile = path.join(DATA, tradition, translation, `${book.slug}.json`);
    if (!fs.existsSync(bookFile)) {
      console.warn(`  [skip] ${book.slug}: no ${translation} file`);
      continue;
    }
    const chapterCount = isQuran ? 1 : book.chapters.length;
    for (const chapter of parseRange(args.get('chapters'), chapterCount)) {
      const tag = `${tradition}/${translation}/${book.slug} ${isQuran ? '' : chapter}`.trim();
      let bookData = readJson(bookFile) as Record<string, string>;
      let verses = extractChapter(bookData, chapter, isQuran).filter(v => !/^\s*\[text pending/i.test(v.text));

      // 1. verses — whole-chapter reconstruction for placeholder chapters
      if (what.has('verses') && verses.length === 0) {
        if (dry) {
          console.log(`  [dry] verses  ${tag}`);
        } else {
          try {
            const meta = manifest.translations.find((t: any) => t.id === translation);
            const generated = await reconstructVerses({
              tradition,
              translationName: meta?.displayName || translation,
              bookName: book.displayName,
              chapter,
              verses: [],
              isQuran,
              wholeChapter: true,
            });
            calls++;
            const nums = Object.keys(generated).map(Number).filter(n => n > 0).sort((a, b) => a - b);
            if (nums.length) {
              for (const n of nums) bookData[isQuran ? String(n) : `${chapter}:${n}`] = generated[n];
              // drop the placeholder if it was the only thing there
              for (const k of Object.keys(bookData)) if (/^\s*\[text pending/i.test(bookData[k]) && nums.length) delete bookData[k];
              writeJson(bookFile, bookData);
              const ledgerPath = path.join(DATA, '_provenance.json');
              const ledger = fs.existsSync(ledgerPath) ? readJson(ledgerPath) : {};
              const bk = `${tradition}/${translation}/${book.slug}`;
              ledger[bk] = ledger[bk] || {};
              for (const n of nums) ledger[bk][isQuran ? String(n) : `${chapter}:${n}`] = 'reconstructed';
              writeJson(ledgerPath, ledger);
              if (!book.chapters[chapter - 1]) {
                book.chapters[chapter - 1] = Math.max(...nums);
                writeJson(manifestPath, manifest);
              }
              verses = extractChapter(bookData, chapter, isQuran);
              console.log(`  [ok]  verses  ${tag}: ${nums.length} verses reconstructed`);
            } else {
              console.warn(`  [!!]  verses  ${tag}: model returned nothing`);
              failed++;
            }
          } catch (err) {
            failed++;
            console.warn(`  [!!]  verses  ${tag}: ${(err as Error).message}`);
          }
          await sleep(delayMs);
        }
      }
      if (!verses.length) {
        console.warn(`  [skip] ${tag}: no text`);
        continue;
      }

      // 2. quizzes
      if (what.has('quiz')) {
        const qFile = path.join(DATA, 'quizzes', tradition, translation, book.slug, `${chapter}.json`);
        const existing: { sets: any[] } = fs.existsSync(qFile) ? readJson(qFile) : { sets: [] };
        const need = Math.max(0, quizTarget - existing.sets.length);
        if (!need) skipped++;
        for (let i = 0; i < need; i++) {
          if (dry) {
            console.log(`  [dry] quiz    ${tag} (#${existing.sets.length + i + 1})`);
            continue;
          }
          try {
            const quiz = await generateGroundedQuiz(book.displayName, chapter, verses, isQuran);
            calls++;
            if (Array.isArray(quiz?.questions) && quiz.questions.length) {
              existing.sets.push({ id: `ai-${Date.now()}`, source: 'ai', createdAt: new Date().toISOString(), questions: quiz.questions });
              writeJson(qFile, existing);
              console.log(`  [ok]  quiz    ${tag}: ${quiz.questions.length} questions (${existing.sets.length}/${quizTarget})`);
            } else {
              failed++;
              console.warn(`  [!!]  quiz    ${tag}: empty`);
            }
          } catch (err) {
            failed++;
            console.warn(`  [!!]  quiz    ${tag}: ${(err as Error).message}`);
          }
          await sleep(delayMs);
        }
      }

      // 4. scenes — plan (one call) + one picture per scene (one call each)
      if (what.has('scenes')) {
        const sDir = path.join(DATA, 'scenes', tradition, book.slug); // shared by every translation
        const planFile = path.join(sDir, `${chapter}.json`);
        let plan: any = fs.existsSync(planFile) ? readJson(planFile) : null;
        if (!plan) {
          if (dry) {
            console.log(`  [dry] scenes  ${tag}: plan`);
          } else {
            try {
              const scenes = await generateScenePlan(book.displayName, chapter, verses, tradition, isQuran);
              calls++;
              if (scenes.length) {
                plan = { scenes: scenes.map((s, i) => ({ ...s, id: `s${i + 1}` })), style: styleName, generatedAt: new Date().toISOString() };
                writeJson(planFile, plan);
                console.log(`  [ok]  scenes  ${tag}: ${scenes.length} scenes planned`);
              } else {
                failed++;
                console.warn(`  [!!]  scenes  ${tag}: empty plan`);
              }
            } catch (err) {
              failed++;
              console.warn(`  [!!]  scenes  ${tag}: ${(err as Error).message}`);
            }
            await sleep(delayMs);
          }
        } else {
          skipped++;
        }
        if (plan && !args.has('no-images')) {
          for (const s of plan.scenes) {
            const img = path.join(sDir, `${chapter}-${s.id}-${styleSlug}.png`);
            if (fs.existsSync(img)) { skipped++; continue; }
            if (dry) { console.log(`  [dry] image   ${tag} ${s.id}`); continue; }
            try {
              const url = await generatePanelImage(s.visualPrompt, styleName);
              calls++;
              const m = url.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
              if (m) {
                fs.mkdirSync(sDir, { recursive: true });
                fs.writeFileSync(img, Buffer.from(m[2], 'base64'));
                console.log(`  [ok]  image   ${tag} ${s.id} (${Math.round(m[2].length * 0.75 / 1024)} KB)`);
              } else {
                failed++;
                console.warn(`  [!!]  image   ${tag} ${s.id}: generation failed`);
              }
            } catch (err) {
              failed++;
              console.warn(`  [!!]  image   ${tag} ${s.id}: ${(err as Error).message}`);
            }
            await sleep(delayMs);
          }
        }
      }

      // 3. context
      if (what.has('context')) {
        const cFile = path.join(DATA, 'context', tradition, translation, book.slug, `${chapter}.json`);
        if (fs.existsSync(cFile)) {
          skipped++;
        } else if (dry) {
          console.log(`  [dry] context ${tag}`);
        } else {
          try {
            const ctx = await generateChapterContext(book.displayName, chapter, verses, tradition, isQuran);
            calls++;
            if (ctx.summary) {
              writeJson(cFile, ctx);
              console.log(`  [ok]  context ${tag}: ${ctx.events.length} events, ${ctx.readings.length} readings`);
            } else {
              failed++;
              console.warn(`  [!!]  context ${tag}: empty`);
            }
          } catch (err) {
            failed++;
            console.warn(`  [!!]  context ${tag}: ${(err as Error).message}`);
          }
          await sleep(delayMs);
        }
      }
    }
  }

  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`\nDone in ${secs}s — API calls: ${calls}, already present: ${skipped}, failed: ${failed}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
