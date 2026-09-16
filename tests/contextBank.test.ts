import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const generateChapterContext = vi.fn();
vi.mock('../services/geminiService', () => ({
  generateChapterContext: (...a: any[]) => generateChapterContext(...(a as [any, any, any, any, any])),
}));

import { getChapterContext, __resetContextBankForTests } from '../services/contextBank';
import { __resetScriptureStoreForTests } from '../services/scriptureStore';

const sample = {
  summary: 'God makes the world in six days and rests on the seventh.',
  setting: 'An origin story; the text gives no date.',
  events: [{ ref: 'vv. 1-5', what: 'Light is made.' }],
  people: [{ name: 'God', role: 'Creates' }],
  terms: [{ term: 'firmament', meaning: 'A dome-like sky.' }],
  readings: [
    { tradition: 'Jewish', view: 'Read as the opening of Torah.' },
    { tradition: 'Christian', view: 'Read as the start of a longer story.' },
    { tradition: 'Historical-critical', view: 'Seen as an ancient Near Eastern cosmology text.' },
  ],
  oftenQuoted: [],
  generatedAt: 'x',
};

const req = {
  tradition: 'protestant',
  translationId: 'kjv',
  bookSlug: 'genesis',
  bookName: 'Genesis',
  chapter: 1,
  verses: [{ verse: 1, text: 'In the beginning' }],
};

describe('contextBank', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    __resetScriptureStoreForTests();
    __resetContextBankForTests();
    generateChapterContext.mockReset();
    generateChapterContext.mockResolvedValue(sample);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
  });

  it('is unavailable in production when nothing was shipped, and never calls AI', async () => {
    const r = await getChapterContext({ ...req, allowAI: false });
    expect(r.status).toBe('unavailable');
    expect(generateChapterContext).not.toHaveBeenCalled();
  });

  it('generates once when allowed, then serves from storage across reloads', async () => {
    const a = await getChapterContext({ ...req, allowAI: true });
    expect(a.status).toBe('ready');
    expect(a.source).toBe('ai');
    expect(a.context?.readings).toHaveLength(3);
    expect(generateChapterContext).toHaveBeenCalledTimes(1);
    expect(generateChapterContext.mock.calls[0][3]).toBe('protestant');

    __resetContextBankForTests();
    __resetScriptureStoreForTests();
    const b = await getChapterContext({ ...req, allowAI: false });
    expect(b.status).toBe('ready');
    expect(b.context?.summary).toBe(sample.summary);
    expect(generateChapterContext).toHaveBeenCalledTimes(1);
  });

  it('prefers context shipped with the app', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/data/context/protestant/kjv/genesis/1.json'
          ? { ok: true, status: 200, json: async () => sample }
          : { ok: false, status: 404, json: async () => ({}) }
      )
    );
    const r = await getChapterContext({ ...req, allowAI: true });
    expect(r.status).toBe('ready');
    expect(r.source).toBe('bundled');
    expect(generateChapterContext).not.toHaveBeenCalled();
  });

  it('dedupes concurrent requests for the same chapter', async () => {
    const [a, b] = await Promise.all([
      getChapterContext({ ...req, allowAI: true }),
      getChapterContext({ ...req, allowAI: true }),
    ]);
    expect(a.status).toBe('ready');
    expect(b.status).toBe('ready');
    expect(generateChapterContext).toHaveBeenCalledTimes(1);
  });
});
