# Phase 1: Data Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Clean the data layer: convert all static scripture imports to lazy per-book fetch from `/public/data/`, add Service Worker for offline (vite-plugin-pwa + Workbox), fix localStorage safety vectors, and normalize Quran ayah numbering. The result: any verse in Protestant (66), Catholic (73), Ethiopian Orthodox (81+), and Quran (114 surahs) loads offline after first visit, from copyright-safe data, with no main bundle bloat and no crash vectors.

</domain>

<decisions>
## Implementation Decisions

### Copyright policy (DATA-04)
- Copyrighted translations (NIV, NLT, NKJV, NASB, NABRE) ARE included in the app — user's preferred translation is available
- All copyrighted translations display a clear copyright attribution notice in the **translation selector modal** (not per-verse footer)
- Attribution appears when user opens the translation picker, before selecting
- All translations — copyrighted or public domain — move to lazy-loaded per-book fetch from `/data/` (no static imports)
- STATE.md entry "remove NIV etc." is superseded by this decision — include with attribution is the path

### Data file architecture (DATA-01, DATA-02, DATA-03)
- **File granularity:** One JSON file per book per translation
  - Path pattern: `/data/{tradition}/{translation}/{book-slug}.json`
  - Example: `/data/protestant/kjv/genesis.json`, `/data/quran/yusuf-ali/al-fatiha.json`
- **JSON schema (flat verse map):**
  ```json
  { "1:1": "In the beginning God created...", "1:2": "And the earth was...", "2:1": "..." }
  ```
  Keys are `{chapter}:{verse}` strings. Simple, minimal nesting, easy to slice by chapter client-side.
- **Canon manifest (DATA-03):** Full metadata including verse counts per chapter, loads eagerly
  - Path: `/data/{tradition}/manifest.json`
  - Schema includes: book name, chapter count, verse count per chapter — enough for full Book→Chapter→Verse navigation without any text fetch
  - Accepts larger than 5KB if needed to include verse-level metadata

### Service Worker (DATA-02)
- vite-plugin-pwa + Workbox
- CacheFirst strategy for all `/data/**` routes
- Canon manifests pre-cached on install
- Per-book files cached on first access (not pre-cached — too large to pre-cache entire canon)

### localStorage safety
- All `localStorage.getItem()` + `JSON.parse()` calls wrapped in try-catch with safe fallback to default state
- On parse failure: log warning, reset to defaults, do NOT crash
- Affects: stats, notes, journeys, groups, heroes, offline packs, reader profile

### Tradition navigation model (NAV-01, NAV-02)
- **Tradition switcher:** Dropdown selector above the book list (not tabs)
  - Options: Protestant | Catholic | Ethiopian Orthodox | Quran
- **Book selector:** Same 3-level structure for all traditions — selector labels adapt:
  - Bible traditions: Book → Chapter → Verse
  - Quran: Surah → (chapter level maps to surah) → Ayah
- **Quran navigation:** The 3-level selector uses Surah as "Book", no separate "Chapter" concept — the third level shows Ayah number
- **Ethiopian Orthodox book list:** Single integrated list with section headers:
  - Old Testament | New Testament | Deuterocanonical | Additional Books (Enoch, Jubilees, etc.)
  - All in one scrollable list, no separate tabs

### Quran ayah numbering (CANON-04)
- Canonical convention: **Basmala NOT counted as verse 1** (Medina numbering)
  - 6,236 total ayahs across all 114 surahs
  - Al-Fatiha verse 1 = "All praise is due to Allah..." (Basmala is surah header)
  - Matches Quran.com and most modern Arabic editions
- UI label: **"Ayah"** (not "Verse") for Quran verse numbers
- Any source dataset that uses Basmala-as-verse-1 must be normalized on import

### Claude's Discretion
- Exact Workbox configuration options and cache version strategy
- Book slug naming convention for file paths (kebab-case assumed)
- How to handle edge cases where localStorage quota is exceeded on write
- Error UI when a data fetch fails (book JSON not found)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements and roadmap
- `.planning/REQUIREMENTS.md` — Full v1 requirements, especially DATA-01 through DATA-04, CANON-01 through CANON-04, NAV-01, NAV-02
- `.planning/ROADMAP.md` — Phase 1 success criteria (the 5 must-be-TRUE conditions)

### Existing code to read before modifying
- `services/textLibrary.ts` — Current static import pattern to replace; existing ScriptureEntry interface and loadChapterText() to refactor
- `services/cacheService.ts` — Existing localStorage cache (readStore/writeStore already has try-catch — verify and extend pattern to all App.tsx localStorage reads)
- `App.tsx` — All localStorage.getItem() calls (stats, notes, journeys, groups, heroes, offline, profile) must be audited for missing try-catch
- `types.ts` — BibleVersion enum, BOOK_COLLECTIONS, ChapterVerse, TextCatalogEntry — will need extension for new traditions
- `vite.config.ts` — Base Vite config to extend with vite-plugin-pwa

### External data sources
- `public/library/catalog.json` — Existing library catalog pattern (reference for new manifest schema design)
- `public/library/kjv.json` — Existing KJV format (to be split into per-book files)

No external spec documents — all requirements are captured in REQUIREMENTS.md and decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/textLibrary.ts` — `fetchJson<T>()` helper (reusable for all data fetches), `extractVersesFromScripture()` (handles multiple formats — needs to be updated for new flat schema), `translationCache` Map (per-file caching already exists)
- `services/cacheService.ts` — `readStore()` / `writeStore()` pattern with try-catch (extend this pattern to all App.tsx localStorage access)
- `types.ts` — `ChapterVerse`, `TextCatalogEntry`, `ChapterTextResult` interfaces (extend, don't replace)

### Established Patterns
- Static imports (NIV, NLT, NKJV, NASB, KJV, GNV in textLibrary.ts lines 2-8) → **must be removed** and replaced with fetch-based loading
- `import.meta.glob()` already used for dynamic loading — this pattern will be replaced by explicit `/data/` fetch calls
- localStorage accessed via `STORAGE_KEYS` constants in App.tsx — wrap all reads in try-catch
- `loadTextCatalog()` already uses a singleton promise pattern with null-reset on error — good pattern for manifest loading

### Integration Points
- `App.tsx` state `[version, setVersion]` uses `BibleVersion` enum — will need to support tradition-aware identifiers
- `BOOK_COLLECTIONS` in types.ts is the book list source — extend to include Catholic/Ethiopian sections
- `loadChapterText()` in textLibrary.ts is the primary API called from App.tsx — this function signature should stay stable; refactor its internals

</code_context>

<specifics>
## Specific Ideas

- The existing `translationCache` Map in textLibrary.ts is a good model for the per-book fetch cache — key by `{tradition}/{translation}/{book}`
- Manifest should be designed so the Phase 2 pipeline can write its generation status directly into the same manifest structure (verse-level metadata field reserved)
- "Ayah" label for Quran: adapt the existing verse label strings in the UI rather than building a separate navigation component

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-data-foundation*
*Context gathered: 2026-03-19*
