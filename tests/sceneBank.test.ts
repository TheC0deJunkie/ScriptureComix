import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const generateScenePlan = vi.fn();
const generatePanelImage = vi.fn();
vi.mock('../services/geminiService', () => ({
  generateScenePlan: (...a: any[]) => generateScenePlan(...(a as [any, any, any, any, any])),
  generatePanelImage: (...a: any[]) => generatePanelImage(...(a as [any, any])),
}));

import { getScenes, ensureSceneImages, styleSlug, __resetSceneBankForTests } from '../services/sceneBank';
import { __resetScriptureStoreForTests } from '../services/scriptureStore';
import { ArtStyle } from '../types';

const verses = Array.from({ length: 10 }, (_, i) => ({ verse: i + 1, text: `Verse ${i + 1} text about the story.` }));
const plan = [
  { from: 1, to: 4, title: 'In the beginning', caption: 'It starts.', visualPrompt: 'A dark sea at dawn.' },
  { from: 5, to: 10, title: 'Light and land', caption: 'Things appear.', visualPrompt: 'Sunrise over new land.' },
];
const req = {
  tradition: 'protestant',
  translationId: 'kjv',
  bookSlug: 'genesis',
  bookName: 'Genesis',
  chapter: 1,
  verses,
  style: ArtStyle.COMIC_MODERN,
};

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('sceneBank', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    __resetScriptureStoreForTests();
    __resetSceneBankForTests();
    generateScenePlan.mockReset();
    generateScenePlan.mockResolvedValue(plan);
    generatePanelImage.mockReset();
    generatePanelImage.mockResolvedValue(PNG);
    // No bundled plan, no bundled images
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, headers: new Map(), json: async () => ({}) })));
  });

  it('makes a slug for the art style', () => {
    expect(styleSlug('Modern American Comic')).toBe('modern-american-comic');
  });

  it('is unavailable in production when nothing was shipped', async () => {
    const r = await getScenes({ ...req, allowAI: false });
    expect(r.status).toBe('unavailable');
    expect(generateScenePlan).not.toHaveBeenCalled();
  });

  it('plans scenes once, one picture per scene, and remembers everything', async () => {
    const r = await getScenes({ ...req, allowAI: true });
    expect(r.status).toBe('ready');
    expect(r.scenes.map(s => [s.from, s.to])).toEqual([[1, 4], [5, 10]]);
    expect(r.scenes[0].id).toBe('s1');
    expect(r.missingImages).toBe(2);
    expect(generateScenePlan).toHaveBeenCalledTimes(1);

    const landed: number[] = [];
    const n = await ensureSceneImages({ ...req, allowAI: true }, (_s, i) => landed.push(i));
    expect(n).toBe(2);
    expect(landed).toEqual([0, 1]);
    expect(generatePanelImage).toHaveBeenCalledTimes(2); // one per scene, not per verse

    // Reload: plan and pictures come from storage, nothing regenerates
    __resetSceneBankForTests();
    __resetScriptureStoreForTests();
    const again = await getScenes({ ...req, allowAI: false });
    expect(again.status).toBe('ready');
    expect(again.missingImages).toBe(0);
    expect(again.scenes.every(s => s.image === PNG && s.imageSource === 'generated')).toBe(true);
    expect(generateScenePlan).toHaveBeenCalledTimes(1);
    await ensureSceneImages({ ...req, allowAI: true });
    expect(generatePanelImage).toHaveBeenCalledTimes(2);
  });

  it('uses a shipped plan and shipped pictures without any AI', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: any) => {
        if (url === '/data/scenes/protestant/genesis/1.json') {
          return { ok: true, status: 200, headers: new Map(), json: async () => ({ scenes: plan.map((s, i) => ({ ...s, id: `s${i + 1}` })), style: ArtStyle.COMIC_MODERN, generatedAt: 'x' }) };
        }
        if (init?.method === 'HEAD' && url.endsWith('-modern-american-comic.png')) {
          return { ok: true, status: 200, headers: { get: () => 'image/png' } };
        }
        return { ok: false, status: 404, headers: new Map(), json: async () => ({}) };
      })
    );
    const r = await getScenes({ ...req, allowAI: false });
    expect(r.status).toBe('ready');
    expect(r.planSource).toBe('bundled');
    expect(r.missingImages).toBe(0);
    expect(r.scenes[1].image).toBe('/data/scenes/protestant/genesis/1-s2-modern-american-comic.png');
    expect(generateScenePlan).not.toHaveBeenCalled();
  });

  it('switches a device-drawn plan to the shipped plan once one ships', async () => {
    await getScenes({ ...req, allowAI: true });
    await ensureSceneImages({ ...req, allowAI: true });
    // A plan ships later with different scenes
    const shipped = [{ from: 1, to: 10, title: 'Shipped scene', caption: 'c', visualPrompt: 'p', id: 's1' }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/data/scenes/protestant/genesis/1.json'
          ? { ok: true, status: 200, headers: new Map(), json: async () => ({ scenes: shipped, style: ArtStyle.COMIC_MODERN, generatedAt: 'x' }) }
          : { ok: false, status: 404, headers: new Map(), json: async () => ({}) }
      )
    );
    __resetSceneBankForTests(); // new session
    const r = await getScenes({ ...req, allowAI: false });
    expect(r.planSource).toBe('bundled');
    expect(r.scenes.map(s => s.title)).toEqual(['Shipped scene']);
  });

  it('skips failed pictures instead of storing placeholders', async () => {
    generatePanelImage.mockResolvedValue('https://placehold.co/800x800?text=Image+Generation+Failed');
    await getScenes({ ...req, allowAI: true });
    const n = await ensureSceneImages({ ...req, allowAI: true });
    expect(n).toBe(0);
    const r = await getScenes({ ...req, allowAI: false });
    expect(r.missingImages).toBe(2);
  });
});
