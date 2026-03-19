---
phase: 1
slug: data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (none detected — Wave 0 installs) |
| **Config file** | `vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + `vite build` must complete with main bundle < 1MB
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-00-01 | Wave 0 | 0 | infra | setup | `npx vitest run --reporter=dot` | ❌ W0 | ⬜ pending |
| 1-01-01 | 01 | 1 | DATA-01 | unit | `npx vitest run tests/textLibrary.test.ts -t "loadChapterText fetches per-book"` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | DATA-01 | build | `npx vite build && node -e "const{statSync}=require('fs');const f=require('fs').readdirSync('dist/assets').filter(f=>f.endsWith('.js')&&!f.includes('chunk'));const s=Math.max(...f.map(x=>statSync('dist/assets/'+x).size));console.log(s<1048576?'PASS':'FAIL: bundle '+s)"` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | DATA-04 | static | `grep -r "bible-translations-master" services/ App.tsx 2>/dev/null && echo FAIL || echo PASS` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | DATA-03 | unit | `npx vitest run tests/manifest.test.ts -t "loadManifest resolves before loadBook"` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | CANON-01 | unit | `npx vitest run tests/canons.test.ts -t "protestant 66 books"` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | CANON-02 | unit | `npx vitest run tests/canons.test.ts -t "catholic 73 books"` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 1 | CANON-03 | unit | `npx vitest run tests/canons.test.ts -t "ethiopian enoch jubilees"` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | CANON-04 | unit | `npx vitest run tests/quran.test.ts -t "fatiha numbering"` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 1 | CANON-04 | unit | `npx vitest run tests/quran.test.ts -t "total ayahs 6236"` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | NAV-01 | unit | `npx vitest run tests/nav.test.ts -t "tradition switcher"` | ❌ W0 | ⬜ pending |
| 1-04-02 | 04 | 2 | NAV-02 | unit | `npx vitest run tests/nav.test.ts -t "quran labels"` | ❌ W0 | ⬜ pending |
| 1-05-01 | 05 | 2 | localStorage | unit | `npx vitest run tests/storage.test.ts -t "corrupt JSON falls back"` | ❌ W0 | ⬜ pending |
| 1-06-01 | 06 | 3 | DATA-02 | manual | See Manual-Only Verifications | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom` — test framework install
- [ ] `vitest.config.ts` — vitest config with jsdom environment for component tests
- [ ] `tests/textLibrary.test.ts` — stubs for DATA-01 fetch pattern + static import removal
- [ ] `tests/manifest.test.ts` — stubs for DATA-03 manifest loading
- [ ] `tests/canons.test.ts` — stubs for CANON-01 through CANON-03 data completeness
- [ ] `tests/quran.test.ts` — stubs for CANON-04 ayah numbering normalization
- [ ] `tests/nav.test.ts` — stubs for NAV-01 tradition switcher + NAV-02 Quran labels
- [ ] `tests/storage.test.ts` — stubs for localStorage crash resistance (all 8 STORAGE_KEYS)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Service Worker registers and CacheFirst applies to `/data/**` | DATA-02 | Requires browser runtime + DevTools | 1. Run `npm run build && npm run preview`. 2. Open DevTools > Application > Service Workers — verify worker registered. 3. Navigate to a verse. 4. Open Network tab, reload with cache disabled — verify `/data/` requests show "(ServiceWorker)" source. |
| App works fully offline after first visit | DATA-02 | Requires browser offline simulation | 1. Visit app fresh, load a verse. 2. DevTools > Network > "Offline" mode. 3. Reload page — app must render the same verse without any network requests. |
| Attribution notice appears in translation selector | DATA-04 | UI text verification | 1. Open the translation picker. 2. Verify each copyrighted translation (NIV, NLT, NKJV, NASB) shows copyright owner name before user selects it. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
