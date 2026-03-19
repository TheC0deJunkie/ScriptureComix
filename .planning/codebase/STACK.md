# Technology Stack

**Analysis Date:** 2026-03-19

## Languages

**Primary:**
- TypeScript ~5.8.2 - Full codebase, type-safe frontend application
- TSX (React + TypeScript) - All React components and entry points

**Secondary:**
- JSON - Scripture datasets, configurations, translations

## Runtime

**Environment:**
- Node.js - Development and build environment
- Browser (modern ES2022+) - Runtime execution

**Package Manager:**
- npm - Dependency and script management
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.0 - UI framework and component library
- Vite 6.2.0 - Build tool and dev server (config: `vite.config.ts`)
- Vite React Plugin 5.0.0 - JSX transformation

**Styling:**
- Tailwind CSS - Loaded via CDN in `index.html` (no npm dependency)
- Google Fonts - Comic Neue and Bangers fonts via CDN

**Testing:**
- Not detected

**Build/Dev:**
- Vite - Development server (port 3000, host 0.0.0.0)
- TypeScript - Type checking and compilation

## Key Dependencies

**Critical:**
- @google/genai 1.30.0 - Google Generative AI (Gemini) integration for content generation
- react-dom 19.2.0 - React DOM rendering
- lucide-react 0.555.0 - Icon library for UI components

**Infrastructure:**
- None - No backend framework or database ORM

## Configuration

**Environment:**
- Vite loads environment variables from `.env` files (not detected in repo, configured locally)
- Environment variables used:
  - `VITE_GEMINI_API_KEY` or `GEMINI_API_KEY` - Gemini API authentication
  - `VITE_GROQ_API_URL` - Groq service base URL (optional, enables fallback)
  - `VITE_GROQ_API_KEY` - Groq API key (optional, enables quiz/explain delegation)

**Build:**
- TypeScript config: `tsconfig.json`
  - Target: ES2022
  - Module: ESNext
  - JSX: react-jsx
  - Path alias: `@/*` maps to project root
  - Strict mode enabled with isolatedModules
- Vite config: `vite.config.ts`
  - Dev server: port 3000, host 0.0.0.0
  - React plugin enabled
  - Environment variables injected at build time

## Platform Requirements

**Development:**
- Node.js (version matching package.json, typically 18+)
- npm package manager
- TypeScript-capable IDE/editor

**Production:**
- Static hosting (Vite builds to dist/)
- Browser with ES2022 support
- CORS-enabled API access to Google Generative AI
- Optional: CORS-enabled access to Groq API

## External Resources

**CDN Dependencies:**
- Tailwind CSS: https://cdn.tailwindcss.com
- Google Fonts: https://fonts.googleapis.com
- React/React-DOM/Lucide: https://aistudiocdn.com (custom CDN mirror)

**Local Assets:**
- Bible translations (KJV, NIV, NLT, NKJV, NASB, GNV) in `bible-translations-master/`
- Deuterocanonical Bible texts in `bible-nabre-json-dataset-including-deutoronocanical/`
- Quran with translation in `AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION/`
- Scripture library catalog expected at `public/library/catalog.json`

---

*Stack analysis: 2026-03-19*
