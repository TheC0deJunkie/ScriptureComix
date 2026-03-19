# Coding Conventions

**Analysis Date:** 2026-03-19

## Naming Patterns

**Files:**
- Components: PascalCase with `.tsx` extension (e.g., `components/ComicPanel.tsx`, `components/CharacterBuilder.tsx`)
- Services: camelCase with `.ts` extension (e.g., `services/geminiService.ts`, `services/cacheService.ts`)
- Data files: camelCase with `.ts` extension (e.g., `data/guidedJourneys.ts`)
- Types file: `types.ts` at root

**Functions:**
- camelCase for function names (e.g., `handlePlayAudio`, `generateComicScript`, `loadCachedChapter`)
- Async functions use `async`/`await` pattern (e.g., `const generateComicScript = async (...)`)
- Event handlers prefixed with `handle` (e.g., `handlePlayAudio`, `handleDragStart`, `handleDrop`)
- Helper functions prefixed appropriately (e.g., `generateQuiz`, `loadChapterText`, `getCacheKey`)

**Variables:**
- camelCase for local variables (e.g., `textToRead`, `bubbleOffsets`, `isPlaying`)
- Constants in UPPER_SNAKE_CASE (e.g., `STORAGE_KEY`, `GEMINI_API_KEY`, `BASE_PATH`)
- State variables from `useState` in camelCase (e.g., `const [isPlaying, setIsPlaying]`)
- State setter follows `set{PascalCase}` pattern (e.g., `setIsPlaying`, `setForm`)

**Types:**
- Interfaces for objects: PascalCase without suffix (e.g., `ComicPanelData`, `CharacterProfile`, `ComicPanelProps`)
- Props interfaces: `{ComponentName}Props` suffix (e.g., `ComicPanelProps`, `CharacterBuilderProps`)
- Enums: PascalCase (e.g., `UserTier`, `BibleVersion`, `ArtStyle`)
- Union types: PascalCase (e.g., `FaithTradition`, `ExploreLevel`)

## Code Style

**Formatting:**
- No linter or formatter configured (`.eslintrc` or `.prettierrc` not present)
- Indentation: 2 spaces (visible in all source files)
- Line length: No strict limit enforced, but generally stays under 100 characters
- Trailing commas in multi-line structures

**String Quotes:**
- Double quotes for JSX strings and general code
- Template literals for dynamic content (e.g., `` const prompt = `Create a comic script for ${book} Chapter ${chapter}` ``)

**Spacing:**
- No space between function name and parentheses (e.g., `handlePlayAudio()` not `handlePlayAudio ()`)
- Spaces around operators (e.g., `x = 5`, `arr.map(x => x * 2)`)
- No spaces inside object/array literals with short content (e.g., `{ x, y }`)

## Import Organization

**Order:**
1. React and core library imports (e.g., `import React, { useState }`)
2. Third-party dependencies (e.g., `import { lucide-react icons }`)
3. Local type imports (e.g., `import { ComicPanelData } from '../types'`)
4. Local component imports (e.g., `import { ComicPanel } from './ComicPanel'`)
5. Local service imports (e.g., `import { generateSpeech } from '../services/geminiService'`)
6. Local utility/data imports (e.g., `import { GUIDED_JOURNEYS } from './data/guidedJourneys'`)

**Path Aliases:**
- Configured in `tsconfig.json`: `@/*` points to project root (`./*`)
- Usage in imports: rarely used in current codebase, prefers relative paths
- Relative paths dominate: `../services/`, `../components/`, `../types`

**Import Style:**
```typescript
// Named imports from services
import { generateComicScript, generatePanelImage, generateQuiz, explainText } from './services/geminiService';

// Default imports rare, example from App.tsx:
import App from './App';

// Namespace imports used for service delegation:
import * as groqService from "./groqService";
```

## Error Handling

**Patterns:**
- Try/catch blocks used for async operations that may fail
- Promise chains use `.catch()` for error handling
- Error messages are descriptive and often logged (e.g., `throw new Error('Missing Gemini API key. Add VITE_GEMINI_API_KEY to your .env.local file.')`)
- Silent failures common in non-critical paths (e.g., cache operations wrap with try/catch and return early)

**Error Recovery:**
```typescript
// Example from cacheService.ts: Graceful fallback
const readStore = (): CacheStore => {
  if (!isBrowser()) return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CacheStore;
    return parsed || {};
  } catch {
    return {}; // Silent failure - returns empty store
  }
};

// Example from geminiService.ts: Error logging
try {
  // Image generation attempt
} catch (error) {
  console.error("Image gen error:", error);
  return `https://placehold.co/800x800/EEE/31343C?text=Image+Generation+Failed`;
}

// Example from App.tsx: Graceful degradation
try {
  const data = await loadScriptureData(entry);
} catch (err) {
  console.warn('Failed to load scripture data:', err);
  // Continue without crashing
}
```

## Logging

**Framework:** Native `console` object

**Patterns:**
- `console.error()` for critical failures (e.g., `console.error("Image gen error:", error)`)
- `console.warn()` for recoverable errors or degraded paths (e.g., `console.warn("Cache write failed", error)`)
- `console.log()` appears to be avoided in production code
- Error messages often include context (e.g., `"Audio playback error"` with error object)
- Warnings include action taken (e.g., `console.warn('Failed to discover scriptures:', err)`)

## Comments

**When to Comment:**
- Comments sparse throughout codebase; relied on clear naming
- Section headers used in multi-part components (e.g., `// 1. NARRATIVE HEADER`, `// 2. IMAGE AREA`)
- Architecture/intent comments in complex logic (e.g., service notes about delegation to Groq)

**JSDoc/TSDoc:**
- Not systematically used
- Function parameters and return types rely on TypeScript type annotations instead
- Service files include top-level comments for configuration guidance

**Comment Example from groqService.ts:**
```typescript
// Groq integration helper
// NOTE: Never commit API keys into source. Set these in your environment or Vite .env files:
// VITE_GROQ_API_URL - base URL for Groq API
// VITE_GROQ_API_KEY - API key for Groq
```

## Function Design

**Size:**
- Functions range from 5-50 lines typically
- Async service functions typically 20-40 lines with schema configuration
- Component handlers kept under 15 lines
- Complex logic (e.g., scripture discovery in `textLibrary.ts`) spans 50+ lines

**Parameters:**
- Use object destructuring for props interfaces (e.g., `({ data, index, onExplain })`)
- Multiple parameters use object destructuring (e.g., `const { book, chapter, version, language, artStyle }`)
- Default parameters common in functions (e.g., `artStyle: ArtStyle = ArtStyle.COMIC_MODERN`)
- Optional parameters with `?` in interfaces

**Return Values:**
- Explicit type annotations on async functions (e.g., `Promise<ScriptResponse>`)
- Nullable returns use union types (e.g., `CachedChapter | null`)
- Service functions return structured types from `types.ts`

## Module Design

**Exports:**
- Named exports used (e.g., `export const generateComicScript = async (...)`)
- Default exports used only for main components (e.g., `export default App`)
- Services expose multiple named exports (e.g., `generateQuiz`, `explainText`, `generatePanelImage`)

**Barrel Files:**
- Not used; each component/service imported directly by path

**Component Export Pattern:**
```typescript
export const ComicPanel: React.FC<ComicPanelProps> = ({ data, index, onExplain }) => {
  // Component implementation
};
```

**Service Export Pattern:**
```typescript
export const generateComicScript = async (
  book: string,
  chapter: number,
  // ... params
): Promise<ScriptResponse> => {
  // Implementation
};

export const generateQuiz = async (book: string, chapter: number): Promise<QuizResponse> => {
  // Implementation
};

export default App;
```

## React Patterns

**Component Type:**
- Functional components with `React.FC<Props>` type annotation
- Example: `export const Loader: React.FC<{ text?: string }> = ({ text = "Generating..." }) => { ... }`

**Hooks:**
- `useState` for local state
- `useEffect` for side effects (though not extensively shown in excerpts)
- `useRef` for DOM references

**Styling:**
- Tailwind CSS with utility classes
- Comic book theme with borders: `border-4 border-black`, `shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`
- Responsive classes: `md:text-lg`, `print:shadow-none`
- Animations: `animate-spin`, `animate-ping`, `animate-bounce`
- Custom font class: `comic-font` (assumed defined in global styles)

---

*Convention analysis: 2026-03-19*
