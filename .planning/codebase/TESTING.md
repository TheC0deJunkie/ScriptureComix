# TESTING.md — ScriptureComix Test Structure

## Status

**No test suite exists.** The project has no testing framework configured and no test files.

---

## Test Framework

**Framework:** None installed
**Test runner:** None
**Config file:** None

`package.json` scripts only define `dev`, `build`, and `preview`. No `test` script exists.

---

## Test Files

No test files found. Searched for:
- `**/*.test.{ts,tsx,js,jsx}`
- `**/*.spec.{ts,tsx,js,jsx}`

Zero matches.

---

## Dependencies

No testing-related devDependencies:
- No Vitest, Jest, or similar unit test runner
- No Playwright, Cypress, or similar E2E framework
- No React Testing Library or similar component testing tool
- No mock libraries

---

## Coverage

Coverage: **0%** — no tests of any kind.

---

## What Should Be Tested

Given the codebase (React + TypeScript + AI service calls), priority test areas would be:

### Unit Tests (High Value)
- `src/services/geminiService.ts` — AI prompt construction, response parsing
- `src/services/groqService.ts` — Groq API integration, fallback behavior
- `src/utils/bibleUtils.ts` (if exists) — Bible reference parsing/formatting
- Translation discovery logic in `src/components/`

### Integration Tests (Medium Value)
- AI service fallback chain (Groq → Gemini)
- Translation file loading and parsing from `public/translations/`
- Book/chapter/verse navigation state

### Component Tests (Lower Priority)
- Comic panel rendering with different content
- Quiz interaction flow
- Settings/config panel

---

## Recommendations

To add testing, consider:

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event
```

Add to `vite.config.ts`:
```ts
test: {
  environment: 'jsdom',
  globals: true,
}
```

Add to `package.json`:
```json
"test": "vitest",
"test:ui": "vitest --ui"
```

---

## Notes

- The project is in early/MVP stage — no testing infrastructure established yet
- AI service calls will require mocking for unit tests
- Translation file loading (public/translations/) will need fixture files for tests
