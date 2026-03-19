import { CanonManifest, Tradition, TRADITIONS } from './types';

const manifestCache = new Map<Tradition, Promise<CanonManifest>>();

// Load a single tradition's manifest (singleton promise with retry on error)
export async function loadManifest(tradition: Tradition): Promise<CanonManifest> {
  if (!manifestCache.has(tradition)) {
    const promise = fetch(`/data/${tradition}/manifest.json`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load ${tradition} manifest: ${res.status}`);
        return res.json() as Promise<CanonManifest>;
      })
      .catch(err => {
        manifestCache.delete(tradition); // Allow retry
        throw err;
      });
    manifestCache.set(tradition, promise);
  }
  return manifestCache.get(tradition)!;
}

// Load all manifests eagerly (call on app init)
export async function loadAllManifests(): Promise<Map<Tradition, CanonManifest>> {
  const results = new Map<Tradition, CanonManifest>();
  await Promise.all(
    TRADITIONS.map(async (t) => {
      try {
        const m = await loadManifest(t);
        results.set(t, m);
      } catch (err) {
        console.warn(`Failed to load ${t} manifest`, err);
      }
    })
  );
  return results;
}

// Get book slug for a tradition (from cached manifest)
export function findBookSlug(manifest: CanonManifest, bookDisplayName: string): string | undefined {
  const book = manifest.books.find(b => b.displayName === bookDisplayName);
  return book?.slug;
}
