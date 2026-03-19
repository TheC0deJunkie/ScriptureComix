# Requirements: ScriptureComix

**Defined:** 2026-03-19
**Core Value:** Every person can read any scripture tradition and immediately understand what a verse means and why it says what it says — in plain language, as a comic — with no internet required after first load.

## v1 Requirements

### Data Foundation

- [ ] **DATA-01**: App loads scripture data lazily per-book from `public/data/` via fetch — no static imports in the JS bundle
- [ ] **DATA-02**: App works fully offline after first visit via Service Worker (vite-plugin-pwa + Workbox CacheFirst for `/data/**`)
- [ ] **DATA-03**: Per-tradition canon index manifests (~5KB each) load eagerly so book/chapter lists render without fetching full text
- [ ] **DATA-04**: Copyrighted translations (NIV, NLT, NKJV, NASB, NABRE, etc.) are included AND display a clear copyright attribution notice in the UI — users get their preferred translation, publishers are credited

### Canon Coverage

- [ ] **CANON-01**: User can browse the full Protestant canon (66 books) in multiple translations (KJV, WEB, NIV, NLT, NKJV, NASB) offline
- [ ] **CANON-02**: User can browse the full Catholic canon (73 books) including all 7 deuterocanonical books offline
- [ ] **CANON-03**: User can browse the Ethiopian Orthodox canon (OT+NT + 1 Enoch + Jubilees + confirmed public-domain additions) offline
- [ ] **CANON-04**: User can browse the full Quran (114 surahs) in Yusuf Ali translation offline

### Pre-Generation Pipelines (Server-Side, Run Once)

- [ ] **PIPE-01**: Build-time script pre-generates context explanations for all verses across all canons with checkpoint/resume, storing output as per-book JSON served from backend
- [ ] **PIPE-02**: Build-time script pre-generates comic panel images for every verse across all canons with checkpoint/resume, storing images on VPS filesystem
- [ ] **PIPE-03**: Generation pipeline tracks status per verse (pending / generating / complete / failed / flagged-for-regen) in the backend database
- [ ] **PIPE-04**: Pipeline can be resumed from any checkpoint — a single verse failure does not restart from zero

### Backend (Node/Express on Hostinger VPS)

- [ ] **BACK-01**: REST API serves pre-generated comic image URLs keyed by `{canon}/{translation}/{book}/{chapter}/{verse}`
- [ ] **BACK-02**: REST API serves pre-generated explanation JSON keyed by the same verse reference
- [ ] **BACK-03**: Images are stored on VPS filesystem and served statically — no third-party storage cost
- [ ] **BACK-04**: Backend tracks generation status for every verse (for admin dashboard)

### Context & Explanations

- [ ] **EXPL-01**: Context panel displays 3–5 verses before and after the selected verse (passage window) from locally bundled data
- [ ] **EXPL-02**: Context panel displays the pre-generated layman narrative: what the verse means, why it says what it says, what's happening in the broader story
- [ ] **EXPL-03**: Context panel is a dedicated UI component displayed alongside the comic panel

### Comics (Communal Forever-Store)

- [ ] **COMIC-01**: Every verse has a pre-generated comic panel image produced by the server-side pipeline before users visit the site
- [ ] **COMIC-02**: Comic images are stored permanently on the VPS — once generated, no user ever triggers or pays for regeneration
- [ ] **COMIC-03**: Users view the communal stored image for each verse — the same image for all users, zero per-user AI credits

### Admin Dashboard

- [ ] **ADMIN-01**: Admin dashboard shows all generated verses with their comic images, status, and generation metadata
- [ ] **ADMIN-02**: Admin can rate an image (keep / regenerate) — regenerate queues the verse for a new AI generation pass
- [ ] **ADMIN-03**: Admin can filter dashboard by canon, book, rating status, and generation date
- [ ] **ADMIN-04**: Dashboard shows generation progress (total verses, % complete, failures, queued)
- [ ] **ADMIN-05**: Admin can manually trigger regeneration of individual verses or a batch

### Navigation & Search

- [ ] **NAV-01**: Tradition switcher lets user choose between Protestant / Catholic / Ethiopian Orthodox / Quran at the top level
- [ ] **NAV-02**: User can navigate by Book → Chapter → Verse within the selected tradition
- [ ] **NAV-03**: User can search a keyword and see matching verses across all loaded traditions simultaneously

---

## v2 Requirements

### Ethiopian Expansion
- **ETH-01**: Meqabyan 1-3 once a verified public-domain English translation is sourced

### Enhanced Study Tools
- **STUDY-01**: Cross-reference panel — verses that quote/allude to the current verse across traditions
- **STUDY-02**: Book-level introductions

### User Features
- **USR-01**: User can flag a comic image as inappropriate (feeds into admin regeneration queue)
- **USR-02**: User can "favorite" a verse panel

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-user on-demand comic generation | Defeats communal forever-store model; no per-user AI credits |
| Text card fallback for missing comics | No missing comics — pipeline pre-generates everything before launch |
| User accounts / cloud sync | v1 is read-only; no user state needed |
| Hebrew / Greek / Arabic interlinear | High complexity, separate domain |
| Native mobile app (iOS/Android) | Web-first; PWA covers offline use case |
| Social features (comments, sharing) | Out of scope v1 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| CANON-01 | Phase 1 | Pending |
| CANON-02 | Phase 1 | Pending |
| CANON-03 | Phase 1 | Pending |
| CANON-04 | Phase 1 | Pending |
| NAV-01 | Phase 1 | Pending |
| NAV-02 | Phase 1 | Pending |
| PIPE-01 | Phase 2 | Pending |
| PIPE-02 | Phase 2 | Pending |
| PIPE-03 | Phase 2 | Pending |
| PIPE-04 | Phase 2 | Pending |
| BACK-01 | Phase 2 | Pending |
| BACK-02 | Phase 2 | Pending |
| BACK-03 | Phase 2 | Pending |
| BACK-04 | Phase 2 | Pending |
| COMIC-01 | Phase 2 | Pending |
| COMIC-02 | Phase 2 | Pending |
| COMIC-03 | Phase 2 | Pending |
| EXPL-01 | Phase 3 | Pending |
| EXPL-02 | Phase 3 | Pending |
| EXPL-03 | Phase 3 | Pending |
| NAV-03 | Phase 3 | Pending |
| ADMIN-01 | Phase 4 | Pending |
| ADMIN-02 | Phase 4 | Pending |
| ADMIN-03 | Phase 4 | Pending |
| ADMIN-04 | Phase 4 | Pending |
| ADMIN-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 — traceability updated for 4-phase roadmap; BACK-01..04 consolidated into Phase 2 (server pipeline); NAV-03 consolidated into Phase 3 (reading experience); Phase 5 eliminated (coarse granularity compression)*
