# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Client-side Single Page Application with feature-locked tiered content and AI-powered content generation.

**Key Characteristics:**
- Monolithic React component (`App.tsx`) managing all state and feature access
- Client-side caching and localStorage persistence for all user data
- Feature gating through tier-based access control (Free, Explorer, Scholar)
- Optional delegation to external AI services (Gemini primary, Groq for quiz/explain)
- Static scripture data bundled locally from multiple canon sources

## Layers

**Presentation Layer:**
- Purpose: Render UI components and handle user interactions
- Location: `components/` directory
- Contains: React functional components for modals, panels, boards, and UI features
- Depends on: Type definitions from `types.ts`, service functions
- Used by: `App.tsx` main component
- Key components: `ComicPanel.tsx`, `CharacterLibrary.tsx`, `GuidedJourneys.tsx`, `Leaderboard.tsx`, `MembershipModal.tsx`

**State Management Layer:**
- Purpose: Manage all application state (reading progress, user stats, content cache, feature state)
- Location: `App.tsx` (main component using React hooks)
- Contains: 40+ useState hooks tracking reading selection, generated content, user stats, modals, journeys, offline packs
- Depends on: localStorage for persistence, services for data loading
- Used by: All components via props and callbacks

**Service Layer:**
- Purpose: Handle external integrations, caching, and data loading
- Location: `services/` directory
- Contains:
  - `geminiService.ts`: Generates comic scripts, panels, quizzes, explanations, speech via Google Gemini
  - `groqService.ts`: Alternative provider for quiz generation and text explanation when configured
  - `cacheService.ts`: localStorage-based caching for generated chapters
  - `textLibrary.ts`: Loads and manages scripture text from bundled datasets

**Data Layer:**
- Purpose: Store scripture datasets and configuration
- Location: `bible-translations-master/`, `AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION/`, `data/`
- Contains:
  - Bible translations (KJV, NIV, NLT, NKJV, NASB, GNV, ESV, etc.) as JSON
  - Quranic text with transliteration
  - Deuterocanonical texts
  - Guided journey definitions in `data/guidedJourneys.ts`
- Depends on: None (static files)
- Used by: `textLibrary.ts` and `App.tsx` for scripture content

## Data Flow

**Comic Generation Flow:**

1. User selects book, chapter, version, art style, language
2. `App.tsx` calls `generateComicScript()` from `geminiService.ts`
3. Gemini receives system instruction to create comic panels with JSON schema
4. Response includes title, summary, characters, life application, panels with narrative/speech/visuals
5. For each panel, `generatePanelImage()` calls Gemini again with visual prompt
6. `saveToCache()` via `cacheService.ts` stores generated chapter in localStorage
7. `ComicPanel.tsx` components render with lazy loading of images
8. User can trigger `generateQuiz()` or `explainText()` via Groq (if configured) or Gemini

**Scripture Text Loading:**

1. `loadTextCatalog()` fetches `/library/catalog.json` (once, cached in promise)
2. `discoverScriptures()` scans bundled imports from bible-translations-master and Quran datasets
3. User selects version → `loadChapterText()` returns verses array
4. Fallback logic prevents requesting unbundled versions

**State Persistence Flow:**

1. Component updates state with setState
2. useEffect watches state changes and syncs to localStorage
3. On app load, useEffect hydrates state from localStorage
4. Streak tracking: compares lastVisit date with today, increments or resets
5. Daily AI usage resets at midnight

**Feature Access Control Flow:**

1. User attempts feature (e.g., select art style, change language)
2. `checkFeatureLock()` validates against tier and feature type
3. If locked: show `MembershipModal.tsx` prompting upgrade
4. If allowed: execute action and update tier limits if needed

## Key Abstractions

**BibleVersion Enum:**
- Purpose: Represent canonical Bible translations with tier restrictions
- Examples: `BibleVersion.NIV`, `BibleVersion.KJV`, `BibleVersion.SEPTUAGINT`
- Pattern: Enum values map to JSON filenames in `bible-translations-master/`
- Used to: Filter version selectors, determine available content per tier

**ComicPanelData Interface:**
- Purpose: Represent a single comic panel with narrative, dialogue, and visuals
- Fields: `id`, `narrative`, `speechBubbles`, `visualPrompt`, `verseReference`, `imageUrl`, `isLoadingImage`
- Pattern: Generated as array from `ScriptResponse`, persisted in cache as `CachedChapter.panels`

**ScriptureEntry Interface:**
- Purpose: Discovered scripture source (Bible translation, Quran, Deuterocanonical)
- Fields: `id`, `displayName`, `group`, `path`, `loader`, `books`
- Pattern: Dynamically discovered via glob imports; populated on app mount
- Used for: Selecting alternative scripture canons beyond standard 66 books

**CachedChapter Interface:**
- Purpose: Represent a fully generated and cached chapter with all AI-generated content
- Fields: `key` (cache key), book, chapter, language, version, title, summary, life_application, characters, panels
- Pattern: Stored as serialized JSON in single localStorage entry `scripture_cache_v1`

**UserStats Interface:**
- Purpose: Track user engagement, tier status, and rate limits
- Fields: `streak`, `lastVisit`, `xp`, `chaptersRead`, `bookmarks`, `tier`, `dailyAiUsage`, `lastAiUsageDate`
- Pattern: Persisted to localStorage key `scriptureComix_stats`, updated on mount and mutations

**JourneyProgress Interface:**
- Purpose: Track user progress through guided learning paths
- Fields: `journeyId`, `currentIndex`, `completed[]`, `startedAt`, `lastUpdated`
- Pattern: Index into `GUIDED_JOURNEYS.chapters`, stores completed chapter indices

## Entry Points

**Application Entry:**
- Location: `index.tsx`
- Triggers: Browser load → ReactDOM renders `App` component to `#root` div
- Responsibilities: Mount React app, initialize root with StrictMode

**Main Component:**
- Location: `App.tsx`
- Triggers: Component mount triggers all useEffect initialization hooks
- Responsibilities: Manage all app state, coordinate between services and UI, enforce feature access control

**Feature Handlers:**
- `handleGenerate()`: Orchestrates comic generation workflow
- `handleUpgrade()`: Updates tier and persists new limits
- `handleJourneyStart/Resume/Reset()`: Manages guided journey state
- `checkFeatureLock()`: Guards feature access based on tier and quota

## Error Handling

**Strategy:** Try-catch with fallback UI states and console warnings.

**Patterns:**

- **Missing API keys:** Services throw errors at call time (not import time) to support SSR scenarios. App displays error state.
- **Network failures:** `textLibrary.ts` returns `null` on fetch failure; UI shows "Unable to load native text."
- **Cache write failures:** `cacheService.ts` catches and logs `console.warn`, app continues without cache.
- **Parsing errors:** JSON parse errors caught and logged; fallback to empty state (e.g., `catch(() => ({}))`).
- **Scripture not found:** User sees error message in chapter text area if version unbundled or chapter missing.
- **AI generation failures:** Error state shown via `error` state variable, user prompted to retry.

## Cross-Cutting Concerns

**Logging:** Minimal use of `console.log`, `console.warn` for errors. No structured logging framework.

**Validation:**
- Version selection validated against tier via `checkFeatureLock('version')`
- Scripture book names validated against `BIBLE_BOOKS` constant
- Cache keys normalized (lowercase, trimmed) in `getCacheKey()`
- JSON schema validation for AI responses via Gemini's `responseSchema` and Groq manual parsing

**Authentication:** None. App is entirely client-side, no user accounts or server auth.

**Rate Limiting:** Daily AI usage tracked in `stats.dailyAiUsage`, reset at midnight. Tier-specific limits in `TIER_LIMITS`.

**Tier/Monetization:**
- Three tiers: `FREE`, `EXPLORER`, `SCHOLAR`
- Feature matrix in `checkFeatureLock()`:
  - Books: Free tier restricted to `FREE_ALLOWED_BOOKS`
  - Versions: Free (3), Explorer (8), Scholar (all)
  - Art styles: Free (1), Explorer (3), Scholar (9)
  - AI usage: Free (20/day), Explorer (50/day), Scholar (unlimited)
  - Languages: Free (English only), Explorer (all), Scholar (all)
  - PDF download: Scholar only

---

*Architecture analysis: 2026-03-19*
