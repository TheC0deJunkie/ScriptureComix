/**
 * sceneBank — the illustrated edition, one picture per scene, generated once.
 *
 * For each chapter:
 *   plan   — 3–8 scenes (verse ranges + caption + visual prompt), from
 *            /data/scenes/<key>.json (shipped) or generated in dev and written back
 *   images — one per scene, /data/scenes/<key>-<sceneId>-<style>.png (shipped)
 *            or generated in dev and written back as PNG
 *
 * Both are cached in IndexedDB. In production nothing is generated: a scene
 * without a shipped image shows its caption card.
 */
import { ArtStyle, ChapterVerse, Scene, ScenePlan } from '../types';
import { idbGetRecord, idbPutRecord, idbGetAllRecords, SCENE_STORE } from './scriptureStore';
import { generateScenePlan, generatePanelImage } from './geminiService';
import { runtimeAIEnabled } from './runtimeConfig';

export interface SceneRecord {
  key: string; // tradition/slug/chapter (translation-independent)
  tradition: string;
  translation: string;
  slug: string;
  chapter: number;
  plan: ScenePlan | null;
  planSource: 'bundled' | 'ai' | null;
  /** sceneId-style → data URL generated on this device (bundled images are referenced by path) */
  images: Record<string, string>;
  bundledChecked: boolean;
  updatedAt: string;
}

export interface SceneRequest {
  tradition: string;
  translationId: string;
  bookSlug: string;
  bookName: string;
  chapter: number;
  verses: ChapterVerse[];
  isQuran?: boolean;
  style?: ArtStyle;
  allowAI?: boolean;
}

export interface SceneResult {
  scenes: Scene[];
  planSource: 'bundled' | 'ai' | null;
  status: 'ready' | 'unavailable';
  /** Number of scenes still without a picture (for the progress badge). */
  missingImages: number;
}

/** The house style bundled images are drawn in. */
export const DEFAULT_SCENE_STYLE = ArtStyle.COMIC_MODERN;

export const styleSlug = (style: string) => style.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const memory = new Map<string, SceneRecord>();
const inflightPlans = new Map<string, Promise<SceneResult>>();
const inflightImages = new Set<string>();
const shippedChecked = new Set<string>();

// Pictures belong to the story, not the translation: key by tradition/book/chapter so
// every translation (and every future language) reuses the same scenes and images.
const sceneKey = (t: string, _tr: string, slug: string, ch: number) => `${t}/${slug}/${ch}`;

const isValidPlan = (p: any): boolean =>
  !!p && Array.isArray(p.scenes) && p.scenes.length > 0 && p.scenes.every((s: any) => Number.isInteger(s.from) && Number.isInteger(s.to) && s.title);

async function loadRecord(req: SceneRequest): Promise<SceneRecord> {
  const key = sceneKey(req.tradition, req.translationId, req.bookSlug, req.chapter);
  const cached = memory.get(key);
  if (cached) return cached;
  const stored = await idbGetRecord<SceneRecord>(SCENE_STORE, key);
  const record: SceneRecord = stored ?? {
    key,
    tradition: req.tradition,
    translation: req.translationId,
    slug: req.bookSlug,
    chapter: req.chapter,
    plan: null,
    planSource: null,
    images: {},
    bundledChecked: false,
    updatedAt: new Date().toISOString(),
  };
  memory.set(key, record);
  return record;
}

async function save(record: SceneRecord): Promise<void> {
  record.updatedAt = new Date().toISOString();
  memory.set(record.key, record);
  await idbPutRecord(SCENE_STORE, record);
}

async function loadBundledPlan(record: SceneRecord): Promise<void> {
  if (record.bundledChecked || record.plan || typeof fetch !== 'function') return;
  try {
    const res = await fetch(`/data/scenes/${record.key}.json`);
    if (res.ok) {
      const json = await res.json();
      if (isValidPlan(json)) {
        record.plan = json as ScenePlan;
        record.planSource = 'bundled';
      }
    }
  } catch {
    /* offline or missing */
  }
  record.bundledChecked = true;
}

/** Bundled image paths for a scene in a style — JPEG (compressed) first, PNG (raw) second. */
export const bundledImagePaths = (key: string, sceneId: string, style: string) => [
  `/data/scenes/${key}-${sceneId}-${styleSlug(style)}.jpg`,
  `/data/scenes/${key}-${sceneId}-${styleSlug(style)}.png`,
];
export const bundledImagePath = (key: string, sceneId: string, style: string) => bundledImagePaths(key, sceneId, style)[1];

const findBundledImage = async (key: string, sceneId: string, style: string): Promise<string | null> => {
  for (const p of bundledImagePaths(key, sceneId, style)) if (await imageExists(p)) return p;
  return null;
};

const imageExists = async (url: string): Promise<boolean> => {
  if (typeof fetch !== 'function') return false;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok && !(res.headers.get('content-type') || '').includes('text/html');
  } catch {
    return false;
  }
};

/** Resolve the scene list with whatever images exist right now (no generation). */
async function resolveScenes(record: SceneRecord, style: string): Promise<Scene[]> {
  if (!record.plan) return [];
  const out: Scene[] = [];
  for (const s of record.plan.scenes) {
    const imgKey = `${s.id}-${styleSlug(style)}`;
    let image: string | undefined;
    let imageSource: Scene['imageSource'];
    if (record.images[imgKey]) {
      image = record.images[imgKey];
      imageSource = 'generated';
    } else {
      const path = await findBundledImage(record.key, s.id, style);
      if (path) {
        image = path;
        imageSource = 'bundled';
      }
    }
    out.push({ ...s, image, imageSource });
  }
  return out;
}

/**
 * Get the illustrated scenes for a chapter. Instant when shipped; in dev a
 * missing plan is generated and written back. Images are filled in by
 * `ensureSceneImages`, which callers run in the background.
 */
export async function getScenes(req: SceneRequest): Promise<SceneResult> {
  const style = req.style || DEFAULT_SCENE_STYLE;
  const key = sceneKey(req.tradition, req.translationId, req.bookSlug, req.chapter);
  const pending = inflightPlans.get(key);
  if (pending) return pending;

  const task = (async (): Promise<SceneResult> => {
    const record = await loadRecord(req);
    if (!record.plan) await loadBundledPlan(record);

    // Shipped content is canonical: if this device drew its own plan earlier
    // (e.g. offline) and a plan has since shipped, switch to the shipped one so
    // everyone sees the same scenes. Checked once per session per chapter.
    if (record.plan && record.planSource === 'ai' && !shippedChecked.has(key)) {
      shippedChecked.add(key);
      const probe: SceneRecord = { ...record, plan: null, planSource: null, bundledChecked: false, images: {} };
      await loadBundledPlan(probe);
      if (probe.plan) {
        record.plan = probe.plan;
        record.planSource = 'bundled';
        record.images = {};
        await save(record);
      }
    }

    if (!record.plan) {
      const allowAI = req.allowAI ?? runtimeAIEnabled();
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (!allowAI || !online || !req.verses.length) {
        return { scenes: [], planSource: null, status: 'unavailable', missingImages: 0 };
      }
      try {
        const scenes = await generateScenePlan(req.bookName, req.chapter, req.verses, req.tradition, req.isQuran);
        if (!scenes.length) return { scenes: [], planSource: null, status: 'unavailable', missingImages: 0 };
        record.plan = {
          scenes: scenes.map((s, i) => ({ ...s, id: `s${i + 1}` })),
          style: DEFAULT_SCENE_STYLE,
          generatedAt: new Date().toISOString(),
        };
        record.planSource = 'ai';
        await save(record);
        void persistPlanToProject(record);
      } catch (err) {
        console.warn(`[sceneBank] plan generation failed for ${key}`, err);
        return { scenes: [], planSource: null, status: 'unavailable', missingImages: 0 };
      }
    } else {
      await save(record);
    }

    const scenes = await resolveScenes(record, style);
    return {
      scenes,
      planSource: record.planSource,
      status: 'ready',
      missingImages: scenes.filter(s => !s.image).length,
    };
  })();

  inflightPlans.set(key, task);
  try {
    return await task;
  } finally {
    inflightPlans.delete(key);
  }
}

/**
 * Generate any missing scene pictures (dev / VITE_RUNTIME_AI only), storing
 * each and writing it back into the project. Calls `onScene` as each lands.
 */
export async function ensureSceneImages(
  req: SceneRequest,
  onScene?: (scene: Scene, index: number) => void
): Promise<number> {
  const allowAI = req.allowAI ?? runtimeAIEnabled();
  if (!allowAI) return 0;
  const style = req.style || DEFAULT_SCENE_STYLE;
  const record = await loadRecord(req);
  if (!record.plan) return 0;
  let generated = 0;
  for (let i = 0; i < record.plan.scenes.length; i++) {
    const s = record.plan.scenes[i];
    const imgKey = `${s.id}-${styleSlug(style)}`;
    if (record.images[imgKey]) continue;
    if (await findBundledImage(record.key, s.id, style)) continue;
    const lock = `${record.key}:${imgKey}`;
    if (inflightImages.has(lock)) continue;
    inflightImages.add(lock);
    try {
      const raw = await generatePanelImage(s.visualPrompt, style);
      if (!raw.startsWith('data:')) continue; // placeholder = failure
      const url = await compressImage(raw);
      record.images[imgKey] = url;
      await save(record);
      generated++;
      onScene?.({ ...s, image: url, imageSource: 'generated' }, i);
      void persistImageToProject(record, s.id, style, url);
    } catch (err) {
      console.warn(`[sceneBank] image failed for ${record.key} ${s.id}`, err);
    } finally {
      inflightImages.delete(lock);
    }
  }
  return generated;
}

/**
 * Shrink a generated picture (typically a 2–3 MB PNG) to a JPEG around
 * 1280px so it stores, ships and caches cheaply. Falls back to the original
 * outside a browser or on any failure.
 */
export async function compressImage(dataUrl: string, maxSide = 1280, quality = 0.86): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return dataUrl;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const timer = setTimeout(() => reject(new Error('decode timeout')), 4000);
      el.onload = () => { clearTimeout(timer); resolve(el); };
      el.onerror = () => { clearTimeout(timer); reject(new Error('decode failed')); };
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', quality);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

export async function getSceneBankStats(): Promise<{ chapters: number; scenes: number }> {
  const records = await idbGetAllRecords<SceneRecord>(SCENE_STORE);
  const all = records.length ? records : Array.from(memory.values());
  let scenes = 0;
  for (const r of all) scenes += r.plan?.scenes.length ?? 0;
  return { chapters: all.filter(r => !!r.plan).length, scenes };
}

const isDev = () => typeof import.meta !== 'undefined' && !!(import.meta as any).env?.DEV;

export async function persistPlanToProject(record: SceneRecord): Promise<boolean> {
  if (!isDev() || typeof fetch !== 'function' || !record.plan) return false;
  try {
    const res = await fetch('/__scripture/scenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradition: record.tradition, translation: record.translation, slug: record.slug, chapter: record.chapter, plan: record.plan }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function persistImageToProject(record: SceneRecord, sceneId: string, style: string, dataUrl: string): Promise<boolean> {
  if (!isDev() || typeof fetch !== 'function') return false;
  try {
    const res = await fetch('/__scripture/scene-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradition: record.tradition, translation: record.translation, slug: record.slug, chapter: record.chapter, sceneId, style: styleSlug(style), dataUrl }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function __resetSceneBankForTests() {
  memory.clear();
  inflightPlans.clear();
  inflightImages.clear();
  shippedChecked.clear();
}
