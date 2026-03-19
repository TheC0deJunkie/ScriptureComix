# Phase 1: Data Foundation - Research

**Researched:** 2026-03-19
**Domain:** Data pipeline migration, PWA/Service Worker, localStorage safety, multi-tradition scripture data
**Confidence:** HIGH (direct codebase inspection + dataset analysis + npm registry checks)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Copyright policy (DATA-04)**
- Copyrighted translations (NIV, NLT, NKJV, NASB, NABRE) ARE included in the app — user's preferred translation is available
- All copyrighted translations display a clear copyright attribution notice in the translation selector modal (not per-verse footer)
- Attribution appears when user opens the translation picker, before selecting
- All translations — copyrighted or public domain — move to lazy-loaded per-book fetch from `/data/` (no static imports)

**Data file architecture (DATA-01, DATA-02, DATA-03)**
- File granularity: one JSON file per book per translation
  - Path pattern: `/data/{tradition}/{translation}/{book-slug}.json`
  - Example: `/data/protestant/kjv/genesis.json`, `/data/quran/yusuf-ali/al-fatiha.json`
- JSON schema (flat verse map): `{ "1:1": "text", "1:2": "text", "2:1": "..." }`
  - Keys are `{chapter}:{verse}` strings
- Canon manifest (DATA-03): Full metadata including verse counts per chapter, loads eagerly
  - Path: `/data/{tradition}/manifest.json`
  - Schema includes: book name, chapter count, verse count per chapter

**Service Worker (DATA-02)**
- vite-plugin-pwa + Workbox
- CacheFirst strategy for all `/data/**` routes
- Canon manifests pre-cached on install
- Per-book files cached on first access (not pre-cached)

**localStorage safety**
- All `localStorage.getItem()` + `JSON.parse()` calls wrapped in try-catch with safe fallback
- On parse failure: log warning, reset to defaults, do NOT crash

**Tradition navigation model (NAV-01, NAV-02)**
- Tradition switcher: dropdown selector above the book list
  - Options: Protestant | Catholic | Ethiopian Orthodox | Quran
- Book selector: same 3-level structure; labels adapt: Bible = Book/Chapter/Verse, Quran = Surah/(no chapter)/Ayah
- Ethiopian Orthodox: single integrated list with section headers (OT / NT / Deuterocanonical / Additional Books)

**Quran ayah numbering (CANON-04)**
- Canonical convention: Basmala NOT counted as verse 1 (Medina numbering)
  - 6,236 total ayahs across 114 surahs
  - Al-Fatiha verse 1 = "All praise belongs to Allah..." (Basmala is surah header, not verse 1)
  - Matches Quran.com and most modern Arabic editions
- UI label: "Ayah" (not "Verse") for Quran verse numbers
- Any source dataset that uses Basmala-as-verse-1 must be normalized on import

### Claude's Discretion
- Exact Workbox configuration options and cache version strategy
- Book slug naming convention for file paths (kebab-case assumed)
- How to handle edge cases where localStorage quota is exceeded on write
- Error UI when a data fetch fails (book JSON not found)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | App loads scripture data lazily per-book from `public/data/` via fetch — no static imports in the JS bundle | KJV/NIV/WEB/NKJV/NASB/GNV all ~4.7–4.9MB monolithic JSONs; split into per-book files to eliminate static imports at lines 2–7 of textLibrary.ts |
| DATA-02 | App works fully offline after first visit via Service Worker (vite-plugin-pwa + Workbox CacheFirst for `/data/**`) | vite-plugin-pwa 1.2.0 confirmed compatible with Vite 6.x; no PWA plugin currently installed |
| DATA-03 | Per-tradition canon index manifests (~5KB each) load eagerly so book/chapter lists render without fetching full text | Must create `/data/{tradition}/manifest.json` for 4 traditions; chapter/verse metadata exists in existing datasets |
| DATA-04 | Copyrighted translations are included AND display copyright attribution in the translation selector modal | Current codebase has copyrighted texts as static imports; migrate all to per-book fetch; show attribution before selection |
| CANON-01 | Full Protestant canon (66 books) in KJV, WEB, NIV, NLT, NKJV, NASB offline | KJV and WEB = 66 books each in bible-translations-master; NIV/NLT/NKJV/NASB = 66 books each |
| CANON-02 | Full Catholic canon (73 books) including all 7 deuterocanonical books offline | NABRE dataset confirmed: 73 books with Tobit, Judith, 1-2 Maccabees, Wisdom, Sirach, Baruch present as per-book JSON files |
| CANON-03 | Ethiopian Orthodox canon (OT+NT + 1 Enoch + Jubilees + public-domain additions) offline | 1 Enoch (R.H. Charles) is a stub (763 bytes) — needs real data; Jubilees has no local file — needs sourcing |
| CANON-04 | Full Quran (114 surahs) in Yusuf Ali translation offline | Dataset present (4.1MB) with 6,236 ayahs and 114 surahs; NORMALIZATION REQUIRED — Basmala is currently verse 1 in Al-Fatiha but must be demoted to surah header |
| NAV-01 | Tradition switcher: Protestant / Catholic / Ethiopian Orthodox / Quran | types.ts BOOK_COLLECTIONS is Protestant-only; needs extension for all 4 traditions; dropdown UI to be added |
| NAV-02 | Book → Chapter → Verse navigation within each tradition | 3-level selector exists; labels must adapt (Surah/Ayah for Quran); Quran has no "chapter" sub-level |
</phase_requirements>

---

## Summary

Phase 1 is fundamentally a **data migration and infrastructure phase** with no new user-visible features beyond the tradition switcher and navigation UI. The core work is threefold: (1) convert all scripture data from large monolithic static imports to small per-book fetch-based JSON files; (2) add the Service Worker so those fetched files are available offline; (3) fix the localStorage crash vectors and add the tradition-aware navigation model.

The existing codebase already has the right architectural skeletons: `fetchJson<T>()`, `translationCache` Map, `loadTextCatalog()` singleton promise, and `readStore()`/`writeStore()` try-catch pattern. The work is wiring these patterns together consistently, removing six static imports (~29MB total), and running data transformation scripts against the three raw source repositories already on disk.

The Quran dataset requires specific normalization: the source file (`AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION.json`) counts Basmala as Al-Fatiha verse 1, but the locked decision requires Al-Fatiha verse 1 = "All praise belongs to Allah..." with Basmala stored as a surah header field, not a verse. The NABRE dataset uses CamelCase book names without spaces (`1Samuel`, `SongofSongs`) while the app's `BOOK_COLLECTIONS` uses spaced names (`1 Samuel`, `Song of Solomon`) — a normalization mapping is required.

**Primary recommendation:** Build a single Node.js data transformation script (replacing the incomplete `scripts/importPublicDomainCanons.ts`) that reads all four source datasets and writes per-book JSON files in the flat `{ "1:1": "text" }` schema to `public/data/`. Then add vite-plugin-pwa, refactor `textLibrary.ts`, and patch App.tsx localStorage reads.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite-plugin-pwa | 1.2.0 | Injects Service Worker + Workbox config into Vite build | Official Vite PWA integration; confirmed compatible with Vite ^6.0.0; peer dep satisfied |
| workbox-window | 7.4.0 | Client-side SW registration and update handling | Required peer dep of vite-plugin-pwa; provides `Workbox` class for SW lifecycle |
| Node.js `fs/promises` | built-in | Data transformation scripts | No library needed; scripts are build-time only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript (ts-node or tsx) | ~5.8.2 (already installed) | Run data transformation scripts as TypeScript | For the build scripts that convert source datasets to per-book files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vite-plugin-pwa | Manual service worker | Manual SW requires hand-rolling cache strategy, precache manifest generation, and SW update logic — defeats the point |
| Flat verse map `"1:1"` | Nested `{ chapters: { "1": { verses: [] } } }` | Flat is smaller JSON (no wrapper keys), simpler to slice by chapter with a filter, agreed in CONTEXT.md |

**Installation:**
```bash
npm install -D vite-plugin-pwa workbox-window
```

**Version verification:** Confirmed via `npm view vite-plugin-pwa version` → `1.2.0` and `npm view workbox-window version` → `7.4.0` on 2026-03-19.

---

## Architecture Patterns

### Recommended Data Directory Structure
```
public/
└── data/
    ├── protestant/
    │   ├── manifest.json          # Book list + verse counts per chapter
    │   ├── kjv/
    │   │   ├── genesis.json       # { "1:1": "In the beginning...", "1:2": "..." }
    │   │   ├── exodus.json
    │   │   └── ...66 files
    │   ├── web/
    │   ├── niv/
    │   ├── nlt/
    │   ├── nkjv/
    │   └── nasb/
    ├── catholic/
    │   ├── manifest.json          # 73 books
    │   └── nabre/
    │       ├── genesis.json
    │       ├── tobit.json
    │       └── ...73 files
    ├── ethiopian/
    │   ├── manifest.json          # 81 books (66 + deut + enoch + jubilees)
    │   └── kjv/                   # Protestant books use KJV text
    │       └── ...plus enoch.json, jubilees.json
    └── quran/
        ├── manifest.json          # 114 surahs
        └── yusuf-ali/
            ├── al-fatiha.json     # { "1": "All praise...", "2": "..." } (Basmala in metadata)
            └── ...114 files
```

### Pattern 1: Per-Book Fetch with Translation Cache
**What:** Each `loadChapterText()` call fetches a per-book JSON file (if not cached), extracts the chapter slice, and returns `ChapterVerse[]`.
**When to use:** All scripture text loading throughout the app.

```typescript
// Refactored textLibrary.ts pattern
const bookCache = new Map<string, Record<string, string>>(); // key: "tradition/translation/book-slug"

async function loadBookFile(tradition: string, translation: string, slug: string): Promise<Record<string, string>> {
  const key = `${tradition}/${translation}/${slug}`;
  if (bookCache.has(key)) return bookCache.get(key)!;
  const data = await fetchJson<Record<string, string>>(`/data/${key}.json`);
  bookCache.set(key, data);
  return data;
}

// Extract chapter from flat verse map
function extractChapter(bookData: Record<string, string>, chapter: number): ChapterVerse[] {
  const prefix = `${chapter}:`;
  return Object.entries(bookData)
    .filter(([key]) => key.startsWith(prefix))
    .sort((a, b) => Number(a[0].split(':')[1]) - Number(b[0].split(':')[1]))
    .map(([key, text]) => ({ verse: Number(key.split(':')[1]), text }));
}
```

### Pattern 2: Manifest-Based Navigation (DATA-03)
**What:** Canon manifests load eagerly on app init, providing all metadata for book/chapter/verse selectors without waiting for text fetches.
**When to use:** Book list rendering, chapter count display, verse count per chapter.

```typescript
// Manifest schema
interface CanonManifest {
  tradition: string;          // "protestant" | "catholic" | "ethiopian" | "quran"
  displayName: string;
  books: ManifestBook[];
  translations: TranslationMeta[];
}

interface ManifestBook {
  slug: string;              // "genesis", "al-fatiha"
  displayName: string;       // "Genesis", "Al-Fatiha"
  section?: string;          // "Old Testament", "Deuterocanonical", "Additional Books"
  chapters: number[];        // verse count per chapter; index 0 = chapter 1
}

interface TranslationMeta {
  id: string;                // "kjv", "niv"
  displayName: string;       // "King James Version"
  copyright?: string;        // Attribution string shown before selection
  isPublicDomain: boolean;
}
```

### Pattern 3: vite-plugin-pwa Configuration
**What:** Minimal Workbox setup with CacheFirst for `/data/**` routes and manifest precaching.

```typescript
// vite.config.ts addition
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html}'],  // App shell only
    runtimeCaching: [
      {
        urlPattern: /^\/data\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'scripture-data-v1',
          expiration: { maxEntries: 1000 },
        },
      },
    ],
  },
})
```

**Cache version strategy (Claude's discretion):** Use `cacheName: 'scripture-data-v1'`; increment version string when data schema changes to force cache invalidation.

### Pattern 4: Safe localStorage Reads
**What:** Wrap all `localStorage.getItem()` + `JSON.parse()` in try-catch. Log warning on failure, return the default state value instead of crashing.

```typescript
// Replace all bare JSON.parse(localStorage.getItem(...)) calls in App.tsx with:
function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[storage] corrupt data at key "${key}", resetting to default`);
    return fallback;
  }
}
```

**Affected keys in App.tsx (all require this pattern):**
- `STORAGE_KEYS.stats` (line 159) — `parsed.tier` fallback exists but JSON.parse is unguarded
- `STORAGE_KEYS.notes` (line 167) — completely unguarded
- `STORAGE_KEYS.journeys` (line 169) — completely unguarded
- `STORAGE_KEYS.activeJourney` (line 171) — unguarded (string read, safe, but setItem calls may corrupt)
- `STORAGE_KEYS.groups` (line 173) — completely unguarded
- `STORAGE_KEYS.heroes` (line 175) — completely unguarded
- `STORAGE_KEYS.activeHeroes` (line 177) — completely unguarded
- `STORAGE_KEYS.offline` (line 179) — completely unguarded
- `STORAGE_KEYS.profile` (lines 180–193) — has try-catch for shape, but not for parse itself

### Anti-Patterns to Avoid
- **Using `import.meta.glob()` to replace static imports:** The current `repoBibleModules`, `repoQuranModules`, `repoDeutModules` globs in `textLibrary.ts` still bundle file paths and cause Vite to include them in the build graph. Remove all three globs and replace with explicit `/data/` fetch calls.
- **Pre-caching all `/data/**` files via Workbox `globPatterns`:** Total data size will be 300MB+ when all translations are split. Never add `/data/` to `globPatterns` — use `runtimeCaching` with CacheFirst only.
- **Keeping book name format inconsistent:** The NABRE dataset uses `1Samuel`; bible-translations-master uses `1 Samuel`; types.ts uses `1 Samuel`. Normalize at transform time so slugs are always kebab-case (`1-samuel`) and display names are always human-readable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service Worker offline caching | Custom SW with manual cache logic | vite-plugin-pwa + Workbox | Workbox handles cache versioning, update broadcasting, stale-while-revalidate — 1000+ edge cases |
| Precache manifest generation | Script to list all static files | vite-plugin-pwa `globPatterns` | Build tool generates hashed manifest automatically on each build |
| SW registration and update UI | Custom navigator.serviceWorker code | workbox-window `Workbox` class | Handles `waiting`, `activated`, and `controlling` lifecycle events |

**Key insight:** The Service Worker domain has catastrophic failure modes (stale SW serving old app shell with new API contract). Using vite-plugin-pwa's well-tested defaults eliminates an entire class of bugs.

---

## Common Pitfalls

### Pitfall 1: Quran Basmala Numbering Mismatch
**What goes wrong:** The source dataset (`AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION.json`) counts Basmala as Al-Fatiha verse 1. The app requirement is Al-Fatiha verse 1 = "All praise belongs to Allah..." with Basmala stored as a metadata field.
**Why it happens:** Multiple Quran numbering conventions exist (Medina, Kufa). The dataset author used one convention; the product decision uses another.
**How to avoid:** During data transformation, detect Al-Fatiha and remap: store `translation_eng` of verse 1 (Basmala) as `surah.basmala` field in the manifest; renumber verses 2–7 as 1–6. All other surahs: use verse numbers as-is (Al-Tawbah has no Basmala).
**Warning signs:** Total Quran ayah count in the output files is 6,237 instead of 6,236.

### Pitfall 2: Translation Footnotes in Quran Text
**What goes wrong:** 464 of 6,236 Quran `translation_eng` values contain inline footnotes embedded in the text (e.g., `"Guide us on the straight path,\nFor further references..."`). These appear verbatim in the UI.
**Why it happens:** The dataset includes scholarly footnotes concatenated with verse text.
**How to avoid:** During data transformation, strip footnote content. The existing `cleanTranslation()` function in `textLibrary.ts` partially handles this (removes digit markers) but does NOT strip the footnote text body. The transform script must truncate text at the first footnote separator or strip footnote paragraphs.
**Warning signs:** Verse text in the UI runs for 500+ characters for a single ayah.

### Pitfall 3: Book Name Normalization Gap
**What goes wrong:** Three naming conventions exist across source datasets — NABRE uses `1Samuel`, `SongofSongs`; bible-translations-master uses `1 Samuel`, `Song of Solomon`; Quran uses numeric surah IDs. If slugs are generated inconsistently, fetch calls for `1-samuel.json` will 404 while `1samuel.json` exists.
**Why it happens:** Source datasets were created independently with no shared naming standard.
**How to avoid:** The transform script must own the canonical slug mapping. Every book in every tradition gets a slug derived from a central lookup table (not auto-generated from source keys). Example: `"1 Samuel"` and `"1Samuel"` both map to slug `1-samuel`.

### Pitfall 4: vite-plugin-pwa and HMR Conflict in Dev
**What goes wrong:** vite-plugin-pwa generates a Service Worker that interferes with hot-module reload in development, causing stale content to be served from cache.
**Why it happens:** SW intercepts all requests including Vite's HMR WebSocket.
**How to avoid:** Set `devOptions: { enabled: false }` in the VitePWA config, or use `mode: 'development'` with `type: 'module'` SW only in dev. Official recommendation is to disable the SW in development entirely.

### Pitfall 5: localStorage Quota on Write
**What goes wrong:** `localStorage.setItem()` throws `QuotaExceededError` when storage is full (typically 5MB per origin). This crashes the app if unhandled.
**Why it happens:** App state (offline packs, stats, notes) accumulates over time.
**How to avoid (Claude's discretion):** Wrap all `localStorage.setItem()` calls in try-catch. On quota error: log a warning, optionally evict the oldest offline pack, do not crash. The existing `writeStore()` in `cacheService.ts` already does this — extend the same pattern to all `localStorage.setItem()` calls in App.tsx.

### Pitfall 6: Static Import Residue via `import.meta.glob`
**What goes wrong:** Even after removing the six direct static imports (`kjvBible`, `nivBible`, etc.), the three `import.meta.glob()` calls in `textLibrary.ts` still reference the `bible-translations-master/` directory paths. Vite includes globbed files in the bundle dependency graph.
**Why it happens:** `import.meta.glob` is resolved at build time; Vite treats all matched files as potential bundle entries.
**How to avoid:** Remove all three `repoBibleModules`, `repoQuranModules`, `repoDeutModules` glob declarations entirely. The source data directories (`bible-translations-master/`, `AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION/`, `bible-nabre-json-dataset-including-deutoronocanical/`) should only be read by the transform script, never imported by the browser app.

---

## Code Examples

Verified patterns from codebase inspection:

### Existing fetchJson (reusable — keep as-is)
```typescript
// Source: services/textLibrary.ts lines 53-59
const fetchJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`);
  }
  return (await res.json()) as T;
};
```

### Existing loadTextCatalog singleton pattern (model for manifest loading)
```typescript
// Source: services/textLibrary.ts lines 61-69
// Re-use this exact pattern for each tradition's manifest:
let catalogPromise: Promise<Catalog> | null = null;
export const loadTextCatalog = async (): Promise<Catalog> => {
  if (!catalogPromise) {
    catalogPromise = fetchJson<Catalog>(CATALOG_PATH).catch(err => {
      catalogPromise = null;  // Reset on error so next call retries
      throw err;
    });
  }
  return catalogPromise;
};
```

### Existing writeStore try-catch (model for all localStorage writes)
```typescript
// Source: services/cacheService.ts lines 21-28
const writeStore = (store: CacheStore) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn("Cache write failed", error);
  }
};
```

### Data Transform Script: KJV per-book output example
```typescript
// Transform input: bible-translations-master KJV JSON
// { "Genesis": { "1": { "1": "In the beginning...", "2": "..." }, "2": {...} }, ... }
// Transform output: public/data/protestant/kjv/genesis.json
// { "1:1": "In the beginning...", "1:2": "...", "2:1": "..." }

function transformBibleBook(sourceBook: Record<string, Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [chapter, verses] of Object.entries(sourceBook)) {
    for (const [verse, text] of Object.entries(verses)) {
      result[`${chapter}:${verse}`] = text;
    }
  }
  return result;
}
```

### Data Transform Script: NABRE per-book output example
```typescript
// Transform input: nabre.json per-book format
// [{ "book": "Genesis", "chapters": [{ "chapter": 1, "verses": [{ "verse": 1, "text": "..." }] }] }]
// Transform output: public/data/catholic/nabre/genesis.json
// { "1:1": "...", "1:2": "..." }

function transformNABREBook(chapters: Array<{chapter: number, verses: Array<{verse: number, text: string}>}>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const ch of chapters) {
    for (const v of ch.verses) {
      result[`${ch.chapter}:${v.verse}`] = v.text;
    }
  }
  return result;
}
```

### Data Transform Script: Quran Al-Fatiha normalization
```typescript
// Basmala remap: store Basmala in manifest, renumber remaining 6 verses as 1-6
function normalizeFatiha(rawVerses: Record<string, {translation_eng: string}>): {
  basmala: string;
  verses: Record<string, string>;
} {
  const basmala = cleanQuranText(rawVerses['1'].translation_eng);
  const verses: Record<string, string> = {};
  // Remap verses 2-7 to 1-6
  for (let i = 2; i <= 7; i++) {
    verses[`1:${i - 1}`] = cleanQuranText(rawVerses[String(i)].translation_eng);
  }
  return { basmala, verses };
}
```

---

## Dataset Inventory (Verified by Direct Inspection)

### Source Data Available On Disk

| Dataset | Path | Size | Format | Status |
|---------|------|------|--------|--------|
| KJV | `bible-translations-master/.../KJV/KJV_bible.json` | 4.8MB | `{Book: {ch: {v: text}}}` | Ready — 66 books |
| WEB | `bible-translations-master/.../WEB/WEB_bible.json` | 4.9MB | Same as KJV | Ready — 66 books |
| NIV | `bible-translations-master/.../NIV/NIV_bible.json` | 4.7MB | Same as KJV | Ready — 66 books (copyrighted) |
| NLT | `bible-translations-master/.../NLT/NLT_bible.json` | 4.9MB | Same as KJV | Ready — 66 books (copyrighted) |
| NKJV | `bible-translations-master/.../NKJV/NKJV_bible.json` | 4.9MB | Same as KJV | Ready — 66 books (copyrighted) |
| NASB | `bible-translations-master/.../NASB/NASB_bible.json` | 4.9MB | Same as KJV | Ready — 66 books (copyrighted) |
| GNV | `bible-translations-master/.../GNV/GNV_bible.json` | 4.8MB | Same as KJV | Ready — 66 books (public domain 1599) |
| NABRE (all 73) | `bible-nabre-json-dataset.../generated_data/books/*.json` | Per-book files exist | `{book, chapters:[{chapter, verses:[{verse, text}]}]}` | Ready — 73 files including all 7 deuterocanonical |
| Quran | `AL-QURAN_.../AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION.json` | 4.1MB | `{chapters: {"1": {total_verses, verses: {"1": {translation_eng}}}}}` | Needs normalization (footnotes + Basmala) |
| 1 Enoch | `public/library/enoch.json` | 763 bytes | Stub only — 2 verses | INCOMPLETE — needs real text |
| Jubilees | none | — | — | MISSING — needs sourcing |

### Data Gaps Requiring Action Before Implementation

1. **1 Enoch**: The `public/library/enoch.json` is a stub with only 2 verses. The R.H. Charles 1912 translation (public domain) must be sourced and converted to the flat verse map format. Chapter count: 108 chapters.

2. **Book of Jubilees**: No local file exists. The public domain R.H. Charles 1913 translation of Jubilees must be sourced. Chapter count: 50 chapters.

3. **Ethiopian Orthodox additional books**: The CONTEXT.md specifies "OT+NT+Enoch+Jubilees" — Meqabyan is deferred to v2. So the gap is only Enoch (stub) and Jubilees (missing).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Service Worker | vite-plugin-pwa (Workbox) | Vite 3+ era | Remove ~200 lines of SW boilerplate, auto-generates precache manifest |
| Large monolithic JSON static imports | Per-book fetch from `/public/data/` | This phase | Eliminates ~29MB from JS bundle |
| `import.meta.glob` for dynamic loading | Explicit `/data/` fetch URL construction | This phase | Removes Vite's build-time inclusion of source data dirs |
| `BOOK_COLLECTIONS` (Protestant only) | Tradition-aware book lists from manifests | This phase | Manifests drive navigation for all 4 traditions |

**Deprecated/outdated in this codebase:**
- `scripts/importPublicDomainCanons.ts`: Scaffold only, expects `data/sources/*.json` which don't exist. Replace with a new transform script that reads the source repos directly.
- `public/library/catalog.json` + `public/library/kjv.json`/`web.json`/`enoch.json`: Old library format (nested verse arrays). These will be superseded by the per-book flat format in `public/data/`. Keep old catalog read path alive until App.tsx is fully migrated.
- Static imports at `textLibrary.ts` lines 2–7: All six removed in this phase.

---

## Open Questions

1. **Yusuf Ali vs. dataset translation name**
   - What we know: The CONTEXT.md specifies "Yusuf Ali translation" for the Quran. The on-disk dataset uses `translation_eng` which appears to be a different scholarly translation (mentions "All-beneficent" phrasing from an Agha Pooya / Sarwar-style translation, not the classic Yusuf Ali "Most Gracious, Most Merciful" phrasing).
   - What's unclear: Is this dataset actually Yusuf Ali, or a different translation? The dataset file has no `meta.title` or attribution field.
   - Recommendation: Include correct attribution in the manifest's `TranslationMeta.copyright` field after verifying source. If not Yusuf Ali, label it correctly (e.g., "English Translation with Transliteration") rather than mislabeling as Yusuf Ali.

2. **Enoch and Jubilees sourcing**
   - What we know: Both are required for CANON-03. The R.H. Charles translations are public domain. No complete local text exists.
   - What's unclear: Exact verse/chapter structure for machine-readable conversion.
   - Recommendation: The data transform script can handle these if plain text or structured HTML is obtained from Project Gutenberg or sacred-texts.com. This is a prerequisite for CANON-03 — the transform task must either source these texts or produce partial output with a clear placeholder.

3. **Copyrighted translations file structure**
   - What we know: NIV/NLT/NKJV/NASB are included in `bible-translations-master` and will be converted to per-book files in `public/data/`. The CONTEXT.md decision is to include them with attribution.
   - What's unclear: Legal exposure of committing transformed NIV/NKJV/NASB/NLT text to the git repo. These translations require publisher licenses for redistribution.
   - Recommendation: This is a product/legal decision already locked by the user. As a technical safeguard, add `public/data/protestant/niv/`, `nlt/`, `nkjv/`, `nasb/` to `.gitignore` so the text files are generated locally and served but not committed. Attribution in the UI satisfies the user's stated policy; license compliance is the user's responsibility.

---

## Validation Architecture

`nyquist_validation` is enabled (from `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, or test directory exists |
| Config file | None — Wave 0 must create vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` (after Wave 0 setup) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Bundle size under 1MB; no static imports | build + size check | `npx vite build && du -sh dist/assets/*.js` | ❌ Wave 0 |
| DATA-01 | `loadChapterText()` fetches from `/data/` not static | unit | `npx vitest run tests/textLibrary.test.ts -t "loadChapterText fetches per-book"` | ❌ Wave 0 |
| DATA-02 | Service Worker registered and CacheFirst applies to `/data/**` | smoke | Manual browser check (DevTools > Application > Service Workers) | manual-only |
| DATA-03 | Manifest loads eagerly before any text fetch | unit | `npx vitest run tests/manifest.test.ts -t "loadManifest resolves before loadBook"` | ❌ Wave 0 |
| DATA-04 | No static KJV/NIV/WEB imports remain in textLibrary.ts | static analysis | `grep -r "bible-translations-master" src/ services/ -- exit 1 if found` | ❌ Wave 0 (grep check) |
| CANON-01 | Protestant 66 books accessible via `loadChapterText` | unit | `npx vitest run tests/canons.test.ts -t "protestant 66 books"` | ❌ Wave 0 |
| CANON-02 | Catholic 73 books accessible including Tobit | unit | `npx vitest run tests/canons.test.ts -t "catholic 73 books"` | ❌ Wave 0 |
| CANON-03 | Ethiopian Enoch and Jubilees accessible | unit | `npx vitest run tests/canons.test.ts -t "ethiopian enoch jubilees"` | ❌ Wave 0 |
| CANON-04 | Quran Al-Fatiha verse 1 != Basmala; total ayahs = 6236 | unit | `npx vitest run tests/quran.test.ts -t "fatiha numbering"` | ❌ Wave 0 |
| NAV-01 | Tradition switcher renders 4 options | unit/component | `npx vitest run tests/nav.test.ts -t "tradition switcher"` | ❌ Wave 0 |
| NAV-02 | Quran selector uses Surah/Ayah labels, not Book/Verse | unit/component | `npx vitest run tests/nav.test.ts -t "quran labels"` | ❌ Wave 0 |
| localStorage safety | All 8 keys use try-catch; corrupt JSON returns default | unit | `npx vitest run tests/storage.test.ts -t "corrupt JSON falls back"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot` (fast, dot output)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `vite build` completes with bundle < 1MB before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — vitest configuration (jsdom environment for component tests)
- [ ] `tests/textLibrary.test.ts` — covers DATA-01 fetch pattern
- [ ] `tests/manifest.test.ts` — covers DATA-03 manifest loading
- [ ] `tests/canons.test.ts` — covers CANON-01 through CANON-03 data completeness
- [ ] `tests/quran.test.ts` — covers CANON-04 ayah numbering normalization
- [ ] `tests/nav.test.ts` — covers NAV-01 and NAV-02 UI label adaptation
- [ ] `tests/storage.test.ts` — covers localStorage crash resistance
- [ ] Framework install: `npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom`

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `services/textLibrary.ts`, `services/cacheService.ts`, `App.tsx`, `types.ts`, `vite.config.ts`, `package.json`
- Direct dataset inspection — KJV/WEB/NIV/NABRE/Quran JSON files on disk (byte counts, structure, verse counts)
- `npm view vite-plugin-pwa version` → 1.2.0 (verified 2026-03-19)
- `npm view workbox-window version` → 7.4.0 (verified 2026-03-19)
- `npm view vite-plugin-pwa@1.2.0 peerDependencies` — confirmed Vite ^6.0.0 compatibility

### Secondary (MEDIUM confidence)
- vite-plugin-pwa documentation pattern for `runtimeCaching` with `CacheFirst` (consistent with Workbox docs)
- Quran ayah numbering analysis: counted 6,236 total in dataset; verified Basmala is verse 1 in Al-Fatiha requiring normalization per CONTEXT.md requirement

### Tertiary (LOW confidence)
- Translation attribution requirements for NIV/NKJV/NASB/NLT — legal analysis not performed; user has made the policy decision

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry; peerDeps confirmed
- Architecture: HIGH — patterns derive directly from existing codebase code that works
- Data transformation: HIGH — all source datasets inspected directly; structures confirmed
- Pitfalls: HIGH — Quran numbering mismatch verified by direct comparison; localStorage gaps verified by reading App.tsx line by line
- Validation: MEDIUM — vitest is the obvious choice for Vite projects but no test infra exists yet

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable stack; dataset structures won't change since they're local files)
