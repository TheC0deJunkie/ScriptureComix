# ScriptureComix

## What This Is

ScriptureComix is a multi-tradition scripture platform that bundles the full text of Protestant, Catholic, Ethiopian Orthodox, and Quran canons directly into the app — no internet required after install. Each verse is displayed as a comic-style panel with AI-pre-generated context explanations (written once at build time, stored as data) that explain not just the verse itself but the narrative context surrounding it in plain language.

## Core Value

Every person, regardless of background or internet access, can read any scripture tradition and immediately understand what a verse means and why it says what it says — in plain language, as a comic.

## Requirements

### Validated

- ✓ Bible verse browsing by book/chapter/verse — existing
- ✓ Comic-style panel display for verses — existing
- ✓ AI-powered verse explanation (Gemini/Groq) — existing
- ✓ Translation switching per tradition — existing

### Active

- [ ] Bundle full Protestant canon (66 books, public domain translations: KJV, WEB)
- [ ] Bundle full Catholic canon (73 books, includes deuterocanonical)
- [ ] Bundle full Ethiopian Orthodox canon (81 books, includes Enoch, Jubilees, Tobit extended)
- [ ] Bundle Quran (114 surahs, public domain English translation)
- [ ] Store all scripture as structured local data (JSON/JS modules) — zero runtime network call for verse lookup
- [ ] Pre-generate context explanations for all verses at build time using AI, store as data
- [ ] Context panel shows 3–5 verses before and after the selected verse + layman narrative explanation
- [ ] Comic panel generates on-demand when online, degrades gracefully to stylized text card when offline
- [ ] Verse cache: once a comic panel is generated, cache it locally so it never needs regeneration
- [ ] Canon/tradition switcher in the UI (Protestant / Catholic / Ethiopian / Quran)
- [ ] Verse search across all loaded traditions

### Out of Scope

- Real-time AI verse lookup at runtime — explanations are pre-generated and bundled
- Mobile app (native iOS/Android) — web-first
- User accounts / sync — local-only in v1
- Pre-generating comic images for all verses — too large; hybrid approach instead
- Hebrew/Greek original language tools — future milestone

## Context

- Existing codebase: React 19 + TypeScript + Vite, currently has Gemini/Groq AI integration
- Existing translations live in `public/translations/` as structured files
- Current app already displays comic panels and AI explanations per verse
- The shift: explanations move from runtime AI calls → build-time generated data bundled with app
- Scripture sources: public domain texts (KJV, WEB, Douay-Rheims, Enoch translations, Quran Yusuf Ali/Pickthall)
- Total text volume estimate: ~10–30MB compressed for all traditions combined

## Constraints

- **Offline-first**: Once installed, no network calls for verse text or explanations
- **Bundle size**: Scripture data must be chunked/lazy-loaded to keep initial load fast
- **Public domain only**: All bundled texts must be copyright-free
- **No backend**: App is pure frontend — all data lives in the client

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bundle scripture as JS/JSON modules | Enables Vite tree-shaking and lazy imports per canon | — Pending |
| Pre-generate explanations at build time | Eliminates runtime AI dependency; works offline forever | — Pending |
| Hybrid comic (online generate / offline text card) | Balance between full offline and rich experience | — Pending |
| Context window = passage (3-5 verses) + narrative explanation | User wants to understand the story, not just the verse | — Pending |

---
*Last updated: 2026-03-19 after initialization*
