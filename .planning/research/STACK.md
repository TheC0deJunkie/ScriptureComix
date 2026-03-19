# Stack Research: ScriptureComix Multi-Tradition Scripture Platform

**Confidence:** HIGH — grounded in direct codebase inspection

---

## Recommended Stack

### Keep (No Changes)

| Layer | Tech | Rationale |
|-------|------|-----------|
| UI | React 19 + TypeScript | Already in place, no migration |
| Build | Vite 6 | Fast HMR, excellent code splitting |
| Styling | Tailwind CSS | Already in place |
| AI (online) | Gemini / Groq | Already wired — keep for comic generation |

### Add

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `idb` | ^8.0 | IndexedDB wrapper for comic image cache | localStorage 5MB cap is hit within a few books of explanation text; idb is 1.1KB and ergonomic |
| `vite-plugin-pwa` | ^0.20 | Service Worker + Workbox offline caching | Without SW, "offline" only works if user never closes the tab. CacheFirst strategy for `/public/data/*.json` |
| `workbox-strategies` | bundled with vite-plugin-pwa | Cache-first route handling | Required for true offline |

### Do NOT Add

| Library | Why Not |
|---------|---------|
| `sqlite-wasm` | Requires COOP/COEP headers (breaks most deployments); overkill for read-only reference data |
| `Dexie.js` | 24KB overhead; idb is sufficient for our use case |
| Any runtime AI library | Explanations are pre-generated; zero runtime AI for verse lookup |

---

## Scripture Data Sources (Public Domain Only)

### Protestant (66 books)
- **KJV** — Public domain. Source: `scrollmapper/bible_databases` (GitHub)
- **WEB (World English Bible)** — CC0. Source: `scrollmapper/bible_databases`
- **GNV (Geneva Bible 1599)** — Public domain. Already present in codebase — SAFE to ship

### Catholic Deuterocanonical (7 additional books)
- **Douay-Rheims 1899 American Edition** — Public domain. Source: `scrollmapper/bible_databases`
- **DO NOT USE** the NABRE dataset already on disk — `bible-nabre-json-dataset` was scraped from BibleGateway; NABRE is under USCCB copyright

### Ethiopian Orthodox (additional ~8 books beyond Catholic)
- **1 Enoch** — R.H. Charles 1917 translation. Public domain. Source: Project Gutenberg
- **Jubilees** — R.H. Charles 1902 translation. Public domain. Source: Project Gutenberg
- **Meqabyan 1-3** — ⚠️ GAP: No verified public-domain machine-readable English translation exists. Scope must be limited to what can actually be sourced.
- **Other Ethiopian additions** (Baruch, Prayer of Manasses, Esdras) — Available in Douay-Rheims / Charles translations

### Quran (114 surahs)
- **Yusuf Ali (1934)** — Public domain in the US. Verse-addressable JSON available
- **Pickthall (1930)** — Public domain in the US. Good alternative

---

## Data Storage Architecture

### ❌ Current Problem
`textLibrary.ts` lines 2-7 statically import 6 Bible translations into the main bundle (~28MB uncompressed). This eagerly bundles everything at startup.

### ✓ Correct Approach
Move all scripture data to `public/data/` as static JSON files, fetched at runtime and cached by Service Worker:

```
public/
  data/
    protestant/
      kjv/
        genesis.json       (~50KB per book)
        exodus.json
        ...
      web/
        ...
    catholic/
      douay-rheims/
        ...
    ethiopian/
      ...
    quran/
      yusuf-ali/
        surah-001.json
        ...
    explanations/
      protestant/
        kjv/
          genesis.json     (~75KB per book, all verses)
      ...
    indexes/
      protestant.json      (~5KB canon index)
      catholic.json
      ethiopian.json
      quran.json
```

### Why Per-Book JSON (Not Per-Verse Files)
- Per-verse: 31,000+ files crashes Vite chunk manifest
- Per-canon monolith: 100MB blocks initial parse
- Per-book: ~50-75KB chunks, lazy-loaded on demand — optimal

---

## Explanation Pre-Generation Pipeline

- **Tool**: Standalone Node.js script (`scripts/generateExplanations.ts`)
- **NOT a Vite plugin** — AI generation takes hours; must not run on every `vite build`
- Output JSON committed to repo; `vite build` only bundles pre-existing data
- Must have checkpoint/resume logic (will hit API rate limits mid-run)
- Scale: ~31K Protestant verses + ~5K deuterocanonical + ~6.2K Quran ayahs = ~44K total units

---

## Bundle Size Estimates

| Canon | Verse Text | Explanations | Total |
|-------|-----------|--------------|-------|
| Protestant (KJV) | ~4MB | ~15MB | ~19MB |
| Catholic additions | ~1MB | ~3MB | ~4MB |
| Ethiopian additions | ~0.5MB | ~2MB | ~2.5MB |
| Quran | ~2MB | ~7MB | ~9MB |
| **Total** | **~7.5MB** | **~27MB** | **~34.5MB** |

All lazy-loaded per-book. Initial app load: <500KB JS + ~5KB index manifests.

---

*Research completed: 2026-03-19*
