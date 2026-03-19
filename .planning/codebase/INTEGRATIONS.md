# External Integrations

**Analysis Date:** 2026-03-19

## APIs & External Services

**Generative AI:**
- Google Generative AI (Gemini) - Primary service for content generation
  - SDK/Client: `@google/genai` 1.30.0 package
  - Auth: `VITE_GEMINI_API_KEY` environment variable
  - Models used:
    - `gemini-2.5-flash` - Comic script generation, character profiles, quizzes, text explanations
    - `gemini-2.5-flash-image` - Panel image generation (visual content creation)
    - `gemini-2.5-flash-preview-tts` - Text-to-speech for comic narration
  - Functions: `services/geminiService.ts`
    - `generateComicScript()` - Creates comic panel scripts from scripture
    - `generatePanelImage()` - Generates artwork for panels with style variations
    - `generateCharacterProfile()` - Character biographical data
    - `generateQuiz()` - Bible comprehension quizzes (delegates to Groq if available)
    - `explainText()` - Theological/historical context explanations (delegates to Groq if available)
    - `generateSpeech()` - Audio narration generation

**Groq Service (Optional Fallback):**
- Groq API - Optional delegation for quiz generation and text explanations
  - SDK/Client: Custom fetch-based implementation
  - Auth: `VITE_GROQ_API_URL` and `VITE_GROQ_API_KEY` environment variables
  - Functions: `services/groqService.ts`
    - `generateQuiz()` - Alternative quiz generation
    - `explainText()` - Alternative text explanation service
  - Behavior: Groq is checked first if configured; Gemini falls back to primary Gemini service
  - Endpoint: `{VITE_GROQ_API_URL}/v1/completions`

## Data Storage

**Databases:**
- None - No backend database

**Local Storage:**
- Browser localStorage (client-side only)
  - Storage key: `scripture_cache_v1`
  - Purpose: Cache generated comic chapters, user preferences, progress
  - Service: `services/cacheService.ts`
  - Data cached:
    - Comic scripts and generated panels
    - User statistics (streaks, XP, bookmarks)
    - Journey progress tracking
    - Offline pack metadata
  - Max storage: Browser localStorage limits (~5-10MB typically)

**File Storage:**
- Local filesystem only - Scripture datasets bundled in source
  - Bible translations: `bible-translations-master/` (imported via Vite glob)
  - Quran texts: `AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION/` (imported via Vite glob)
  - Deuterocanonical texts: `bible-nabre-json-dataset-including-deutoronocanical/` (imported via Vite glob)
  - Loaded dynamically via `import.meta.glob()` in `services/textLibrary.ts`

**Caching:**
- In-memory translation cache in `textLibrary.ts`
  - Map: `translationCache` stores loaded translation files
  - Purpose: Avoid re-fetching same translations

## Authentication & Identity

**Auth Provider:**
- Custom client-side auth
  - No centralized auth service
  - User identity tracked via `UserStats` interface stored in localStorage
  - Reader profile captured at onboarding (faith tradition, exploration level)
  - User tier tracked (Free, Explorer, Scholar) for feature gates

**Subscription/Billing:**
- No external payment processor detected
- Tier system managed in-app via localStorage
  - Tier limits defined in `types.ts`: TIER_LIMITS map
  - Usage tracking: `dailyAiUsage` and `lastAiUsageDate` fields

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or error tracking service

**Logs:**
- Console logging only
  - `console.error()` for API failures (image generation, Groq calls)
  - `console.warn()` for cache write failures
  - No centralized logging service

**Analytics:**
- None detected - No Google Analytics, Mixpanel, or event tracking

## CI/CD & Deployment

**Hosting:**
- Static hosting required (no backend)
- Build output: Vite dist/ directory

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or build pipeline configured

## Environment Configuration

**Required env vars:**
- `VITE_GEMINI_API_KEY` (or `GEMINI_API_KEY`) - **CRITICAL** for core functionality
  - Fallback sources: `import.meta.env`, `process.env`
  - Missing key throws error: "Missing Gemini API key. Add VITE_GEMINI_API_KEY..."

**Optional env vars:**
- `VITE_GROQ_API_URL` - Groq base URL (enables optional quiz/explain delegation)
- `VITE_GROQ_API_KEY` - Groq API key (enables optional quiz/explain delegation)

**Secrets location:**
- `.env` or `.env.local` (not committed to repo, per `.gitignore`)
- Vite config in `vite.config.ts` injects `GEMINI_API_KEY` at build time

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None - No outbound webhooks or event callbacks

## Third-Party Libraries (Content & CDN)

**CDN Resources:**
- Tailwind CSS v3 (latest) - https://cdn.tailwindcss.com
- Google Fonts (Comic Neue, Bangers) - https://fonts.googleapis.com, https://fonts.gstatic.com
- React ecosystem (React, React-DOM, Lucide) - https://aistudiocdn.com (mirrors of npm packages)

**Image Fallback:**
- Placeholder service: https://placehold.co (used when image generation fails)

**Scripture Datasets:**
- Embedded locally - No external scripture API
- Translations loaded from bundled JSON files via Vite glob patterns

---

*Integration audit: 2026-03-19*
