import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildQuiz, seededRandom } from '../services/quizFactory';
import { extractChapter } from '../services/textLibrary';

const genesis = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/protestant/kjv/genesis.json'), 'utf-8'));
const verses = extractChapter(genesis, 1);

const checkValid = (quiz: ReturnType<typeof buildQuiz>) => {
  for (const q of quiz.questions) {
    expect(q.question.length).toBeGreaterThan(10);
    expect(q.options.length).toBe(4);
    expect(new Set(q.options).size).toBe(4);
    expect(q.correctAnswer).toBeGreaterThanOrEqual(0);
    expect(q.correctAnswer).toBeLessThan(4);
    expect(q.explanation).toContain('Genesis 1:');
  }
};

describe('quizFactory', () => {
  it('seeded RNG is deterministic', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('builds a valid 5-question quiz from real chapter text with no AI', () => {
    const quiz = buildQuiz({ bookName: 'Genesis', chapter: 1, verses, seed: 1 });
    expect(quiz.questions).toHaveLength(5);
    checkValid(quiz);
  });

  it('is deterministic for a seed and different across seeds', () => {
    const a = buildQuiz({ bookName: 'Genesis', chapter: 1, verses, seed: 7 });
    const b = buildQuiz({ bookName: 'Genesis', chapter: 1, verses, seed: 7 });
    const c = buildQuiz({ bookName: 'Genesis', chapter: 1, verses, seed: 8 });
    expect(a).toEqual(b);
    expect(a.questions.map(q => q.question)).not.toEqual(c.questions.map(q => q.question));
  });

  it('produces many distinct variants from one chapter', () => {
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      const quiz = buildQuiz({ bookName: 'Genesis', chapter: 1, verses, seed });
      checkValid(quiz);
      signatures.add(quiz.questions.map(q => q.question).join('|'));
    }
    expect(signatures.size).toBeGreaterThanOrEqual(20);
  });

  it('uses all three question types over a few seeds', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) {
      for (const q of buildQuiz({ bookName: 'Genesis', chapter: 1, verses, seed }).questions) {
        if (q.question.startsWith('Fill in the blank')) kinds.add('cloze');
        else if (q.question.startsWith('Which verse')) kinds.add('reference');
        else if (q.question.startsWith('How does')) kinds.add('continuation');
      }
    }
    expect(kinds).toEqual(new Set(['cloze', 'reference', 'continuation']));
  });

  it('cloze answers really are blanked out of the question', () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const q of buildQuiz({ bookName: 'Genesis', chapter: 1, verses, seed }).questions) {
        if (!q.question.startsWith('Fill in the blank')) continue;
        expect(q.question).toContain('_____');
        const answer = q.options[q.correctAnswer];
        expect(new RegExp(`\\b${answer}\\b`).test(q.question)).toBe(false);
      }
    }
  });

  it('labels Quran questions with surah and ayah wording', () => {
    const fatiha = [
      { verse: 1, text: 'In the name of Allah, the Most Gracious, the Most Merciful.' },
      { verse: 2, text: 'Praise be to Allah, the Cherisher and Sustainer of the Worlds;' },
      { verse: 3, text: 'Most Gracious, Most Merciful;' },
      { verse: 4, text: 'Master of the Day of Judgment.' },
      { verse: 5, text: 'Thee do we worship, and Thine aid we seek.' },
      { verse: 6, text: 'Show us the straight way,' },
      { verse: 7, text: 'The way of those on whom Thou hast bestowed Thy Grace, those whose portion is not wrath, and who go not astray.' },
    ];
    const quiz = buildQuiz({ bookName: 'Al-Fatiha', chapter: 1, verses: fatiha, seed: 3, isQuran: true, verseLabel: 'Ayah' });
    expect(quiz.questions.length).toBeGreaterThanOrEqual(3);
    expect(quiz.questions.some(q => /Ayah/.test(q.question) || /Ayah/.test(q.explanation))).toBe(true);
  });

  it('skips placeholder verses and degrades gracefully on tiny chapters', () => {
    const tiny = [{ verse: 1, text: '[Text pending -- x]' }, { verse: 2, text: 'Short.' }];
    const quiz = buildQuiz({ bookName: 'Stub', chapter: 1, verses: tiny, seed: 1 });
    expect(quiz.questions).toHaveLength(0);
  });
});
