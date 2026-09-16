/**
 * Vite dev-server middleware: POST /__scripture/patch
 *
 * Receives verses that the client repaired (borrowed or AI-reconstructed) and
 * merges them into the bundled dataset under public/data/, so the project's
 * own JSON becomes complete and every future user gets consistent text.
 * A ledger at public/data/_provenance.json records which verses were
 * not sourced from a printed edition.
 *
 * Only active with `vite` (serve). Never part of the production build.
 */
import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
const PLACEHOLDER_RE = /^\s*\[text pending/i;
const LEDGER = '_provenance.json';

const sortVerseKeys = (data: Record<string, string>): Record<string, string> => {
  const parse = (k: string) => {
    const [a, b] = k.split(':');
    return b === undefined ? [0, Number(a)] : [Number(a), Number(b)];
  };
  const keys = Object.keys(data).sort((x, y) => {
    const [xc, xv] = parse(x);
    const [yc, yv] = parse(y);
    return xc - yc || xv - yv;
  });
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = data[k];
  return out;
};

export function scripturePatchPlugin(): Plugin {
  return {
    name: 'scripturecomix-patch-writeback',
    apply: 'serve',
    configureServer(server) {
      const dataRoot = path.resolve(server.config.root, 'public', 'data');

      const readBody = (req: any, limit: number, cb: (body: string) => void) => {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
          if (body.length > limit) req.destroy();
        });
        req.on('end', () => cb(body));
      };
      const validSegments = (...segs: unknown[]) => {
        for (const seg of segs) {
          if (typeof seg !== 'string' || !SAFE_SEGMENT.test(seg)) throw new Error(`Invalid path segment: ${seg}`);
        }
      };

      // Scene plan → public/data/scenes/<tradition>/<slug>/<chapter>.json (shared by every translation)
      server.middlewares.use('/__scripture/scenes', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        readBody(req, 500_000, (body) => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { tradition, translation, slug, chapter, plan } = JSON.parse(body || '{}');
            validSegments(tradition, translation, slug);
            const ch = Number(chapter);
            if (!Number.isInteger(ch) || ch < 1) throw new Error('Invalid chapter');
            if (!plan || !Array.isArray(plan.scenes) || !plan.scenes.length) throw new Error('Invalid plan');
            const dir = path.join(dataRoot, 'scenes', tradition, slug);
            const file = path.join(dir, `${ch}.json`);
            if (!file.startsWith(dataRoot)) throw new Error('Bad path');
            fs.mkdirSync(dir, { recursive: true });
            const existed = fs.existsSync(file);
            if (!existed) {
              fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', 'utf8');
              server.config.logger.info(`[scripture] stored scene plan for ${tradition}/${slug} ${ch} (${plan.scenes.length} scenes)`);
            }
            res.end(JSON.stringify({ ok: true, written: !existed }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String((err as Error).message || err) }));
          }
        });
      });

      // Scene picture → public/data/scenes/<tradition>/<slug>/<chapter>-<sceneId>-<style>.jpg|png
      server.middlewares.use('/__scripture/scene-image', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        readBody(req, 12_000_000, (body) => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { tradition, translation, slug, chapter, sceneId, style, dataUrl } = JSON.parse(body || '{}');
            validSegments(tradition, translation, slug, sceneId, style);
            const ch = Number(chapter);
            if (!Number.isInteger(ch) || ch < 1) throw new Error('Invalid chapter');
            const m = typeof dataUrl === 'string' ? dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/) : null;
            if (!m) throw new Error('dataUrl must be a base64 PNG/JPEG/WebP');
            const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
            const dir = path.join(dataRoot, 'scenes', tradition, slug);
            const file = path.join(dir, `${ch}-${sceneId}-${style}.${ext === 'png' ? 'png' : ext}`);
            if (!file.startsWith(dataRoot)) throw new Error('Bad path');
            fs.mkdirSync(dir, { recursive: true });
            const existed = fs.existsSync(file);
            if (!existed) {
              fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
              server.config.logger.info(`[scripture] stored scene image ${slug} ${ch} ${sceneId} (${style})`);
            }
            res.end(JSON.stringify({ ok: true, written: !existed, path: path.relative(dataRoot, file).replace(/\\/g, '/') }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String((err as Error).message || err) }));
          }
        });
      });

      // Neutral chapter context → public/data/context/<tradition>/<translation>/<slug>/<chapter>.json
      server.middlewares.use('/__scripture/context', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 500_000) req.destroy();
        });
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { tradition, translation, slug, chapter, context } = JSON.parse(body || '{}');
            for (const seg of [tradition, translation, slug]) {
              if (typeof seg !== 'string' || !SAFE_SEGMENT.test(seg)) throw new Error(`Invalid path segment: ${seg}`);
            }
            const ch = Number(chapter);
            if (!Number.isInteger(ch) || ch < 1) throw new Error('Invalid chapter');
            if (!context || typeof context.summary !== 'string' || !Array.isArray(context.events)) {
              throw new Error('Invalid context');
            }
            const dir = path.join(dataRoot, 'context', tradition, translation, slug);
            const file = path.join(dir, `${ch}.json`);
            if (!file.startsWith(dataRoot)) throw new Error('Bad path');
            fs.mkdirSync(dir, { recursive: true });
            const existed = fs.existsSync(file);
            if (!existed) {
              fs.writeFileSync(file, JSON.stringify(context, null, 2) + '\n', 'utf8');
              server.config.logger.info(`[scripture] stored context for ${tradition}/${translation}/${slug} ${ch}`);
            }
            res.end(JSON.stringify({ ok: true, written: !existed }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String((err as Error).message || err) }));
          }
        });
      });

      // AI-written quizzes → public/data/quizzes/<tradition>/<translation>/<slug>/<chapter>.json
      server.middlewares.use('/__scripture/quiz', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 500_000) req.destroy();
        });
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { tradition, translation, slug, chapter, set } = JSON.parse(body || '{}');
            for (const seg of [tradition, translation, slug]) {
              if (typeof seg !== 'string' || !SAFE_SEGMENT.test(seg)) throw new Error(`Invalid path segment: ${seg}`);
            }
            const ch = Number(chapter);
            if (!Number.isInteger(ch) || ch < 1) throw new Error('Invalid chapter');
            if (!set || typeof set.id !== 'string' || !Array.isArray(set.questions) || !set.questions.length) {
              throw new Error('Invalid quiz set');
            }
            const dir = path.join(dataRoot, 'quizzes', tradition, translation, slug);
            const file = path.join(dir, `${ch}.json`);
            if (!file.startsWith(dataRoot)) throw new Error('Bad path');
            fs.mkdirSync(dir, { recursive: true });
            let existing: { sets: any[] } = { sets: [] };
            if (fs.existsSync(file)) {
              try {
                existing = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (!Array.isArray(existing.sets)) existing = { sets: [] };
              } catch {
                existing = { sets: [] };
              }
            }
            let added = 0;
            if (!existing.sets.some((s: any) => s?.id === set.id)) {
              existing.sets.push({ id: set.id, source: set.source || 'ai', createdAt: set.createdAt, questions: set.questions });
              fs.writeFileSync(file, JSON.stringify(existing, null, 2) + '\n', 'utf8');
              added = 1;
              server.config.logger.info(`[scripture] stored quiz ${set.id} for ${tradition}/${translation}/${slug} ${ch} (${existing.sets.length} in file)`);
            }
            res.end(JSON.stringify({ ok: true, added, total: existing.sets.length }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String((err as Error).message || err) }));
          }
        });
      });

      server.middlewares.use('/__scripture/patch', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 2_000_000) req.destroy();
        });
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { tradition, translation, slug, verses, provenance, chapter, chapterCount } = JSON.parse(body || '{}');
            for (const seg of [tradition, translation, slug]) {
              if (typeof seg !== 'string' || !SAFE_SEGMENT.test(seg)) {
                throw new Error(`Invalid path segment: ${seg}`);
              }
            }
            if (!verses || typeof verses !== 'object') throw new Error('verses must be an object');

            const file = path.join(dataRoot, tradition, translation, `${slug}.json`);
            if (!file.startsWith(dataRoot) || !fs.existsSync(file)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ ok: false, error: 'book file not found' }));
              return;
            }

            const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
            const changedKeys: string[] = [];
            for (const [k, text] of Object.entries(verses as Record<string, unknown>)) {
              if (typeof text !== 'string' || !text.trim()) continue;
              if (!/^\d+(:\d+)?$/.test(k)) continue;
              const existing = data[k];
              if (existing && !PLACEHOLDER_RE.test(existing)) continue; // never overwrite real text
              data[k] = text.trim();
              changedKeys.push(k);
            }

            if (changedKeys.length) {
              fs.writeFileSync(file, JSON.stringify(sortVerseKeys(data), null, 2) + '\n', 'utf8');

              const ledgerPath = path.join(dataRoot, LEDGER);
              let ledger: Record<string, Record<string, string>> = {};
              if (fs.existsSync(ledgerPath)) {
                try {
                  ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
                } catch {
                  ledger = {};
                }
              }
              const bookKey = `${tradition}/${translation}/${slug}`;
              ledger[bookKey] = ledger[bookKey] || {};
              for (const k of changedKeys) {
                const src = provenance && typeof provenance[k] === 'string' ? provenance[k] : 'reconstructed';
                ledger[bookKey][k] = src;
              }
              fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
              server.config.logger.info(
                `[scripture] wrote ${changedKeys.length} verse(s) into ${bookKey}.json`
              );
            }

            // A learned verse count fills an unknown (0) slot in the canon manifest
            const ch = Number(chapter);
            const count = Number(chapterCount);
            if (Number.isInteger(ch) && ch > 0 && Number.isInteger(count) && count > 0) {
              const manifestPath = path.join(dataRoot, tradition, 'manifest.json');
              if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                const book = Array.isArray(manifest.books) ? manifest.books.find((b: any) => b.slug === slug) : null;
                if (book && Array.isArray(book.chapters) && ch <= book.chapters.length && !book.chapters[ch - 1]) {
                  book.chapters[ch - 1] = count;
                  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
                  server.config.logger.info(`[scripture] learned ${slug} chapter ${ch} has ${count} verses`);
                }
              }
            }

            res.end(JSON.stringify({ ok: true, changed: changedKeys.length }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String((err as Error).message || err) }));
          }
        });
      });
    },
  };
}
