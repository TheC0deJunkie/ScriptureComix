# Roadmap: ScriptureComix

## Overview

ScriptureComix ships in four phases. Phase 1 clears the blockers that would contaminate everything downstream — copyright violations, a 28MB static import, and a guaranteed localStorage crash. Phase 2 builds the Node/Express backend on Hostinger VPS and runs the server-side pipelines that pre-generate every comic image and every explanation once, forever. Phase 3 surfaces that pre-generated content in the user-facing reading experience: the context panel, narrative explanations, and cross-tradition search. Phase 4 gives the operator tools to inspect, rate, and queue regeneration of the communal forever-store.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Foundation** - Clean the data layer: copyright-safe translations, lazy per-book loading, Service Worker offline, localStorage safety
- [ ] **Phase 2: Server Pipeline + Backend** - Build VPS backend and run generation pipelines that pre-generate all comics and explanations once
- [ ] **Phase 3: Reading Experience** - Surface pre-generated content in UI: context panel, narrative explanations, tradition switcher, cross-tradition search
- [ ] **Phase 4: Admin Dashboard** - Operator tooling to inspect, rate, and manage the communal forever-store

## Phase Details

### Phase 1: Data Foundation
**Goal**: The app loads all scripture traditions offline from clean, copyright-safe data with no static bundle bloat and no crash vectors
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, CANON-01, CANON-02, CANON-03, CANON-04, NAV-01, NAV-02
**Success Criteria** (what must be TRUE):
  1. User can browse any verse in Protestant (66 books), Catholic (73 books), Ethiopian Orthodox (OT+NT+Enoch+Jubilees), and Quran (114 surahs) without an internet connection after first visit
  2. Copyrighted translations (NIV, NLT, NKJV, NASB, NABRE) are absent from the codebase; all bundled texts are public domain with visible copyright attribution in the UI
  3. The main JS bundle is under 1MB; scripture text loads lazily per-book from `/data/` via fetch, not static imports
  4. The app does not crash when localStorage is corrupt or full — deserialization is wrapped in try-catch with safe fallback
  5. Quran ayah numbering is normalized to a single canonical convention across all datasets
**Plans:** 5 plans
Plans:
- [ ] 01-01-PLAN.md — Test infrastructure (vitest) and type contracts (Tradition, CanonManifest, ManifestBook)
- [ ] 01-02-PLAN.md — Data transformation script: convert all source datasets to per-book JSON + canon manifests
- [ ] 01-03-PLAN.md — Refactor textLibrary.ts to fetch from /data/, create manifestService.ts, fix localStorage safety
- [ ] 01-04-PLAN.md — Tradition switcher dropdown and manifest-driven BookSelector navigation UI
- [ ] 01-05-PLAN.md — vite-plugin-pwa with Workbox CacheFirst for offline + final verification checkpoint

### Phase 2: Server Pipeline + Backend
**Goal**: A Node/Express server on Hostinger VPS has pre-generated every comic panel image and every context explanation for all verses, stored permanently — no user ever triggers or pays for generation
**Depends on**: Phase 1
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, BACK-01, BACK-02, BACK-03, COMIC-01, COMIC-02, COMIC-03
**Success Criteria** (what must be TRUE):
  1. The REST API returns a pre-generated comic image URL for any `{canon}/{translation}/{book}/{chapter}/{verse}` reference — images are served from VPS filesystem, not third-party storage
  2. The REST API returns a pre-generated explanation JSON for any verse reference — the same JSON that will populate the context panel
  3. The explanation generation pipeline can be stopped and restarted without losing progress — it resumes from the last completed verse
  4. The comic image pipeline can be stopped and restarted without losing progress — a single verse failure does not restart from zero
  5. Every verse has a tracked generation status (pending / generating / complete / failed / flagged-for-regen) queryable from the backend
**Plans**: TBD

### Phase 3: Reading Experience
**Goal**: Users can read any verse in any tradition with full surrounding context, a narrative explanation in plain language, and can search across all traditions — all offline
**Depends on**: Phase 2
**Requirements**: EXPL-01, EXPL-02, EXPL-03, NAV-03
**Success Criteria** (what must be TRUE):
  1. Selecting a verse displays a context panel showing 3–5 verses before and after the selected verse from the same locally bundled data
  2. The context panel displays the pre-generated narrative explanation: what the verse means, why it says what it says, and what is happening in the surrounding story — no internet required
  3. A tradition switcher at the top level lets the user move between Protestant, Catholic, Ethiopian Orthodox, and Quran as first-class options, with book/chapter/verse navigation within each
  4. User can type a keyword and see matching verses across all loaded traditions simultaneously
**Plans**: TBD

### Phase 4: Admin Dashboard
**Goal**: The operator can inspect every verse's generated comic and explanation, rate quality, queue regeneration, and monitor pipeline progress
**Depends on**: Phase 2
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05
**Success Criteria** (what must be TRUE):
  1. Admin dashboard displays all generated verses with their comic images, generation status, and metadata
  2. Admin can mark a comic image for regeneration — the verse is queued and the pipeline reprocesses it on the next run
  3. Admin can filter the dashboard by canon, book, rating status, and generation date
  4. Dashboard shows overall generation progress: total verses, percentage complete, failure count, and queue depth
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 0/5 | Planning complete | - |
| 2. Server Pipeline + Backend | 0/? | Not started | - |
| 3. Reading Experience | 0/? | Not started | - |
| 4. Admin Dashboard | 0/? | Not started | - |
