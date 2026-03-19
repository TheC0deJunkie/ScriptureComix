# Codebase Concerns

**Analysis Date:** 2026-03-19

## Tech Debt

**Monolithic App Component:**
- Issue: `App.tsx` contains 1872 lines with 40+ state variables, multiple feature domains mixed together (reading, monetization, journeys, offline packs, custom heroes, study groups)
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx`
- Impact: Extremely difficult to test, maintain, and reason about. Adding features or fixing bugs requires navigating massive component. High risk of regressions.
- Fix approach: Extract feature domains into custom hooks (useJourneys, useStudyGroups, useOfflinePacks, useMusicianality, useStats). Consider Context API for state distribution. Break into smaller presentational components.

**Unsafe LocalStorage Serialization:**
- Issue: `App.tsx` lines 159-182 deserialize localStorage without comprehensive error handling. Most `JSON.parse()` calls lack try-catch (lines 167, 169, 172, 175, 177)
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx`
- Impact: Corrupted localStorage data crashes app. Single bad JSON entry can break entire feature. User data loss possible.
- Fix approach: Wrap all localStorage.getItem + JSON.parse in try-catch. Create parser utilities with defaults (e.g., `safeParseJSON<T>(raw: string, default: T): T`). Validate against schemas.

**Loose Type Safety with `any`:**
- Issue: Multiple `any` types bypass TypeScript safety:
  - `App.tsx:155` - `scriptureData: any`
  - `textLibrary.ts:200` - `extractVersesFromScripture(data: any, ...)`
  - `textLibrary.ts:296` - `extractVersesFromBibleJson(source: any, ...)`
  - `textLibrary.ts:184` - `loadScriptureData(...): Promise<any>`
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx`, `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/textLibrary.ts`
- Impact: Errors caught at runtime, not compile time. Unsafe property access. Scripture data parsing is fragile.
- Fix approach: Define proper TypeScript interfaces for all scripture data formats. Use discriminated unions for different Bible/Quran/Deuterocanonical formats. Add runtime validation (zod or similar).

**Uncaught Promise Rejections in useEffect:**
- Issue: `App.tsx:285-311` and `App.tsx:313-326` start async operations but only some errors are caught. `discoverScriptures()` failure at line 322 only logs warning. Failed text loading at line 414 doesn't propagate cleanly.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx`
- Impact: Silent failures. User doesn't know scripture discovery failed. Features silently degrade.
- Fix approach: Standardize error handling with explicit error state for each async operation (scriptureError, textLoadError). Show error UI to user. Implement retry logic with exponential backoff.

## Known Bugs

**Scripture Discovery May Break on Malformed Data:**
- Symptoms: App silently fails to discover scripture entries, resulting in empty `scriptureEntries` array. User sees no options.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/textLibrary.ts` lines 72-180 (discoverScriptures)
- Trigger: If any JSON file in bible-translations-master, AL-QURAN, or bible-nabre datasets has unexpected structure (e.g., missing `meta.title`, non-object `books`), try-catch swallows error and continues
- Workaround: Check browser console for warnings. Manually inspect JSON files in data folders.

**Audio Playback Crashes Silently:**
- Symptoms: ComicPanel audio button shows "playing" but no sound. User clicks repeatedly thinking it's broken.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/components/ComicPanel.tsx` lines 17-37
- Trigger: generateSpeech() throws (missing Gemini key, rate limit, network error). Error caught at line 33 but user not notified except console.error
- Workaround: Open browser DevTools to see error. Check .env.local has VITE_GEMINI_API_KEY

**Daily AI Usage Counter Doesn't Reset Correctly:**
- Symptoms: User hits 20-quest limit, then next day can generate but counter shows wrong value (off by one, doesn't reset to 0)
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx` lines 212-213 (streak/usage reset logic)
- Trigger: Date comparison logic between `lastAiUsageDate` and `today` may fail if localStorage has stale ISO string or user's timezone changes
- Workaround: Clear localStorage manually: `localStorage.clear()`. Reload app.

**Groq Service Silently Falls Back to Gemini:**
- Symptoms: Quiz or explanation generates but user's configured Groq endpoint isn't called. API costs go to Gemini instead.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/geminiService.ts` lines 233-276, `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/groqService.ts` lines 16-19
- Trigger: Groq key not set OR Groq fetch fails. No error shown, just silently uses Gemini
- Workaround: Check Network tab in DevTools to see which API is called. Verify VITE_GROQ_API_URL and VITE_GROQ_API_KEY are set.

## Security Considerations

**API Key Exposure Risk:**
- Risk: Vite .env variables (VITE_GEMINI_API_KEY, VITE_GROQ_API_KEY) are bundled into client-side JavaScript. Any user can inspect network traffic or DevTools to extract keys.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/geminiService.ts` lines 8-11, `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/groqService.ts` lines 8-9
- Current mitigation: Documentation in groqService.ts (lines 4-6) warns "Never commit API keys". .gitignore likely prevents .env commit.
- Recommendations: Move API calls to backend proxy. Implement server-side authentication with JWT. Use API key restrictions (IP whitelisting, rate limiting). Rotate keys regularly.

**Unvalidated JSON Parsing from External Datasets:**
- Risk: Scripture JSON files (KJV, NIV, Quran) loaded directly from import.meta.glob without validation. Malicious file could inject code if dataset is compromised.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/textLibrary.ts` lines 12-25 (dynamic imports)
- Current mitigation: Files are bundled at build time (not runtime fetch), reducing supply chain risk
- Recommendations: Add JSON schema validation before parsing. Sign datasets with hash verification. Scan dependencies with Snyk.

**LocalStorage Accessible to XSS:**
- Risk: All user data (stats, bookmarks, notes, custom heroes) stored unencrypted in localStorage. XSS vulnerability could dump all user data.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx` lines 159-282 (all localStorage access)
- Current mitigation: None. App doesn't have auth/encryption layer.
- Recommendations: For future authenticated version: encrypt localStorage values. Use IndexedDB with encryption. Implement Content Security Policy (CSP).

**Donation Modal Missing CSRF Protection:**
- Risk: handleDonation (line 429) currently just alerts. When Stripe integration added, payment handler will be in-app without CSRF tokens.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx` lines 429-437
- Current mitigation: Payment not yet implemented
- Recommendations: When adding Stripe: Use server-side payment intent creation. Add CSRF token to form. Implement webhook verification for payment confirmation.

## Performance Bottlenecks

**Large App Component Re-renders:**
- Problem: App.tsx has 40+ state variables. Any single state change causes full component re-render. With 1872 lines of JSX, this is expensive.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx` (entire component)
- Cause: No React.memo, no useMemo, no useCallback. State updates trigger cascading re-renders of all child components (ComicPanel, modals, etc.)
- Improvement path: Extract feature hooks (useJourneys returns [journey state, handlers] wrapped in useMemo). Memoize child components. Use Context selectively for deep tree updates.

**Scripture Discovery Eager Loads All Datasets:**
- Problem: discoverScriptures() (line 72-180) awaits ALL scripture files in glob, even if user never selects them. On large dataset directory, this blocks useEffect.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/textLibrary.ts` lines 72-180
- Cause: loops through all modules in repoBibleModules, repoQuranModules, repoDeutModules simultaneously
- Improvement path: Lazy-load scripture metadata only (names, counts). Defer actual data load until user selects. Implement pagination for large lists.

**Cache Key Generation Uses String Concatenation:**
- Problem: getCacheKey (line 30-44) creates cache keys by joining strings with `|`. For frequently accessed chapters, this is called repeatedly.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/cacheService.ts` lines 30-44
- Cause: No memoization. Every call to saveCachedChapter or loadCachedChapter recomputes key.
- Improvement path: Memoize getCacheKey with useMemo. Pre-compute commonly-accessed keys. Use Map instead of record for lookup.

**Image Generation Placeholder Falls Back to HTTP:**
- Problem: generatePanelImage (line 200) returns placehold.co image on failure. Network roundtrip for each failed image. No caching.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/geminiService.ts` lines 143-202
- Cause: No image generation rate limiting. No fallback SVG/canvas rendering.
- Improvement path: Render fallback image client-side (SVG with icon). Implement request deduplication (don't request same image twice). Add progressive loading (skeleton first).

## Fragile Areas

**Scripture Data Extraction Logic:**
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/textLibrary.ts` lines 199-268 (extractVersesFromScripture)
- Why fragile: Supports 4 different data formats (Bible, Translation, Quran, Surahs). Each format has different key structure. Small change to data format breaks parsing silently (returns null).
- Safe modification: Add detailed logging/warnings at each format check. Create separate extraction function per format (extractBibleVerse, extractQuranVerse, etc). Add unit tests for each format. Validate extracted data shape.
- Test coverage: No tests visible. Logic is complex and untested.

**Text Catalog Loading Promise Caching:**
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/textLibrary.ts` lines 46-68 (loadTextCatalog with catalogPromise)
- Why fragile: Single `catalogPromise` variable shared across all callers. If promise rejects, it's reset to null (line 64) but race conditions possible. If first load fails, subsequent calls retry forever.
- Safe modification: Use a status flag instead (loading, error, success). Don't cache failed promises. Implement max retry attempts.
- Test coverage: No visible tests.

**Journey Progress Calculation with Array Indices:**
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx` lines 577-578, 1226-1232 (nextIndex calculations)
- Why fragile: `completed` array stores chapter indices. findIndex looks for first non-completed index. If journey chapters change, indices shift and progress becomes incorrect. No validation that index is in bounds.
- Safe modification: Store completed chapter IDs instead of indices. Add bounds checking. Log warnings if index out of range.
- Test coverage: No unit tests for journey logic.

**Custom Hero Rendering with Array Limits:**
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx` line 54 (HERO_LIMIT = 3)
- Why fragile: Hardcoded limit of 3 heroes. No validation in setCustomHeroes that activeHeroIds stays in sync. If user deletes a hero but activeHeroIds still references it, ghost reference causes errors.
- Safe modification: Add validation in hero setters. Clean up activeHeroIds when hero is deleted. Move limits to types.ts.
- Test coverage: No tests visible.

## Scaling Limits

**LocalStorage Size Limit (~5-10MB):**
- Current capacity: Stores user stats, notes, journeys, study groups, custom heroes, offline packs. Complex objects serialize to large JSON strings.
- Limit: Browser localStorage limit is 5-10MB per domain. With many offline packs (each pack has 6-12 panels with images), storage fills quickly.
- Scaling path: Implement tiered storage (hot/cold). Move old offline packs to IndexedDB. Compress JSON before storage. Add storage quota warning UI. Implement cleanup of old data.

**AI API Rate Limits:**
- Current capacity: Gemini free tier ~1500 RPM. Groq likely similar. App tracks daily usage (20-9999 per tier) but doesn't track API call rate.
- Limit: If 100 users hit API simultaneously, rate limit hits. No backoff/retry strategy implemented.
- Scaling path: Implement request queue with exponential backoff. Cache common queries (explain patterns, popular verses). Implement server-side proxy to batch requests. Use CDN caching for explanations.

**Asset Loading (Bible Translations):**
- Current capacity: 6 Bible versions (~2-5MB total) bundled in build. Vite globbing imports all datasets at once.
- Limit: Adding more versions slows build and increases bundle size. At 50+ translations, bundle could exceed 50MB.
- Scaling path: Code-split translations by version. Use dynamic imports. Lazy-load on demand. Implement progressive enhancement (show English first, load others in background).

## Dependencies at Risk

**@google/genai (Gemini SDK):**
- Risk: Package maintains GenAI API client. Version locked to ^1.30.0. Google API changes could break.
- Impact: Comic script generation, panel images, quiz, explanations all depend on this. Breaking change disables all AI features.
- Migration plan: If Gemini becomes unreliable, implement direct REST API calls instead of SDK. Already have Groq as fallback for quiz/explain; extend to all features.

**Vite Dynamic Imports (import.meta.glob):**
- Risk: Vite feature may change in future versions. Glob patterns are fragile if directory structure changes.
- Impact: Scripture dataset discovery (textLibrary.ts lines 12-25) relies on glob patterns. Adding/removing datasets could break.
- Migration plan: Move datasets to explicit imports or server-side catalog. Implement file hash verification.

**React 19 & TypeScript 5.8:**
- Risk: Fresh major versions. Ecosystem plugins may have compatibility gaps. TS 5.8 strict mode could break build.
- Impact: App uses React Hooks heavily (40+ useState calls). Breaking changes in React could require refactor.
- Migration plan: Pin minor versions until ecosystem stabilizes. Monitor React changelog for deprecations.

## Missing Critical Features

**Error Boundary:**
- Problem: No React Error Boundary component. Single error in render crashes entire app.
- Blocks: Graceful error recovery. User can't recover without full page reload.

**Offline Support:**
- Problem: App downloads offline packs but doesn't work without network. ComicPanel, services assume fetch always available.
- Blocks: True offline mode. Users with spotty connection can't read downloaded content.

**Analytics/Telemetry:**
- Problem: No way to track which features are used, where users drop off, or which AI features fail.
- Blocks: Identifying which concerns to prioritize. Can't tell if audio or images are failing for most users.

**Monetization Integration:**
- Problem: handleDonation (line 429) only alerts. No Stripe/PayPal integration.
- Blocks: Actual revenue. Tier system is cosmetic.

## Test Coverage Gaps

**App.tsx Feature Logic:**
- What's not tested: checkFeatureLock logic (50+ lines of tier-based access control), journey progression, study group syncing, daily challenge, streak calculation
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx`
- Risk: High. Tier system controls monetization. Bugs break premium features or allow free access to paid features.
- Priority: **High** - Add tests for checkFeatureLock with all combinations (FREE/EXPLORER/SCHOLAR × art/book/version/ai/language/download)

**Scripture Data Extraction:**
- What's not tested: extractVersesFromScripture handles 4 different formats. Edge cases: empty books, malformed keys, missing translations
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/textLibrary.ts` lines 199-268
- Risk: High. Extraction fails silently. Corrupted data shown to users.
- Priority: **High** - Add parametrized tests for each format. Add tests for missing keys, type coercion.

**LocalStorage Serialization:**
- What's not tested: JSON.parse safety. What happens if corrupted data in storage? Does parsing fail gracefully?
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/App.tsx` lines 159-282
- Risk: Medium. App can crash on startup if localStorage corrupted.
- Priority: **Medium** - Add tests for corruption scenarios. Add integration tests for persist/restore cycle.

**Gemini & Groq API Calls:**
- What's not tested: Error handling when API fails. What happens if generateComicScript returns invalid JSON? What if image gen times out?
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/geminiService.ts`, `/c/Users/khule/OneDrive/Desktop/ScriptureComix/services/groqService.ts`
- Risk: High. Users see broken UI if API fails. No retry logic.
- Priority: **High** - Add mocked tests. Add tests for invalid responses, timeouts, rate limits.

**Component Integration:**
- What's not tested: How modals interact with main state. MembershipModal upgrade flow. CharacterLibrary adds character to custom heroes.
- Files: `/c/Users/khule/OneDrive/Desktop/ScriptureComix/components/`
- Risk: Medium. Feature interactions untested. Regressions possible.
- Priority: **Medium** - Add integration tests for key user flows (read chapter → generate comic → add bookmark, create custom hero → include in generation).

---

*Concerns audit: 2026-03-19*
