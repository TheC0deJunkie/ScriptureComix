/**
 * quizBank — a permanent, growing library of quizzes per chapter.
 *
 * Every chapter's bank holds:
 *   generated — built offline from the verse text by quizFactory (instant,
 *               deterministic, unlimited variants; the bank is topped up to
 *               MIN_GENERATED_SETS on first use)
 *   ai        — comprehension quizzes written by the model, grounded in the
 *               chapter text, generated in the background at most
 *               MAX_AI_SETS times per chapter and then kept forever
 *   bundled   — quizzes shipped with the app under /data/quizzes/…
 *
 * Quizzes are stored in IndexedDB so they survive reloads and work offline.
 * In development, AI quizzes are also written back into public/data/quizzes
 * so they ship to everyone.
 */
import { ChapterVerse, QuizQuestion, QuizResponse } from '../types';
import { buildQuiz } from './quizFactory';
import { idbGetRecord, idbPutRecord, idbGetAllRecords, QUIZ_STORE } from './scriptureStore';
import { generateGroundedQuiz } from './geminiService';
import { runtimeAIEnabled } from './runtimeConfig';

export type QuizSource = 'generated' | 'ai' | 'bundled';

export interface QuizSet {
  id: string;
  source: QuizSource;
  seed?: number;
  createdAt: string;
  lastShownAt?: string;
  shown: number;
  questions: QuizQuestion[];
}

export interface QuizBankRecord {
  key: string; // tradition/translation/slug/chapter
  tradition: string;
  translation: string;
  slug: string;
  chapter: number;
  sets: QuizSet[];
  bundledLoaded: boolean;
  updatedAt: string;
}

export interface QuizRequest {
  tradition: string;
  translationId: string;
  bookSlug: string;
  bookName: string;
  chapter: number;
  verses: ChapterVerse[];
  verseLabel?: string;
  isQuran?: boolean;
  /** Skip background AI enrichment (offline, or no key). Default true. */
  allowAI?: boolean;
}

export interface QuizPick {
  quiz: QuizResponse;
  set: QuizSet;
  bankSize: number;
  generatedSets: number;
  aiSets: number;
}

export const MIN_GENERATED_SETS = 6;
export const MAX_AI_SETS = 2;

const memory = new Map<string, QuizBankRecord>();
const enriching = new Set<string>();

const quizKey = (t: string, tr: string, slug: string, ch: number) => `${t}/${tr}/${slug}/${ch}`;

const isValidQuiz = (q: any): boolean =>
  !!q &&
  Array.isArray(q.questions) &&
  q.questions.length > 0 &&
  q.questions.every(
    (x: any) =>
      typeof x?.question === 'string' &&
      Array.isArray(x.options) &&
      x.options.length >= 2 &&
      Number.isInteger(x.correctAnswer) &&
      x.correctAnswer >= 0 &&
      x.correctAnswer < x.options.length
  );

async function loadRecord(req: QuizRequest): Promise<QuizBankRecord> {
  const key = quizKey(req.tradition, req.translationId, req.bookSlug, req.chapter);
  const cached = memory.get(key);
  if (cached) return cached;
  const stored = await idbGetRecord<QuizBankRecord>(QUIZ_STORE, key);
  const record: QuizBankRecord = stored ?? {
    key,
    tradition: req.tradition,
    translation: req.translationId,
    slug: req.bookSlug,
    chapter: req.chapter,
    sets: [],
    bundledLoaded: false,
    updatedAt: new Date().toISOString(),
  };
  memory.set(key, record);
  return record;
}

async function save(record: QuizBankRecord): Promise<void> {
  record.updatedAt = new Date().toISOString();
  memory.set(record.key, record);
  await idbPutRecord(QUIZ_STORE, record);
}

/** Merge quizzes shipped with the app (once per chapter). 404 is normal. */
async function loadBundled(record: QuizBankRecord): Promise<void> {
  if (record.bundledLoaded || typeof fetch !== 'function') return;
  try {
    const res = await fetch(`/data/quizzes/${record.key}.json`);
    if (res.ok) {
      const json = await res.json();
      const sets: any[] = Array.isArray(json?.sets) ? json.sets : [];
      const known = new Set(record.sets.map(s => s.id));
      for (const s of sets) {
        if (!s?.id || known.has(s.id) || !isValidQuiz(s)) continue;
        record.sets.push({
          id: s.id,
          source: 'bundled',
          createdAt: s.createdAt || new Date().toISOString(),
          shown: 0,
          questions: s.questions,
        });
      }
    }
  } catch {
    /* offline or missing — fine */
  }
  record.bundledLoaded = true;
}

/** Top the bank up with text-built quizzes so there is always variety offline. */
function topUpGenerated(record: QuizBankRecord, req: QuizRequest): void {
  const generated = record.sets.filter(s => s.source === 'generated');
  let seed = generated.reduce((m, s) => Math.max(m, s.seed || 0), 0);
  let attempts = 0;
  let count = generated.length;
  while (count < MIN_GENERATED_SETS && attempts < MIN_GENERATED_SETS * 4) {
    seed++;
    attempts++;
    const quiz = buildQuiz({
      bookName: req.bookName,
      chapter: req.chapter,
      verses: req.verses,
      verseLabel: req.verseLabel,
      isQuran: req.isQuran,
      seed,
    });
    if (quiz.questions.length < 3) continue;
    // Skip exact duplicates of an existing variant
    const sig = quiz.questions.map(q => q.question).join('|');
    if (record.sets.some(s => s.questions.map(q => q.question).join('|') === sig)) continue;
    record.sets.push({
      id: `gen-${seed}`,
      source: 'generated',
      seed,
      createdAt: new Date().toISOString(),
      shown: 0,
      questions: quiz.questions,
    });
    count++;
  }
}

/** Least-shown first; among ties, unseen AI/bundled quizzes win, then random. */
function choose(record: QuizBankRecord, excludeId?: string): QuizSet | null {
  const pool = record.sets.filter(s => s.id !== excludeId);
  const candidates = pool.length ? pool : record.sets;
  if (!candidates.length) return null;
  const minShown = Math.min(...candidates.map(s => s.shown));
  const tier = candidates.filter(s => s.shown === minShown);
  const rich = tier.filter(s => s.source !== 'generated');
  const from = rich.length ? rich : tier;
  return from[Math.floor(Math.random() * from.length)];
}

async function enrichWithAI(record: QuizBankRecord, req: QuizRequest): Promise<void> {
  if (enriching.has(record.key)) return;
  enriching.add(record.key);
  try {
    const quiz: QuizResponse = await generateGroundedQuiz(req.bookName, req.chapter, req.verses, req.isQuran);
    if (!isValidQuiz(quiz)) return;
    const set: QuizSet = {
      id: `ai-${Date.now()}`,
      source: 'ai',
      createdAt: new Date().toISOString(),
      shown: 0,
      questions: quiz.questions,
    };
    record.sets.push(set);
    await save(record);
    void persistQuizToProject(record, set);
  } catch (err) {
    console.warn(`[quizBank] AI enrichment failed for ${record.key}`, err);
  } finally {
    enriching.delete(record.key);
  }
}

/**
 * Get a quiz for a chapter. Always instant and offline-capable: the bank is
 * filled from the text on first use. AI quizzes are added in the background
 * and appear on later requests.
 */
export async function getQuiz(req: QuizRequest, opts: { fresh?: boolean; excludeId?: string } = {}): Promise<QuizPick> {
  const record = await loadRecord(req);
  await loadBundled(record);
  topUpGenerated(record, req);

  const set = choose(record, opts.fresh ? opts.excludeId : undefined);
  if (!set) throw new Error('This chapter has too little text to build a quiz from.');
  set.shown++;
  set.lastShownAt = new Date().toISOString();
  await save(record);

  const aiSets = record.sets.filter(s => s.source === 'ai' || s.source === 'bundled').length;
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  const allowAI = req.allowAI ?? runtimeAIEnabled();
  if (allowAI && online && aiSets < MAX_AI_SETS) {
    void enrichWithAI(record, req);
  }

  return {
    quiz: { questions: set.questions },
    set,
    bankSize: record.sets.length,
    generatedSets: record.sets.filter(s => s.source === 'generated').length,
    aiSets,
  };
}

export interface QuizBankStats {
  chapters: number;
  sets: number;
  aiSets: number;
}

export async function getQuizBankStats(): Promise<QuizBankStats> {
  const records = await idbGetAllRecords<QuizBankRecord>(QUIZ_STORE);
  const all = records.length ? records : Array.from(memory.values());
  let sets = 0;
  let aiSets = 0;
  for (const r of all) {
    sets += r.sets.length;
    aiSets += r.sets.filter(s => s.source !== 'generated').length;
  }
  return { chapters: all.length, sets, aiSets };
}

/** Dev only: ship an AI quiz with the app. No-op in production. */
export async function persistQuizToProject(record: QuizBankRecord, set: QuizSet): Promise<boolean> {
  const isDev = typeof import.meta !== 'undefined' && !!(import.meta as any).env?.DEV;
  if (!isDev || typeof fetch !== 'function') return false;
  try {
    const res = await fetch('/__scripture/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradition: record.tradition,
        translation: record.translation,
        slug: record.slug,
        chapter: record.chapter,
        set: { id: set.id, source: set.source, createdAt: set.createdAt, questions: set.questions },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function __resetQuizBankForTests() {
  memory.clear();
  enriching.clear();
}
