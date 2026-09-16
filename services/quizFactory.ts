/**
 * quizFactory — builds quizzes straight from the chapter text. No AI, no
 * network, deterministic for a given seed, so an unlimited number of distinct
 * variants can be produced offline.
 *
 * Question types:
 *   cloze        — a key word is blanked out of a verse; distractors are other
 *                  key words from the same chapter
 *   reference    — "which verse says …?" with verse numbers as options
 *   continuation — "how does this verse continue?" with other verses' second
 *                  halves as distractors
 */
import { ChapterVerse, QuizQuestion, QuizResponse } from '../types';

export interface QuizFactoryInput {
  bookName: string;
  chapter: number;
  verses: ChapterVerse[];
  /** "Verse" or "Ayah" */
  verseLabel?: string;
  isQuran?: boolean;
  seed: number;
  questionCount?: number;
}

// Small deterministic PRNG (mulberry32)
export const seededRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T,>(arr: T[], rng: () => number): T[] => {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const pick = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

const STOPWORDS = new Set(
  (
    'about above after again against all also among and any are because been before being below between both ' +
    'but came can come could did does doing down during each even every from further had has have having here ' +
    'him his how into itself just like made make many more most much must myself never nothing now off once ' +
    'only other ought our ours ourselves over own said same shall should since some such than that the their ' +
    'theirs them themselves then there these they this those thou thee thy thine through thus till unto until upon ' +
    'very was were what when where which while whom whose will with within without would your yours yourself ' +
    'yourselves shalt hath thereof therefore wherefore saith unto whether where behold neither either also there ' +
    'these those which while whom whose being'
  ).split(/\s+/)
);

const clean = (t: string) => t.replace(/\s+/g, ' ').trim();
const wordsOf = (t: string) => clean(t).split(' ');
const stripPunct = (w: string) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');

const contentWords = (text: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of wordsOf(text)) {
    const w = stripPunct(raw);
    if (w.length < 5 || !/^[A-Za-z']+$/.test(w) || STOPWORDS.has(w.toLowerCase())) continue;
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
};

const excerpt = (text: string, n: number) => {
  const w = wordsOf(text);
  return w.length <= n ? clean(text) : w.slice(0, n).join(' ') + '…';
};

const refLabel = (input: QuizFactoryInput, verse: number) =>
  input.isQuran
    ? `${input.bookName}, ${input.verseLabel || 'Ayah'} ${verse}`
    : `${input.bookName} ${input.chapter}:${verse}`;

type Generator = (v: ChapterVerse, input: QuizFactoryInput, rng: () => number) => QuizQuestion | null;

const cloze: Generator = (v, input, rng) => {
  const candidates = contentWords(v.text);
  if (!candidates.length) return null;
  const answer = pick(candidates, rng);
  const pool = input.verses
    .filter(o => o.verse !== v.verse)
    .flatMap(o => contentWords(o.text))
    .filter(w => w.toLowerCase() !== answer.toLowerCase());
  const unique = Array.from(new Map(pool.map(w => [w.toLowerCase(), w])).values());
  if (unique.length < 3) return null;
  // Prefer distractors of a similar length so the blank does not give it away
  const sorted = unique.sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length));
  const distractors = shuffle(sorted.slice(0, Math.min(8, sorted.length)), rng).slice(0, 3);
  const options = shuffle([answer, ...distractors], rng);
  // Blank every occurrence (any case) so the answer cannot be read off the question
  const blanked = clean(v.text).replace(new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '_____');
  return {
    question: `Fill in the blank (${refLabel(input, v.verse)}): "${excerpt(blanked, 40)}"`,
    options,
    correctAnswer: options.indexOf(answer),
    explanation: `${refLabel(input, v.verse)}: "${clean(v.text)}"`,
  };
};

const reference: Generator = (v, input, rng) => {
  if (input.verses.length < 4) return null;
  const label = input.verseLabel || 'Verse';
  const others = shuffle(input.verses.filter(o => o.verse !== v.verse), rng).slice(0, 3);
  const numbers = shuffle([v.verse, ...others.map(o => o.verse)], rng);
  const options = numbers.map(n => `${label} ${n}`);
  const where = input.isQuran ? input.bookName : `${input.bookName} ${input.chapter}`;
  return {
    question: `Which ${label.toLowerCase()} of ${where} reads: "${excerpt(v.text, 16)}"?`,
    options,
    correctAnswer: numbers.indexOf(v.verse),
    explanation: `${refLabel(input, v.verse)}: "${clean(v.text)}"`,
  };
};

const continuation: Generator = (v, input, rng) => {
  const split = (text: string) => {
    const w = wordsOf(text);
    if (w.length < 10) return null;
    const cut = Math.floor(w.length / 2);
    return { head: w.slice(0, cut).join(' '), tail: w.slice(cut).slice(0, 12).join(' ') + (w.length - cut > 12 ? '…' : '') };
  };
  const mine = split(v.text);
  if (!mine) return null;
  const tails = input.verses
    .filter(o => o.verse !== v.verse)
    .map(o => split(o.text)?.tail)
    .filter((t): t is string => !!t && t !== mine.tail);
  if (tails.length < 3) return null;
  const distractors = shuffle(tails, rng).slice(0, 3);
  const options = shuffle([mine.tail, ...distractors], rng);
  return {
    question: `How does ${refLabel(input, v.verse)} continue? "${mine.head} …"`,
    options,
    correctAnswer: options.indexOf(mine.tail),
    explanation: `${refLabel(input, v.verse)}: "${clean(v.text)}"`,
  };
};

const GENERATORS: Generator[] = [cloze, reference, continuation];

/** Build a quiz from chapter text. Same input + seed → same quiz. */
export function buildQuiz(input: QuizFactoryInput): QuizResponse {
  const rng = seededRandom(input.seed);
  const want = input.questionCount ?? 5;
  const usable = input.verses.filter(v => v.text && v.text.trim().length > 0 && !/^\s*\[text pending/i.test(v.text));
  const order = shuffle(usable, rng);
  const questions: QuizQuestion[] = [];
  const used = new Set<string>();

  let gi = Math.floor(rng() * GENERATORS.length);
  let guard = 0;
  while (questions.length < want && guard < order.length * GENERATORS.length) {
    const v = order[guard % order.length];
    const gen = GENERATORS[gi % GENERATORS.length];
    gi++;
    guard++;
    const tag = `${gen.name}:${v.verse}`;
    if (used.has(tag)) continue;
    const q = gen(v, { ...input, verses: usable }, rng);
    if (!q || q.correctAnswer < 0 || new Set(q.options).size !== q.options.length) continue;
    used.add(tag);
    questions.push(q);
  }
  return { questions };
}
