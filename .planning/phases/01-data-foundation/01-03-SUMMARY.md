---
phase: 01-data-foundation
plan: 03
subsystem: data
tags: [fetch, localStorage, vitest, manifestService, textLibrary, jsdom]

# Dependency graph
requires:
  - phase: 01-data-foundation/01-02
    provides: Per-book JSON files at public/data/{tradition}/{translation}/{slug}.json and manifest.json files
provides:
  - "services/textLibrary.ts: fetch-based loadChapterText with zero static imports, plus loadBookFile and extractChapter"
  - "services/manifestService.ts: singleton manifest loading (loadManifest, loadAllManifests, findBookSlug)"
  - "App.tsx: safeRead/safeWrite helpers replacing all unguarded localStorage operations"
  - "tests/textLibrary.test.ts: 7 real assertions for extractChapter (sorting, chapter filtering, Quran flat keys)"
  - "tests/manifest.test.ts: 6 real assertions for findBookSlug + manifest schema"
  - "tests/storage.test.ts: 10 real assertions for safeRead/safeWrite (corrupt JSON, missing key, round-trip)"
affects:
  - 01-data-foundation/01-04 (nav UI will consume loadManifest + loadChapterByTradition)
  - Phase 2 (explanation pipeline consumes data files via these same fetch paths)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Singleton promise pattern for manifest loading (prevents duplicate fetches, allows retry on failure)"
    - "Per-book fetch cache keyed by tradition/translation/slug (bookCache Map)"
    - "safeRead/safeWrite pattern for localStorage (fallback on null, empty string, or corrupt JSON)"
    - "vi.stubGlobal with in-memory localStorage mock (avoids jsdom opaque-origin restriction)"

key-files:
  created:
    - services/manifestService.ts
  modified:
    - services/textLibrary.ts
    - App.tsx
    - tests/textLibrary.test.ts
    - tests/manifest.test.ts
    - tests/storage.test.ts

key-decisions:
  - "Deprecated stub exports (discoverScriptures, loadScriptureData, extractVersesFromScripture, loadTextCatalog, ScriptureEntry) kept in textLibrary.ts for App.tsx backward compatibility during migration — to be removed in Plan 04"
  - "VERSION_TO_TRADITION map scoped to KJV and GNV only (the two public-domain translations available in /data/)"
  - "safeRead treats empty string as missing (returns fallback) — prevents parse failure on localStorage.setItem('key', '') edge case"
  - "Storage tests use vi.stubGlobal with an in-memory Map-based mock instead of jsdom localStorage (jsdom blocks localStorage.clear on opaque origins)"

patterns-established:
  - "Pattern: loadManifest(tradition) — singleton promise with retry-on-error (delete from cache on failure)"
  - "Pattern: loadBookFile(tradition, translation, slug) — per-book fetch cache keyed by compound string"
  - "Pattern: extractChapter(bookData, chapter, isQuran) — flat verse map to ChapterVerse[] with numeric sort"
  - "Pattern: safeRead<T>(key, fallback) / safeWrite(key, value) — all localStorage operations wrapped"

requirements-completed: [DATA-01, DATA-03, DATA-04]

# Metrics
duration: 11min
completed: 2026-03-19
---

# Phase 1 Plan 03: Fetch-based textLibrary, manifestService singleton, and safe localStorage Summary

**Replaced 29MB static bible bundle with per-book fetch from /data/, added singleton manifest loading, eliminated all 9 unguarded localStorage crash vectors, and replaced 3 stub test files with 23 real passing assertions.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-19T16:09:37Z
- **Completed:** 2026-03-19T16:23:47Z
- **Tasks:** 3
- **Files modified:** 5 (1 created)

## Accomplishments

- textLibrary.ts: zero static imports, zero import.meta.glob — loads scripture via fetch from /data/ using loadBookFile + extractChapter, preserves backward-compatible loadChapterText(version, book, chapter) signature
- services/manifestService.ts: singleton promise pattern prevents duplicate manifest fetches, allows retry on failure, exports loadManifest, loadAllManifests, findBookSlug
- App.tsx: safeRead/safeWrite helpers protect all 9 storage key reads and ~15 write sites from crashes on corrupt or missing data
- 23 tests pass across 3 test files with no it.todo stubs remaining

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor textLibrary.ts and create manifestService.ts** - `06227fe` (feat)
2. **Task 2: Fix localStorage crash vectors in App.tsx** - `0302ac5` (fix)
3. **Task 3: Implement real test assertions** - `c476104` (test)

## Files Created/Modified

- `services/textLibrary.ts` - Fetch-based scripture loading; loadBookFile, extractChapter, loadChapterText (backward-compat); deprecated stubs for App.tsx legacy discovery UI
- `services/manifestService.ts` - Singleton manifest loader; loadManifest, loadAllManifests, findBookSlug
- `App.tsx` - safeRead/safeWrite helpers; all localStorage reads and writes now crash-safe
- `tests/textLibrary.test.ts` - extractChapter unit tests (chapter filtering, numeric sort, Quran flat keys, source validation)
- `tests/manifest.test.ts` - findBookSlug unit tests (exact match, missing book, case sensitivity) + schema test
- `tests/storage.test.ts` - safeRead/safeWrite unit tests with in-memory localStorage mock

## Decisions Made

- Kept deprecated stub exports (discoverScriptures, loadScriptureData, etc.) in textLibrary.ts rather than breaking App.tsx immediately — App.tsx's scripture discovery UI still references these. They will be removed when App.tsx is migrated in Plan 04.
- VERSION_TO_TRADITION map only includes KJV and GNV — the only two translations confirmed in /data/ from Plan 02. NIV/NLT/NKJV/NASB removed from this plan per phase decision to drop copyright violations.
- safeRead treats empty string the same as null (returns fallback) to prevent JSON.parse('') throwing SyntaxError.
- Storage tests use vi.stubGlobal with an in-memory Map-based localStorage mock because jsdom throws SecurityError on localStorage.clear when running under an opaque origin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added deprecated stub exports to textLibrary.ts to keep App.tsx compiling**
- **Found during:** Task 1 (Refactor textLibrary.ts)
- **Issue:** App.tsx imports discoverScriptures, loadScriptureData, extractVersesFromScripture, loadTextCatalog, and ScriptureEntry — all removed by the plan. Removing them without updating App.tsx would break TypeScript compilation.
- **Fix:** Added deprecated stub exports returning empty arrays/null with console.warn messages. These maintain the type contract so App.tsx compiles while the discovery UI is migrated in Plan 04.
- **Files modified:** services/textLibrary.ts
- **Verification:** npx tsc --noEmit --skipLibCheck returns zero errors
- **Committed in:** 06227fe (Task 1 commit)

**2. [Rule 1 - Bug] Used vi.stubGlobal with in-memory mock instead of bare localStorage.clear**
- **Found during:** Task 3 (storage.test.ts test run)
- **Issue:** jsdom throws TypeError: localStorage.clear is not a function when running under opaque origin (no testURL configured in vitest.config.ts). All 10 storage tests failed.
- **Fix:** Replaced localStorage.clear() beforeEach with a custom in-memory Map-based mock stubbed via vi.stubGlobal('localStorage', mockStorage). Mock implements the full Storage interface.
- **Files modified:** tests/storage.test.ts
- **Verification:** All 10 storage tests pass; npx vitest run tests/storage.test.ts shows 0 failures
- **Committed in:** c476104 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug fixes required for correctness)
**Impact on plan:** Both fixes were necessary for the plan to succeed. No scope creep. The stub exports are explicitly temporary and scoped for removal in Plan 04.

## Issues Encountered

- jsdom localStorage restriction under opaque origin (vitest.config.ts has no testURL): caused all storage tests to fail on first run. Resolved via in-memory mock (see Deviation 2).

## Next Phase Readiness

- Plan 04 (navigation UI) can consume loadManifest + loadChapterByTradition immediately
- Deprecated stub exports in textLibrary.ts are the remaining cleanup item — Plan 04 should remove them when the App.tsx discovery UI is migrated
- 23 tests confirm extractChapter, findBookSlug, and safeRead/safeWrite work correctly
- TypeScript compiles with zero errors

---
*Phase: 01-data-foundation*
*Completed: 2026-03-19*

## Self-Check: PASSED

All files present and all commits verified:
- services/textLibrary.ts: FOUND
- services/manifestService.ts: FOUND
- App.tsx: FOUND
- tests/textLibrary.test.ts: FOUND
- tests/manifest.test.ts: FOUND
- tests/storage.test.ts: FOUND
- .planning/phases/01-data-foundation/01-03-SUMMARY.md: FOUND
- Commit 06227fe (Task 1): FOUND
- Commit 0302ac5 (Task 2): FOUND
- Commit c476104 (Task 3): FOUND
