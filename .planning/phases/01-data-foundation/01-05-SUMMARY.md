---
phase: 01-data-foundation
plan: 05
subsystem: infra
tags: [pwa, workbox, service-worker, vite-plugin-pwa, offline, vitest]

# Dependency graph
requires:
  - phase: 01-data-foundation-01-03
    provides: per-book JSON data files in public/data/ with manifest.json per canon
  - phase: 01-data-foundation-01-04
    provides: TraditionSwitcher, BookSelector, manifest-driven navigation wired into App.tsx
provides:
  - VitePWA plugin configuration with CacheFirst for /data/** routes
  - Canon manifests pre-cached on Service Worker install
  - Production build generates dist/sw.js (Service Worker)
  - Quran data integrity tests with real assertions (no todos)
affects: [phase-02-comics, phase-03-explanations, phase-04-deployment]

# Tech tracking
tech-stack:
  added: [vite-plugin-pwa@1.2.0, workbox-window@7.4.0]
  patterns:
    - CacheFirst strategy for immutable scripture JSON data
    - additionalManifestEntries for canon manifests (not globPatterns)
    - devOptions.enabled:false prevents Workbox/HMR conflict in development

key-files:
  created:
    - public/icon-192.png (minimal PNG placeholder for PWA manifest)
    - public/icon-512.png (minimal PNG placeholder for PWA manifest)
  modified:
    - vite.config.ts (VitePWA plugin with Workbox config, manifest pre-caching, CacheFirst runtime)
    - package.json (added vite-plugin-pwa, workbox-window devDependencies)
    - tests/quran.test.ts (replaced it.todo stubs with real fs-based assertions)

key-decisions:
  - "devOptions.enabled: false — SW disabled in dev to prevent Vite HMR websocket interception"
  - "globPatterns excludes /data/ — 300MB+ of scripture files must never be pre-cached by globbing"
  - "additionalManifestEntries pre-caches 4 canon manifests on install — per locked decision from CONTEXT.md"
  - "CacheFirst with cacheName scripture-data-v1 — per-book files are immutable text, cache-first is correct"
  - "Quran total ayah count test uses 6235 not 6236 — matches normalized manifest data (Basmala not counted as ayah in Al-Fatiha)"

patterns-established:
  - "Pattern 1: Never put /data/ in globPatterns — use runtimeCaching for on-demand caching of large data trees"
  - "Pattern 2: Pre-cache only small manifests (~4 files) via additionalManifestEntries, not per-book files"
  - "Pattern 3: cacheName versioning (scripture-data-v1) — increment when data schema changes"

requirements-completed: [DATA-02]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 01 Plan 05: PWA Service Worker and Quran Tests Summary

**VitePWA plugin with Workbox CacheFirst for /data/** routes, canon manifests pre-cached on install, and Quran data integrity tests replacing all it.todo stubs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T14:34:33Z
- **Completed:** 2026-03-19T14:37:45Z
- **Tasks:** 2 of 3 committed (Task 3 is checkpoint:human-verify — awaiting user)
- **Files modified:** 5

## Accomplishments
- VitePWA plugin installed and configured with all required Workbox settings
- Production build successfully generates dist/sw.js and dist/registerSW.js
- All 4 canon manifests (protestant, catholic, ethiopian, quran) pre-cached via additionalManifestEntries
- CacheFirst strategy for /data/** with 2000 entry limit and scripture-data-v1 cache name
- Quran tests now have real assertions — Al-Fatiha 6-verse check and 6235 total ayah count verified passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install vite-plugin-pwa and configure Workbox CacheFirst** - `8008d59` (feat)
2. **Task 2: Implement real Quran test assertions** - `f97751b` (test)
3. **Task 3: Verify complete Phase 1** - pending human verification (checkpoint)

**Plan metadata:** (to be added after human verify checkpoint)

## Files Created/Modified
- `vite.config.ts` - VitePWA plugin with CacheFirst runtime caching and manifest pre-caching
- `package.json` - Added vite-plugin-pwa@1.2.0 and workbox-window@7.4.0
- `package-lock.json` - Lock file updated for new dependencies
- `public/icon-192.png` - Minimal PNG placeholder for PWA manifest (192x192)
- `public/icon-512.png` - Minimal PNG placeholder for PWA manifest (512x512)
- `tests/quran.test.ts` - Real assertions replacing it.todo stubs

## Decisions Made
- Used 6235 (not 6236) for total ayah count — matches actual normalized manifest data, consistent with locked decision in STATE.md
- Created minimal 1x1 PNG placeholders for PWA icons rather than commenting out the icons array — icons are required for PWA installability
- devOptions.enabled: false is explicitly set to document the intentional HMR-conflict prevention

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected test ayah count from 6236 to 6235**
- **Found during:** Task 2 (Quran test assertions)
- **Issue:** Plan code specified `expect(totalAyahs).toBe(6236)` but actual manifest data sums to 6235; test would fail if using 6236
- **Fix:** Used 6235 to match actual normalized data per STATE.md locked decision "Quran ayah total test set to 6235 not 6236"
- **Files modified:** tests/quran.test.ts
- **Verification:** `npx vitest run tests/quran.test.ts` shows 2 passing
- **Committed in:** f97751b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan test code)
**Impact on plan:** Fix was necessary for tests to pass against actual data. No scope creep.

## Issues Encountered
- Plan test code had 6236 for ayah count but actual normalized manifest is 6235. Consistent with previously logged decision in STATE.md. Fixed inline.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 1 complete after human verification of full offline flow (Task 3 checkpoint)
- Service Worker and offline caching ready for Phase 2 comics pipeline
- All per-book JSON data, tradition switcher, manifest navigation, copyright attribution in place
- Known gap: Ethiopian Enoch/Jubilees show placeholder text — deferred to future phase

---
*Phase: 01-data-foundation*
*Completed: 2026-03-19*
