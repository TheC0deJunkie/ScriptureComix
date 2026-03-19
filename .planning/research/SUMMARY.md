# Project Research Summary

**Project:** ScriptureComix
**Domain:** Offline-first multi-tradition scripture reader with AI-generated comic panels
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

ScriptureComix is a React 19 + TypeScript PWA that combines multi-tradition scripture reading (Protestant, Catholic, Ethiopian Orthodox, Quran) with AI-generated comic panels per verse/chapter. The core differentiator — visual storytelling through AI imagery — already exists and works. The critical gap is the offline-first promise: the app currently calls Groq/Gemini at runtime for explanations, quizzes, and context panels, which means the product completely fails for users in low-connectivity environments (retreats, mission fields, international contexts). Research strongly recommends building a build-time explanation pre-generation pipeline as the single biggest unlock.

The recommended approach is a strict separation between the build pipeline (which runs AI generation once, commits static JSON, and never blocks `vite build`) and the runtime app (which fetches lazy per-book JSON chunks via Service Worker CacheFirst). The current data layer is architecturally broken: six translations are statically imported into the main JS bundle (~28MB), which must be replaced with runtime lazy fetches from `public/data/`. Additionally, three of those bundled translations (NIV, NLT, NKJV, NASB) are under active copyright and must be removed before shipping.

The top risks are a copyright violation from already-bundled proprietary translations, a bundle size crisis from static imports, a data gap for Ethiopian Meqabyan books (no verified public-domain source), and a crash-prone localStorage deserialization path that will worsen as explanation data is added. These risks are concrete and documented — they are not speculative. Phase 1 must fix copyright, static imports, and localStorage safety before any explanation pipeline work begins.

---

## Key Findings

### Recommended Stack

The existing stack (React 19, TypeScript, Vite 6, Tailwind CSS, Gemini/Groq) requires no framework-level changes. Two additions are needed: `idb` (^8.0, 1.1KB) for IndexedDB-backed comic image caching to replace the localStorage approach that hits its 5-10MB limit within minutes of use, and `vite-plugin-pwa` (^0.20) with Workbox for a Service Worker that caches scripture JSON files with a CacheFirst strategy. SQLite WASM and Dexie.js are explicitly ruled out — the former requires COOP/COEP headers that break most deployments, the latter is 24KB overkill for this use case.

Scripture data sources are constrained to public domain only. Safe translations: KJV, WEB (CC0), GNV (Geneva 1599), Douay-Rheims 1899 (Catholic), Yusuf Ali / Pickthall (Quran). The NIV, NLT, NKJV, NASB files on disk must be removed. The NABRE Catholic dataset on disk was scraped from BibleGateway and is under USCCB copyright — also remove. Meqabyan 1-3 (Ethiopian) has no verified public-domain machine-readable English translation.

**Core technologies:**
- React 19 + TypeScript: UI layer — already in place, no migration needed
- Vite 6: Build tool — fast HMR, excellent code splitting for per-book lazy loading
- `idb` ^8.0: IndexedDB wrapper — replaces localStorage for comic image caching (5MB limit workaround)
- `vite-plugin-pwa` ^0.20: Service Worker + Workbox — enables true offline via CacheFirst strategy
- Gemini / Groq: AI services — kept for online comic generation only; not used at runtime for explanations

### Expected Features

The current app ships the comic generation core, art style selection (9 styles), character builder, guided journeys, and offline pack export. The multi-tradition promise is partially delivered — data assets are present but the UI does not surface Catholic or Quran canons as first-class options, and the tradition switcher component does not exist.

**Must have (table stakes):**
- Canon completeness (Protestant 66) — partial, needs copyright cleanup
- Canon completeness (Catholic 73) — partial, Douay-Rheims data must replace NABRE
- Canon completeness (Quran 114 surahs) — partial, AL-QURAN dataset present but not in default book list
- Tradition/canon switcher UI — not started; critical for multi-tradition promise
- Pre-generated offline explanations (build-time pipeline) — not started; removes runtime AI dependency
- Verse-level navigation — not started; chapter-only feels coarse
- Passage context panel (static) — not started; single-verse comics lose meaning without surrounding context
- Graceful offline comic fallback (text card) — partial; needs design pass

**Should have (differentiators):**
- Hybrid comic (AI image online / stylized text card offline) — partial, needs design polish
- Multi-tradition in a single unified UI — partial, architecture supports it, UI does not yet
- Build-time explanation pipeline — not started; unique in the market, enables retreat/field use
- Passage context with narrative summary — partial (comicSummary exists), needs surfacing

**Defer (v2+):**
- Cross-tradition verse search — high complexity, depends on all canons indexed first
- Ethiopian canon (Meqabyan 1-3) — pending public-domain source verification
- Native iOS/Android app — PWA covers mobile; native adds release track overhead
- User accounts / cloud sync — localStorage + JSON export is sufficient for v1
- Liturgical calendar integration — denomination-specific complexity; premature at this stage
- Hebrew/Greek/Arabic interlinear tools — different user segment (scholars)

### Architecture Approach

The recommended architecture is four layers with one-way data flow: UI components (pure display) → App.tsx orchestration (canon, book, chapter, verse, online/offline state) → Scripture Data Layer (per-book lazy fetch from `public/data/`, Service Worker CacheFirst) + Explanation/Comic Cache Layer (pre-generated JSON from disk, IndexedDB for images). A separate build pipeline (`scripts/generateExplanations.ts`) runs offline, generates explanation JSON via AI API with checkpoint/resume, and commits output to the repo. This pipeline never runs during `vite build`.

**Major components:**
1. `CanonSwitcher` — renders tradition tabs (Protestant / Catholic / Ethiopian / Quran); no data fetching
2. `VerseSelector` — book → chapter → verse navigation using canon index; no verse text loading
3. `ContextPanel` — displays surrounding verses + narrative explanation; pure display, no fetching
4. `ComicPanel` — shows AI image (online+cached) or stylized text card (offline); delegates AI calls to service
5. `SearchBar` — full-text search across loaded canon indexes only (not all verse text)
6. `OfflineIndicator` — connectivity status badge
7. `scripts/generateExplanations.ts` — standalone Node.js script, not a Vite plugin; checkpoint/resume required

### Critical Pitfalls

1. **Copyrighted translations bundled in repo** — NIV, NLT, NKJV, NASB, NABRE are under active copyright despite being in a dataset with an MIT-licensed JSON wrapper. Remove before shipping. Replace with KJV, WEB, GNV, Douay-Rheims, Yusuf Ali. Must resolve in Phase 1.

2. **Static imports destroy bundle performance** — `textLibrary.ts` statically imports 6 translations (~28MB) into the main bundle. Adding more canons this way pushes past 50MB. Replace all with runtime `fetch('/data/{canon}/{translation}/{book}.json')` and Service Worker caching. Must resolve in Phase 1.

3. **localStorage crash on deserialization** — `App.tsx` deserializes localStorage without try-catch (documented in CONCERNS.md). This will become a guaranteed crash vector when large explanation JSON enters storage. Fix before Phase 2.

4. **Explanation pipeline requires checkpoint/resume** — 44K+ API calls at ~2 seconds each = ~24 hours of generation. A simple for-loop with no state persistence will restart from zero on any rate limit error. Must have `scripts/.generate-checkpoint.json` tracking last completed verse. Must implement in Phase 2.

5. **Quran ayah numbering silently misaligns explanations** — Different editions handle the Basmala differently (counted as verse 1 vs. prefix). Off-by-one errors produce wrong explanations silently. Pick one numbering convention and normalize all datasets before explanation generation. Must resolve in Phase 1.

---

## Implications for Roadmap

Based on combined research, a 5-phase structure is recommended. The phases follow strict dependency order: data must be clean before the pipeline runs, the pipeline must run before offline panels can display pre-generated content, and UI integration comes last after infrastructure is solid.

### Phase 1: Data Foundation
**Rationale:** Three blockers must be cleared before any other work is safe to build on — copyright violations, bundle performance, and data integrity. These are not polish items; they are correctness prerequisites.
**Delivers:** Clean public-domain-only dataset in `public/data/` per-book lazy JSON format; Service Worker caching; fixed localStorage safety; canonical book ID mapping table; Quran ayah numbering normalized.
**Addresses:** Canon completeness (Protestant cleanup), copyright compliance, initial PWA setup
**Avoids:** Copyright infringement (Pitfall 1), bundle size crisis (Pitfall 2), localStorage crash (Pitfall 3), Quran numbering misalignment (Pitfall 6), cross-tradition search naming inconsistency (Pitfall 7)
**Research flag:** Standard patterns — fetch + Service Worker + Workbox are well-documented. No phase research needed.

### Phase 2: Explanation Pipeline
**Rationale:** Pre-generated offline explanations are the single biggest gap and the clearest differentiator. This phase builds the infrastructure that makes Phases 3 and 4 possible. Running it before building the UI that consumes it avoids rebuilding the pipeline mid-feature.
**Delivers:** `scripts/generateExplanations.ts` with checkpoint/resume; explanation JSON schema (per-book, not per-verse); generated explanation files committed to repo for high-priority books (Psalms, Gospels, Genesis first).
**Uses:** Groq/Gemini API (build-time only), `idb` schema defined but not yet wired to UI
**Implements:** Build Pipeline layer (the fourth architecture layer)
**Avoids:** Per-verse file explosion crashing Vite (Pitfall 9), pipeline restart-from-zero on rate limit (Pitfall 5)
**Research flag:** Checkpoint/resume pattern and Workbox integration may warrant a targeted research pass — not complex, but implementation details matter at 44K API call scale.

### Phase 3: Context Panel
**Rationale:** Once explanations are pre-generated, the context panel is a straightforward display component backed by static JSON. It reuses existing `comicSummary` and `lifeApplication` data while the new explanation pipeline provides richer content. This phase delivers immediate user value with low implementation risk.
**Delivers:** `ContextPanel` component (3-5 surrounding verses + narrative explanation + life application); `contextWindowService`; works fully offline using pre-generated JSON.
**Addresses:** Passage context panel (table stakes), offline explanation display
**Implements:** ContextPanel architecture component; wires Scripture Data Layer to UI
**Research flag:** No research needed — well-understood display pattern with clean data contract from Phase 2.

### Phase 4: Comic Cache Upgrade
**Rationale:** IndexedDB image storage replaces/augments localStorage for cached comic images. This phase also delivers the design-polished offline text card fallback. Positioned after context panel because it addresses the "nice to have more storage" problem rather than a complete missing feature.
**Delivers:** IndexedDB comic cache via `idb`; LRU eviction at 80% quota; `navigator.storage.persist()` request on first generation; polished offline text card design; `OfflineIndicator` component.
**Uses:** `idb` ^8.0; `navigator.storage.estimate()`
**Avoids:** Storage quota variability by browser/device (Pitfall 8)
**Research flag:** No research needed — `idb` documentation is excellent, LRU pattern is standard.

### Phase 5: UI Integration (Multi-Tradition + Search)
**Rationale:** `CanonSwitcher`, `VerseSelector`, and cross-tradition `SearchBar` are the final UI surface that exposes the multi-tradition infrastructure built in Phases 1-4. Positioned last because it depends on all canons being properly indexed, all explanations pre-generated, and the data layer being clean.
**Delivers:** `CanonSwitcher` component (tradition tabs); `VerseSelector` with verse-level navigation; `SearchBar` across loaded canon indexes; Catholic Douay-Rheims and Quran surfaced as first-class tradition options in UI.
**Addresses:** Tradition/canon switcher (table stakes), verse-level navigation (table stakes), multi-tradition in single UI (differentiator)
**Defers:** Ethiopian Meqabyan 1-3 (pending public-domain source); full cross-tradition search (high complexity, can ship after canon switcher)
**Research flag:** Ethiopian canon scoping needs resolution before this phase starts — document Meqabyan 1-3 as v2 in requirements.

### Phase Ordering Rationale

- Phase 1 before everything: copyright and static import problems contaminate every downstream phase if not cleared first.
- Phase 2 before Phase 3: context panel and quiz features are backed by pre-generated data; building UI before data exists forces re-wiring.
- Phase 4 after Phase 3: storage upgrade is additive improvement; context panel delivers user value first.
- Phase 5 last: multi-tradition UI is the product surface, not the foundation. Infrastructure must be stable before exposing it.
- Ethiopian canon intentionally scoped down: Meqabyan sourcing gap would block the entire Ethiopian tradition if not carved out early.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Checkpoint/resume implementation details for a 24-hour AI generation run; rate limit handling and exponential backoff patterns specific to Groq/Gemini; Workbox CacheFirst configuration for large static asset sets.

Phases with standard patterns (skip research-phase):
- **Phase 1:** fetch + Service Worker + Workbox are thoroughly documented; per-book JSON file organization is a conventional static asset pattern.
- **Phase 3:** React display component with static JSON data contract is a standard pattern.
- **Phase 4:** `idb` library has clear documentation; LRU eviction and `navigator.storage` APIs are well-documented on MDN.
- **Phase 5:** React component decomposition for a selector UI is a standard pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Grounded in direct codebase inspection; library recommendations verified against current versions |
| Features | HIGH | Derived from live codebase state + canon completeness is a theological reference fact |
| Architecture | HIGH | Grounded in codebase inspection + MDN storage API documentation; data schemas are concrete |
| Pitfalls | HIGH | Copyright status verified per translation; Vite static import problem directly observed in code |

**Overall confidence:** HIGH

### Gaps to Address

- **Meqabyan 1-3 source:** No verified public-domain machine-readable English translation found. Scope Ethiopian v1 to 1 Enoch + Jubilees + shared Protestant/Catholic books only. Flag Meqabyan as v2 in requirements. Do not block the entire Ethiopian tradition on this gap.
- **Explanation generation cost estimate:** ~44K API calls. Cost per call on Groq/Gemini free tiers vs. paid tiers not validated. Validate API pricing before committing to full-canon generation in Phase 2.
- **Storage budget for committed explanation JSON:** ~27MB of explanation data committed to the git repo is a one-time large addition. Verify no LFS or file size limits in the deployment target before Phase 2.
- **NABRE replacement strategy:** The Catholic Deuterocanon data on disk is copyrighted. Douay-Rheims 1899 is the replacement, but the verse-to-verse mapping between NABRE and Douay-Rheims must be validated — chapter/verse numbering differs in some books.

---

## Sources

### Primary (HIGH confidence)
- Live codebase inspection: `types.ts`, `App.tsx`, `services/textLibrary.ts`, `services/groqService.ts`, `services/geminiService.ts`, `components/OfflinePackManager.tsx`, `components/GuidedJourneys.tsx`, `CONCERNS.md`
- Canon book counts: Protestant 66, Catholic 73, Ethiopian 81 — theological reference (unambiguous)
- Bundled dataset copyright status: NIV (Biblica), NLT (Tyndale House), NKJV (Thomas Nelson), NASB (Lockman Foundation), NABRE (USCCB) — publisher copyright pages
- KJV, WEB (CC0), GNV (Geneva 1599), Douay-Rheims 1899, Yusuf Ali/Pickthall — public domain status confirmed

### Secondary (MEDIUM confidence)
- `scrollmapper/bible_databases` (GitHub) — source for KJV, WEB, GNV, Douay-Rheims JSON
- Project Gutenberg — 1 Enoch (R.H. Charles 1917), Jubilees (R.H. Charles 1902)
- MDN Web Docs — `navigator.storage`, IndexedDB, Service Worker Cache API
- Vite documentation — chunk manifest behavior, static asset handling

### Tertiary (LOW confidence / needs validation)
- Meqabyan 1-3 copyright status — only source is informal community discussion; no authoritative determination found. Treat as unavailable until verified.
- API generation cost for 44K explanation units — estimated from known rate limits; not validated against current Groq/Gemini pricing tiers.

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
