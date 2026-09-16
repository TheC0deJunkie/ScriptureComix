/**
 * contextBank — one neutral study context per chapter, generated once and
 * kept forever: memory → IndexedDB → bundled /data/context/… → (dev only) AI.
 *
 * In production the app never generates context; it only reads what was
 * shipped. Run scripts/pregenerate.ts (or open chapters in `vite` dev) to
 * produce it ahead of time.
 */
import { ChapterContext, ChapterVerse } from '../types';
import { idbGetRecord, idbPutRecord, idbGetAllRecords, CONTEXT_STORE } from './scriptureStore';
import { generateChapterContext } from './geminiService';
import { runtimeAIEnabled } from './runtimeConfig';

export type ContextSource = 'ai' | 'bundled';

export interface ContextRecord {
  key: string; // tradition/translation/slug/chapter
  tradition: string;
  translation: string;
  slug: string;
  chapter: number;
  context: ChapterContext | null;
  source: ContextSource | null;
  bundledChecked: boolean;
  updatedAt: string;
}

export interface ContextRequest {
  tradition: string;
  translationId: string;
  bookSlug: string;
  bookName: string;
  chapter: number;
  verses: ChapterVerse[];
  isQuran?: boolean;
  /** Override the runtime AI rule. Default: dev on, production off. */
  allowAI?: boolean;
}

export type ContextStatus = 'ready' | 'unavailable';

export interface ContextResult {
  context: ChapterContext | null;
  source: ContextSource | null;
  status: ContextStatus;
}

const memory = new Map<string, ContextRecord>();
const inflight = new Map<string, Promise<ContextResult>>();

const contextKey = (t: string, tr: string, slug: string, ch: number) => `${t}/${tr}/${slug}/${ch}`;

const isValidContext = (c: any): boolean =>
  !!c && typeof c.summary === 'string' && c.summary.trim().length > 0 && Array.isArray(c.events);

async function loadRecord(req: ContextRequest): Promise<ContextRecord> {
  const key = contextKey(req.tradition, req.translationId, req.bookSlug, req.chapter);
  const cached = memory.get(key);
  if (cached) return cached;
  const stored = await idbGetRecord<ContextRecord>(CONTEXT_STORE, key);
  const record: ContextRecord = stored ?? {
    key,
    tradition: req.tradition,
    translation: req.translationId,
    slug: req.bookSlug,
    chapter: req.chapter,
    context: null,
    source: null,
    bundledChecked: false,
    updatedAt: new Date().toISOString(),
  };
  memory.set(key, record);
  return record;
}

async function save(record: ContextRecord): Promise<void> {
  record.updatedAt = new Date().toISOString();
  memory.set(record.key, record);
  await idbPutRecord(CONTEXT_STORE, record);
}

async function loadBundled(record: ContextRecord): Promise<void> {
  if (record.bundledChecked || record.context || typeof fetch !== 'function') return;
  try {
    const res = await fetch(`/data/context/${record.key}.json`);
    if (res.ok) {
      const json = await res.json();
      if (isValidContext(json)) {
        record.context = json as ChapterContext;
        record.source = 'bundled';
      }
    }
  } catch {
    /* offline or missing */
  }
  record.bundledChecked = true;
}

/**
 * Get the chapter's study context. Never blocks on AI in production; in dev
 * (or with VITE_RUNTIME_AI=true) a missing context is generated, stored, and
 * written back into the project so it ships to everyone.
 */
export async function getChapterContext(req: ContextRequest): Promise<ContextResult> {
  const key = contextKey(req.tradition, req.translationId, req.bookSlug, req.chapter);
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async (): Promise<ContextResult> => {
    const record = await loadRecord(req);
    if (record.context) return { context: record.context, source: record.source, status: 'ready' };

    await loadBundled(record);
    if (record.context) {
      await save(record);
      return { context: record.context, source: record.source, status: 'ready' };
    }

    const allowAI = req.allowAI ?? runtimeAIEnabled();
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!allowAI || !online || !req.verses.length) {
      return { context: null, source: null, status: 'unavailable' };
    }

    try {
      const context = await generateChapterContext(req.bookName, req.chapter, req.verses, req.tradition, req.isQuran);
      if (!isValidContext(context)) return { context: null, source: null, status: 'unavailable' };
      record.context = context;
      record.source = 'ai';
      await save(record);
      void persistContextToProject(record);
      return { context, source: 'ai', status: 'ready' };
    } catch (err) {
      console.warn(`[contextBank] generation failed for ${key}`, err);
      return { context: null, source: null, status: 'unavailable' };
    }
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

export async function getContextBankStats(): Promise<{ chapters: number }> {
  const records = await idbGetAllRecords<ContextRecord>(CONTEXT_STORE);
  const all = records.length ? records : Array.from(memory.values());
  return { chapters: all.filter(r => !!r.context).length };
}

/** Dev only: ship the context with the app. No-op in production. */
export async function persistContextToProject(record: ContextRecord): Promise<boolean> {
  const isDev = typeof import.meta !== 'undefined' && !!(import.meta as any).env?.DEV;
  if (!isDev || typeof fetch !== 'function' || !record.context) return false;
  try {
    const res = await fetch('/__scripture/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradition: record.tradition,
        translation: record.translation,
        slug: record.slug,
        chapter: record.chapter,
        context: record.context,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function __resetContextBankForTests() {
  memory.clear();
  inflight.clear();
}
