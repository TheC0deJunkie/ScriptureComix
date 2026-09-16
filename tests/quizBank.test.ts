import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const generateGroundedQuiz = vi.fn();
vi.mock('../services/geminiService', () => ({
  generateGroundedQuiz: (...a: any[]) => generateGroundedQuiz(...(a as [any, any, any, any])),
}));

import { getQuiz, getQuizBankStats, MIN_GENERATED_SETS, MAX_AI_SETS, __resetQuizBankForTests } from '../services/quizBank';
import { __resetScriptureStoreForTests } from '../services/scriptureStore';
import { extractChapter } from '../services/textLibrary';

const genesis = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/protestant/kjv/genesis.json'), 'utf-8'));
const verses = extractChapter(genesis, 1);

const req = {
  tradition: 'protestant',
  translationId: 'kjv',
  bookSlug: 'genesis',
  bookName: 'Genesis',
  chapter: 1,
  verses,
  verseLabel: 'Verse',
  isQuran: false,
};

const aiQuiz = {
  questions: [
    { question: 'What did God create first?', options: ['Light', 'Fish', 'Man', 'Stars'], correctAnswer: 0, explanation: 'Verse 3' },
    { question: 'On which day were the animals made?', options: ['1', '3', '6', '7'], correctAnswer: 2, explanation: 'Verse 24' },
  ],
};

const flush = () => new Promise(r => setTimeout(r, 20));

describe('quizBank', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    __resetScriptureStoreForTests();
    __resetQuizBankForTests();
    generateGroundedQuiz.mockReset();
    generateGroundedQuiz.mockResolvedValue(aiQuiz);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
  });

  it('serves a quiz instantly from the text and fills the bank offline', async () => {
    generateGroundedQuiz.mockImplementation(() => new Promise(() => {})); // AI never returns
    const pick = await getQuiz({ ...req });
    expect(pick.quiz.questions.length).toBeGreaterThanOrEqual(3);
    expect(pick.set.source).toBe('generated');
    expect(pick.generatedSets).toBe(MIN_GENERATED_SETS);
    expect(pick.bankSize).toBe(MIN_GENERATED_SETS);
  });

  it('rotates through variants and never repeats the excluded one', async () => {
    const seen = new Set<string>();
    let last: string | undefined;
    for (let i = 0; i < MIN_GENERATED_SETS; i++) {
      const pick = await getQuiz({ ...req, allowAI: false }, { fresh: true, excludeId: last });
      expect(pick.set.id).not.toBe(last);
      seen.add(pick.set.id);
      last = pick.set.id;
    }
    expect(seen.size).toBe(MIN_GENERATED_SETS);
  });

  it('adds AI quizzes in the background, stores them, and stops at the cap', async () => {
    await getQuiz({ ...req });
    await flush();
    expect(generateGroundedQuiz).toHaveBeenCalledTimes(1);
    expect(generateGroundedQuiz.mock.calls[0][0]).toBe('Genesis');

    // Next request: the AI quiz is preferred because it has never been shown
    const pick = await getQuiz({ ...req });
    expect(pick.set.source).toBe('ai');
    expect(pick.aiSets).toBe(1);
    await flush();
    expect(generateGroundedQuiz).toHaveBeenCalledTimes(2);

    await getQuiz({ ...req });
    await flush();
    expect(generateGroundedQuiz).toHaveBeenCalledTimes(MAX_AI_SETS); // capped

    // Survives a reload
    __resetQuizBankForTests();
    __resetScriptureStoreForTests();
    const stats = await getQuizBankStats();
    expect(stats.chapters).toBe(1);
    expect(stats.aiSets).toBe(MAX_AI_SETS);
    expect(stats.sets).toBe(MIN_GENERATED_SETS + MAX_AI_SETS);
  });

  it('rejects malformed AI output without breaking the bank', async () => {
    generateGroundedQuiz.mockResolvedValue({ questions: [{ question: 'x', options: ['a'], correctAnswer: 5 }] });
    await getQuiz({ ...req });
    await flush();
    const pick = await getQuiz({ ...req });
    expect(pick.aiSets).toBe(0);
    expect(pick.set.source).toBe('generated');
  });

  it('merges quizzes bundled with the app', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/data/quizzes/protestant/kjv/genesis/1.json'
          ? { ok: true, status: 200, json: async () => ({ sets: [{ id: 'ship-1', ...aiQuiz, createdAt: 'x' }] }) }
          : { ok: false, status: 404, json: async () => ({}) }
      )
    );
    const pick = await getQuiz({ ...req, allowAI: false });
    expect(pick.set.id).toBe('ship-1');
    expect(pick.set.source).toBe('bundled');
    expect(pick.bankSize).toBe(MIN_GENERATED_SETS + 1);
  });

  it('does not call AI when offline or disabled', async () => {
    await getQuiz({ ...req, allowAI: false });
    await flush();
    expect(generateGroundedQuiz).not.toHaveBeenCalled();
  });
});
