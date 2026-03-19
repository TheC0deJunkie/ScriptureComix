# Pitfalls Research: ScriptureComix Offline-First Scripture Platform

**Confidence:** HIGH — grounded in direct codebase inspection + copyright verification

---

## Critical Pitfalls (Phase Blockers)

### 1. Copyright Crisis — Copyrighted Translations Already in Codebase
**Severity:** BLOCKER — must resolve before shipping

**What's wrong:**
`textLibrary.ts` statically imports NIV, NLT, NKJV, NASB translations. The `bible-translations-master` dataset's MIT license covers only the JSON wrapper code — not the translation text itself. These are all under active copyright:
- NIV → Biblica
- NLT → Tyndale House
- NKJV → Thomas Nelson
- NASB → Lockman Foundation

Additionally, `bible-nabre-json-dataset` (Catholic) was scraped from BibleGateway. NABRE is under USCCB copyright.

**Warning signs:** Translation names like "NIV", "NLT", "NKJV", "NASB", "NABRE" in any bundled dataset

**Prevention:**
- Only ship: KJV, AKJV, WEB (CC0), GNV (Geneva 1599), Douay-Rheims 1899, Yusuf Ali/Pickthall Quran
- Remove or don't bundle the copyrighted translations
- Document the copyright status of every translation in `public/data/`

**Phase:** Must be resolved in Phase 1 (Data Foundation) before any explanation pre-generation begins

---

### 2. Ethiopian Canon Has No Complete Machine-Readable Public Domain Dataset
**Severity:** HIGH — scoping risk

**What's wrong:**
- 1 Enoch (Charles 1917) ✓ — Project Gutenberg, verse-addressable
- Jubilees (Charles 1902) ✓ — Project Gutenberg
- **Meqabyan 1-3** ❌ — No verified public-domain machine-readable English translation exists. These "Ethiopian Maccabees" are distinct from the Catholic 1-2 Maccabees. The only commonly cited translation is by R.J. McKinney but its copyright status is unclear.

**Warning signs:** Ethiopian canon listed as complete in roadmap before Meqabyan sourcing is confirmed

**Prevention:**
- Scope Ethiopian v1 to: OT+NT (same as Protestant) + 1 Enoch + Jubilees + other confirmed books
- Flag Meqabyan 1-3 as "v2 — pending source" in REQUIREMENTS.md
- Do not block the entire Ethiopian canon on Meqabyan

**Phase:** Clarify scope in Phase 1 before explanation pipeline runs

---

### 3. Vite Static Imports Will Destroy Bundle Performance
**Severity:** BLOCKER

**What's wrong:**
`textLibrary.ts` lines 2-7 import 6 translations statically into the main bundle. Adding more canons this way would push the initial JS bundle past 50MB.

**Warning signs:** `import` statements at top of `textLibrary.ts` referencing `public/library/` paths

**Prevention:**
- Move ALL scripture to `public/data/` as static JSON files
- Fetch at runtime: `fetch('/data/protestant/kjv/genesis.json')`
- Service Worker caches on first access — subsequent loads are instant offline

**Phase:** Phase 1, first task

---

## High-Severity Pitfalls

### 4. localStorage Crash on Deserialization (Existing Bug)
**Severity:** HIGH — guaranteed crash vector when explanation data added

**What's wrong:**
`App.tsx` lines 159-182 deserialize localStorage without try-catch. This existing bug (documented in `CONCERNS.md`) becomes a guaranteed crash when large explanation JSON is added to storage and the data ever gets corrupted or partially written.

**Warning signs:** `JSON.parse(localStorage.getItem(...))` without try-catch

**Prevention:**
- Wrap ALL localStorage reads in try-catch before Phase 2 (explanation pipeline)
- Add a migration/reset mechanism for corrupt storage

**Phase:** Fix in Phase 1

---

### 5. Explanation Pre-Generation at Scale Requires Checkpointing
**Severity:** HIGH — will hit rate limits without it

**What's wrong:**
44,000+ explanation units at ~2 seconds each = ~24 hours of generation. Without checkpoint/resume, a single API timeout or rate limit error restarts from zero.

**Warning signs:** Generation script with a simple `for` loop and no state persistence

**Prevention:**
- Checkpoint file: `scripts/.generate-checkpoint.json`
- Track last completed `{canonId}/{bookId}/{chapter}:{verse}`
- On resume, skip already-generated verses
- Batch requests with exponential backoff

**Phase:** Phase 2 (Explanation Pipeline)

---

### 6. Quran Ayah Numbering Silently Misaligns Explanations
**Severity:** HIGH — produces wrong explanations silently

**What's wrong:**
Different Quran editions handle the Basmala (opening "In the name of God...") differently:
- Some editions count it as verse 1 of each surah
- Others treat it as a prefix (surah 1 has 7 verses, not 8)
- Al-Fatiha (surah 1) is especially prone to this

This causes off-by-one errors where explanation for ayah N is displayed for ayah N+1.

**Warning signs:** Explanation text that seems to describe the wrong verse

**Prevention:**
- Pick ONE numbering convention for the entire Quran dataset
- Normalize all datasets to match before explanation generation
- Add a verification step: spot-check 10 random ayahs post-generation

**Phase:** Phase 1 (Data Foundation)

---

### 7. Cross-Tradition Search Requires Book Name Normalization
**Severity:** MEDIUM

**What's wrong:**
"1 Kings" in Protestant = "3 Kings" in Douay-Rheims/Ethiopian. "Revelation" = "Apocalypse". "1 Samuel" = "1 Kings" (in some traditions). Without normalization, search returns inconsistent or missing results.

**Prevention:**
- Build a canonical book ID mapping table: `{ "GEN": ["Genesis", "Bereishit"], "1KI": ["1 Kings", "3 Kings", "1 Kgs"] }`
- Store all data by canonical ID internally; display tradition-specific names in UI

**Phase:** Phase 1 (Data Foundation)

---

### 8. IndexedDB Storage Limits Vary by Browser/Device
**Severity:** MEDIUM

**What's wrong:**
IndexedDB storage is not unlimited:
- Chrome/Edge: up to 60% of disk space (but can be evicted under pressure)
- Firefox: up to 2GB per origin
- Safari: 1GB hard limit per origin
- Without `navigator.storage.persist()`, data can be evicted silently

**Prevention:**
- Request `navigator.storage.persist()` on first comic generation
- Implement LRU eviction in the comic cache before hitting 80% quota
- Show user a warning when storage is getting full

**Phase:** Phase 4 (Comic Cache Upgrade)

---

### 9. Per-Verse Explanation Files Will Crash Vite
**Severity:** HIGH — architectural mistake to avoid

**What's wrong:**
If explanations are stored as one file per verse (31,000+ files), Vite's chunk manifest at build time references all of them. Build times exceed 30 minutes; the manifest JSON itself is several MB.

**Prevention:**
- Store explanations per-book (one JSON per book), not per-verse
- Protestant: ~66 files; Catholic additions: ~7 files; etc.

**Phase:** Phase 2 (Explanation Pipeline) — get the schema right before generating 44K explanations

---

*Research completed: 2026-03-19*
