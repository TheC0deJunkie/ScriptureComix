# Feature Landscape

**Domain:** Multi-tradition scripture reader with AI-generated comic panels
**Researched:** 2026-03-19
**Confidence:** HIGH (grounded in live codebase inspection)

---

## Table Stakes

Features users expect from a scripture reading app. Absence makes the product feel
incomplete or untrustworthy to faith communities.

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| Canon completeness — Protestant 66 books | Baseline for any Bible app | Low | Partial | KJV/NIV/NLT/NKJV/NASB/GNV bundled; BOOK_COLLECTIONS in types.ts covers OT+NT |
| Canon completeness — Catholic 73 books | Expected by Catholic users; Deuterocanon excluded = brand damage | Medium | Partial | NABRE dataset present on disk; not yet surfaced in main book selector |
| Canon completeness — Ethiopian 81 books | Differentiator audience; missing = community rejection | High | Not started | Dataset not yet integrated; highest complexity due to scarce data |
| Canon completeness — Quran 114 surahs | Required for Muslim audience promised by product | Medium | Partial | AL-QURAN dataset present; exposed via discoverScriptures() but not in default book list |
| Tradition/canon switcher UI | Users must be able to choose their tradition without hunting | Medium | Not started | Currently only a version/translation dropdown; no tradition-aware grouping |
| Offline verse text (translations bundled) | Core offline-first promise; runtime fetch = broken in field | Medium | Partial | KJV/NIV/NLT/NKJV/NASB/GNV bundled via static import; others loaded dynamically |
| Verse-level navigation (book / chapter / verse) | Standard expectation; chapter-only nav feels coarse | Medium | Partial | Book + chapter selectors exist; verse-level picker not present |
| Passage context panel (3-5 surrounding verses + narrative) | Single-verse comics lose meaning without context | Medium | Not started | No dedicated context panel; explanation panel exists but is AI-generated on demand |
| Pre-generated bundled explanations (build-time, zero runtime AI) | Offline-first requirement; runtime AI = fails without connectivity | High | Not started | Current explain flow calls Groq/Gemini at runtime; no build-time pipeline exists yet |
| Graceful offline degradation to text card for comics | Comic images require network; app must not break offline | Low | Partial | imageUrl is optional on ComicPanelData; text fallback rendering partially handled |
| Cross-tradition verse search | Users look up verses they heard; search must span all loaded canons | High | Not started | No search feature present in codebase |
| Chapter quiz (offline) | Engagement feature; currently runtime AI | Medium | Partial | Quiz exists (QuizResponse type, generateQuiz service) but requires Groq/Gemini at runtime |

---

## Differentiators

Features that distinguish ScriptureComix from YouVersion, Logos, or plain Bible apps.
Not table stakes — but the reasons users recommend the app.

| Feature | Value Proposition | Complexity | Status | Notes |
|---------|-------------------|------------|--------|-------|
| Comic panel with AI-generated images | Visual storytelling makes ancient text visceral and memorable; no other scripture app does this at chapter scale | High | Exists | Core differentiator; Gemini image generation wired in geminiService.ts |
| Hybrid comic (AI image online / stylized text card offline) | Preserves comic experience without network dependency; offline users get a degraded-but-functional panel | Medium | Partial | imageUrl optional; offline text rendering partially in place; needs design pass |
| Pre-generated offline explanations (build-time pipeline) | Unique: no other scripture app ships AI-quality explanations without runtime calls; enables retreat/mission-field use | High | Not started | Would require a build script (like scripts/ dir) that generates explanation JSON per verse/chapter before deploy |
| Multi-tradition in a single app | Protestant + Catholic + Ethiopian + Quran in one unified UI; rare in the market | High | Partial | Data assets exist; UI does not yet present tradition as a first-class selector |
| Passage context with narrative summary in plain language | AI-written "what is happening here" in layman's terms; bridges academic commentary and casual reading | Medium | Partial | comicSummary and lifeApplication already generated per chapter; needs surfacing as standalone context panel |
| Guided journeys across books/chapters | Curated reading plans with XP rewards; turns Bible reading into a structured experience | Medium | Exists | GuidedJourneys component + GUIDED_JOURNEYS data wired in; JourneyProgress tracked in localStorage |
| Art style selection (9 styles) | Reader personalisation; Manga, Stained Glass, Oil Painting, etc. make the same text feel fresh | Medium | Exists | ArtStyle enum with 9 options; gated by tier (FREE_STYLES, EXPLORER_STYLES, Scholar all) |
| Custom hero/character builder | Reader inserts a personal character archetype into the story; increases engagement | High | Exists | CharacterBuilder component; CustomHero type; up to 3 active heroes (HERO_LIMIT) |
| Build-time explanation pipeline as reusable approach | Can be open-sourced or licensed as an infrastructure pattern for other faith-tech products | High | Not started | Architectural concept not yet implemented |

---

## Anti-Features

Features explicitly excluded from v1 scope. Shipping these would add cost, complexity,
or risk without proportional user value at this stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Pre-generating comic images for all verses | 31,000+ Bible verses * multiple art styles = millions of images; storage and cost are infeasible | Generate on-demand online; cache locally; degrade to text card offline |
| Runtime AI for offline explanations | Defeats offline-first goal; Groq/Gemini calls require network and API keys | Run explanation generation at build time; ship static JSON with app bundle |
| User accounts / cloud sync | Auth infrastructure, privacy obligations, and sync conflicts are a product in themselves | Use localStorage + JSON export for portability (OfflinePack export already implemented) |
| Hebrew / Greek / Arabic interlinear tools | Scholarly tools for a different user segment (academics, seminarians); adds significant data and UI complexity | Defer to a Scholar+ tier or a separate companion tool |
| Native iOS / Android app | Adds a separate release track, platform-specific build pipelines, and App Store review dependencies | Ship as a PWA with offline support via service workers; this covers the majority of mobile use cases |
| Social features (public reflections, likes, follows) | Moderation, abuse prevention, and community management are full-time work; premature at this scale | StudyGroup (CollaborativeHub) already exists as a local-only shared-code pattern; keep it offline-first |
| Full commentary database (Matthew Henry, ESV Study, etc.) | Licensed content is expensive; building a commentary layer competes with Logos and Blue Letter Bible on their turf | Use AI-generated summaries and explanations as the value layer instead |
| Liturgical calendar integration | Useful but niche; adds denomination-specific complexity (Roman, Eastern, Ethiopian calendars differ significantly) | Defer to a later milestone once core multi-tradition support is stable |

---

## Feature Dependencies

```
Canon data (Protestant 66)
  -> Verse-level navigation
  -> Cross-tradition verse search
  -> Pre-generated explanations (build-time pipeline)
  -> Comic panel generation (AI image)
      -> Hybrid comic (text card fallback)
      -> Offline pack export/import (exists)

Canon data (Catholic / Ethiopian / Quran)
  -> Tradition/canon switcher UI
  -> Cross-tradition verse search
  -> Pre-generated explanations (must cover all canons)

Build-time explanation pipeline
  -> Pre-generated offline explanations
  -> Offline quiz fallback (static questions)
  -> Passage context panel (static narrative)

Passage context panel
  -> Requires: offline verse text (bundled)
  -> Requires: pre-generated explanations OR live AI
```

---

## MVP Recommendation

The current app already ships the core comic experience. The most important gap is the
offline-first promise: users in low-connectivity environments (retreats, mission fields)
lose explanations, quizzes, and context entirely when AI services are unavailable.

Prioritise in this order:

1. **Canon completeness + tradition switcher** — Deliver the multi-tradition promise; NABRE
   and Quran data are already on disk. Surface them correctly in the UI.

2. **Passage context panel (static)** — Reuse the existing comicSummary / lifeApplication
   data to build a context panel that works without new AI calls.

3. **Pre-generated explanation pipeline** — Build the build-time script that generates
   explanation JSON for high-priority books (Psalms, Gospels, Genesis) and bundle it.
   This is the single biggest offline-first unlock and the clearest differentiator.

4. **Verse-level navigation** — Small UI addition; high usability gain; unblocks
   cross-tradition search in later phases.

5. **Hybrid comic text card polish** — Already partially implemented; needs a design pass
   so the offline experience feels intentional rather than broken.

Defer:
- **Cross-tradition verse search** — High complexity, depends on all canons being
  properly indexed first. Target after canon completeness is done.
- **Ethiopian canon** — Hardest data acquisition problem; tackle after Protestant +
  Catholic + Quran are fully surfaced.
- **Native app / PWA service worker** — Important for true offline but should follow
  the build-time explanation pipeline, not precede it.

---

## Sources

- Live codebase inspection: `types.ts`, `App.tsx`, `services/textLibrary.ts`,
  `services/groqService.ts`, `services/geminiService.ts`,
  `components/OfflinePackManager.tsx`, `components/GuidedJourneys.tsx`
- Canon book counts: Protestant 66, Catholic 73, Ethiopian 81 — well-established
  theological reference (HIGH confidence)
- Bundled translation datasets confirmed present on disk: KJV, NIV, NLT, NKJV,
  NASB, GNV (Protestant); NABRE (Catholic Deuterocanon); AL-QURAN with translation
- No external market research URLs used; findings derived from codebase state
