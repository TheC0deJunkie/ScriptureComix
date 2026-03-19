# Architecture Research: ScriptureComix Offline-First Scripture Platform

**Confidence:** HIGH — grounded in direct codebase inspection + MDN storage API docs

---

## Recommended Architecture

Four layers with one-way data flow:

```
┌─────────────────────────────────────────────────────┐
│  UI LAYER (React Components)                        │
│  CanonSwitcher / VerseSelector / ContextPanel /     │
│  ComicPanel / SearchBar / OfflineIndicator          │
└────────────────────┬────────────────────────────────┘
                     │ props / callbacks
┌────────────────────▼────────────────────────────────┐
│  STATE / ORCHESTRATION (App.tsx)                    │
│  Selected canon, book, chapter, verse               │
│  Online/offline status                              │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
┌──────────▼──────────┐  ┌───────▼───────────────────┐
│  SCRIPTURE DATA     │  │  EXPLANATION + COMIC CACHE │
│  LAYER              │  │  LAYER                     │
│  Lazy fetch from    │  │  Pre-generated JSON (disk) │
│  public/data/*.json │  │  Comic images (IndexedDB)  │
│  SW CacheFirst      │  │  localStorage metadata     │
└──────────┬──────────┘  └───────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────┐
│  BUILD PIPELINE (runs offline, not on vite build)   │
│  scripts/generateExplanations.ts                    │
│  Node.js + AI API → commits JSON to repo            │
└─────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### `CanonSwitcher`
- **Props:** `canons: CanonMeta[]`, `selected: CanonId`, `onChange: (id) => void`
- **Does:** Renders tradition tabs (Protestant / Catholic / Ethiopian / Quran)
- **Does not:** Fetch data, know about books

### `VerseSelector`
- **Props:** `canon: CanonId`, `onSelect: (ref: VerseRef) => void`
- **Does:** Book → Chapter → Verse navigation using canon index
- **Does not:** Load verse text

### `ContextPanel`
- **Props:** `verseRef: VerseRef`, `surroundingVerses: Verse[]`, `explanation: ExplanationData | null`
- **Does:** Display passage (3-5 before/after) + narrative explanation
- **Does not:** Fetch anything — pure display component

### `ComicPanel`
- **Props:** `verse: Verse`, `isOnline: boolean`, `cachedImageUrl?: string`, `onGenerate: () => void`
- **Does:** Show AI image (online+cached) or stylized text card (offline)
- **Does not:** Call AI directly — delegates to service

### `SearchBar`
- **Props:** `canons: CanonId[]`, `onResult: (ref: VerseRef) => void`
- **Does:** Full-text search across loaded canon indexes
- **Does not:** Load all verse text for search — indexes only

### `OfflineIndicator`
- **Props:** `isOnline: boolean`
- **Does:** Shows connectivity status badge

---

## Data Layer Architecture

### Scripture JSON Shape (per-book file)
```json
{
  "book": "Genesis",
  "bookId": "GEN",
  "canon": "protestant",
  "translation": "kjv",
  "chapters": [
    {
      "chapter": 1,
      "verses": [
        { "verse": 1, "text": "In the beginning..." },
        { "verse": 2, "text": "And the earth..." }
      ]
    }
  ]
}
```

### Explanation JSON Shape (per-book file)
```json
{
  "bookId": "GEN",
  "canon": "protestant",
  "verses": {
    "1:1": {
      "contextVerses": "1:1-5",
      "narrative": "This is the opening of the creation story...",
      "laymanSummary": "God made everything from nothing..."
    }
  }
}
```

### Canon Index Shape (per-canon, loaded eagerly, ~5KB)
```json
{
  "id": "protestant",
  "name": "Protestant Bible",
  "books": [
    { "id": "GEN", "name": "Genesis", "chapters": 50 },
    ...
  ]
}
```

---

## Build Pipeline Design

### `scripts/generateExplanations.ts`
- **NOT a Vite plugin** — runs separately (`npm run generate:explanations`)
- Input: All scripture JSON in `public/data/`
- Output: Explanation JSON written to `public/data/explanations/`
- **Must have checkpoint/resume** — 44K+ API calls will take hours and hit rate limits
- Checkpoint file: `scripts/.generate-checkpoint.json` (tracks last completed verse)
- Output is committed to git (large but static — changes rarely)

### Run order
```bash
# 1. Fetch/convert all scripture sources to public/data/ format
npm run import:scriptures

# 2. Generate explanations (run once, can be resumed)
npm run generate:explanations

# 3. Normal build
npm run build
```

---

## Caching Architecture

### Comic Panel Images → IndexedDB (via `idb`)
- URL-addressed blobs stored under key `comic:{verseRef}:{artStyle}`
- LRU eviction at 80% quota (use `navigator.storage.estimate()`)
- Request `navigator.storage.persist()` on first generation
- **Why not Cache API:** Cache API requires URL-addressable resources; generated images are blobs
- **Why not localStorage:** 5-10MB limit hit within minutes of use

### Explanation JSON → Service Worker CacheFirst
- `/data/explanations/**` routes cached by Workbox CacheFirst
- No IndexedDB needed — these are static files served from `public/`

### Verse Text → Service Worker CacheFirst
- `/data/**` routes cached on first access
- Per-book lazy fetch: only load what the user actually reads

---

## Critical Fix: Remove Static Imports

`textLibrary.ts` lines 2-7 currently eagerly bundle 6 translations:
```ts
// ❌ REMOVE THESE — bundles ~28MB at startup
import kjv from '../public/library/en_kjv/...'
import niv from '../public/library/en_niv/...'
...
```

Replace with runtime fetch from `public/data/`:
```ts
// ✓ Lazy fetch — only loads what user requests
const book = await fetch(`/data/protestant/kjv/${bookId}.json`).then(r => r.json())
```

---

## Build Order (5 phases, sequential dependencies)

1. **Data Foundation** — migrate existing data to `public/data/` lazy chunks, fix static imports, add Service Worker, build canon indexes
2. **Explanation Pipeline** — build-time generation script with checkpoint/resume, explanation JSON schema
3. **Context Panel** — `contextWindowService` + `ContextPanel` component
4. **Comic Cache Upgrade** — IndexedDB image storage replacing/augmenting localStorage
5. **UI Integration** — `CanonSwitcher`, cross-tradition `SearchBar`, `OfflineIndicator`

---

## Anti-Patterns to Avoid

| Pattern | Why It Fails |
|---------|-------------|
| Eager static imports for scripture | ~28MB in main bundle, crashes on mobile |
| Per-verse explanation files | 31K+ files crashes Vite chunk manifest |
| localStorage for comic images | 5-10MB limit, immediate eviction |
| AI generation in `vite build` | Takes hours, blocks CI/CD, devs hate it |
| Monolithic App.tsx state | Already a concern — add canon state via context/store |

---

*Research completed: 2026-03-19*
