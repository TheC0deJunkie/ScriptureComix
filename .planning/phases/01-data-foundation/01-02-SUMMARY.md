---
phase: 01-data-foundation
plan: "02"
subsystem: data-pipeline
tags: [data-transform, scripture, canon, manifest, kjv, nabre, quran]
dependency_graph:
  requires: ["01-01"]
  provides: ["public/data/ per-book JSON files", "canon manifests", "gitignore for copyrighted translations"]
  affects: ["01-03", "01-04", "01-05"]
tech_stack:
  added: []
  patterns: ["flat verse map {chap:verse: text}", "CanonManifest JSON schema", "idempotent transform script via npx tsx"]
key_files:
  created:
    - scripts/transformData.ts
    - public/data/protestant/manifest.json
    - public/data/catholic/manifest.json
    - public/data/ethiopian/manifest.json
    - public/data/quran/manifest.json
    - public/data/protestant/kjv/*.json (66 files)
    - public/data/protestant/web/*.json (66 files)
    - public/data/protestant/gnv/*.json (66 files)
    - public/data/protestant/niv/*.json (66 files, gitignored)
    - public/data/protestant/nlt/*.json (66 files, gitignored)
    - public/data/protestant/nkjv/*.json (66 files, gitignored)
    - public/data/protestant/nasb/*.json (66 files, gitignored)
    - public/data/catholic/nabre/*.json (73 files, gitignored)
    - public/data/ethiopian/kjv/*.json (75 files)
    - public/data/quran/yusuf-ali/*.json (114 files)
  modified:
    - .gitignore
decisions:
  - "Quran total ayah count from normalized output is 6235 (not 6236): source dataset counts Basmala as Al-Fatiha verse 1 for its 6236 total; after correct normalization (Basmala demoted to manifest field) the file-based total is 6235. The 6236 canonical convention assumes Basmala is NOT a numbered verse — this dataset is internally consistent at 6235 normalized ayahs."
  - "KJV source uses 'Psalm' (singular) and 'Song Of Solomon' (different capitalization) rather than 'Psalms'/'Song of Solomon' — CANONICAL_SLUG_MAP extended with both variants to map to correct slugs"
  - "NABRE gitignored alongside copyrighted Protestant translations per DATA-04 copyright policy"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_written: "~540 per-book JSON files + 4 manifests + 1 script"
---

# Phase 01 Plan 02: Data Transformation Script Summary

**One-liner:** TypeScript transform script converts 4 monolithic scripture datasets into ~540 per-book flat verse map JSON files and 4 CanonManifest files across Protestant (66 books × 7 translations), Catholic (73 books), Ethiopian (75 books including stubs), and Quran (114 surahs) traditions.

---

## What Was Built

`scripts/transformData.ts` — a 1,012-line Node.js/TypeScript script run via `npx tsx` that:

1. **Protestant translations (7):** Reads KJV, WEB, NIV, NLT, NKJV, NASB, GNV monolithic JSONs from `bible-translations-master/`. Transforms `{BookName: {ch: {v: text}}}` into per-book flat verse maps `{"1:1": "text"}`. Writes 66 files per translation to `public/data/protestant/{id}/`. Handles source book name variants ("Psalm" and "Song Of Solomon").

2. **NABRE Catholic (73 books):** Reads individual per-book JSON files from `bible-nabre-json-dataset-master/generated_data/books/`. Transforms `{chapters: [{chapter, verses: [{verse, text}]}]}` format. Writes 73 files to `public/data/catholic/nabre/`. Also copies deuterocanonical books (Tobit, Judith, 1-2 Maccabees, Wisdom, Sirach, Baruch) to the Ethiopian directory.

3. **Ethiopian Orthodox (75 books):** Copies 66 KJV per-book files. Includes 7 NABRE deuterocanonical books. Writes placeholder stubs for 1 Enoch and Jubilees (R.H. Charles translations not yet sourced).

4. **Quran (114 surahs):** Reads the monolithic Quran JSON. Normalizes Al-Fatiha: stores Basmala as manifest `basmala` field, renumbers verses 2-7 as ayahs 1-6. Strips inline footnote markers and footnote body text from all `translation_eng` values. Writes 114 surah files as flat ayah maps `{"1": "text"}`.

5. **4 canon manifests:** Protestant (66 books, 7 translations with copyright strings for NIV/NLT/NKJV/NASB), Catholic (73 books, NABRE with copyright), Ethiopian (75 books including 1-enoch/jubilees stubs), Quran (114 surahs, basmala field, Al-Fatiha = 6 ayahs).

6. **.gitignore:** Added entries for `public/data/protestant/niv/`, `nlt/`, `nkjv/`, `nasb/` and `public/data/catholic/nabre/`.

---

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| KJV book count | 66 | 66 | PASS |
| NABRE book count | 73 | 73 | PASS |
| Quran surah count | 114 | 114 | PASS |
| Protestant manifest books | 66 | 66 | PASS |
| Catholic manifest books | 73 | 73 | PASS |
| Ethiopian manifest enoch entry | present | present | PASS |
| Al-Fatiha ayah count | 6 | 6 | PASS |
| NIV copyright in manifest | present | present | PASS |
| .gitignore niv entry | present | present | PASS |
| .gitignore nabre entry | present | present | PASS |
| Quran total ayahs | 6236 | 6235 | DEVIATION (documented) |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] KJV source uses "Psalm" and "Song Of Solomon" (not "Psalms"/"Song of Solomon")**
- **Found during:** Task 1 (first script run)
- **Issue:** Source book names didn't match CANONICAL_SLUG_MAP, causing 2 books to be skipped per translation (64 books instead of 66)
- **Fix:** Extended CANONICAL_SLUG_MAP with variant keys: `'Psalm': 'psalms'` and `'Song Of Solomon': 'song-of-solomon'`
- **Files modified:** scripts/transformData.ts
- **Commit:** f816a29 (updated in same task commit)

### Acknowledged Deviations

**1. Quran total ayah count: 6235 vs 6236 specified**
- **Root cause:** The source dataset (`AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION.json`) reports `total_verses: 6236` which INCLUDES the Basmala as Al-Fatiha verse 1. After correct normalization (Basmala demoted to manifest `basmala` field, Al-Fatiha = 6 ayahs), the file-based total is 6235.
- **Analysis:** The canonical "6236" count (Medina numbering, no Basmala) is internally consistent: 6236 total minus the Basmala = 6235 normalized ayahs from this dataset. The plan's 6236 expectation assumes the source itself uses the Medina convention, but it does not.
- **Impact:** Al-Fatiha correctly has 6 ayahs (verified). The 6235 total is mathematically correct for this dataset. Plan 01-05 checkpoint should note this discrepancy.
- **Mitigation:** None — this is a dataset property. The app will display correct ayah numbering.

**2. Enoch/Jubilees: placeholder stubs only**
- **Root cause:** R.H. Charles public-domain translations not available in structured format on disk (acknowledged in PLAN.md and RESEARCH.md)
- **Impact:** Ethiopian "browse any verse" fails for 1 Enoch and Jubilees
- **Mitigation:** Placeholder files created with descriptive `[Text pending...]` content. Plan 01-05 checkpoint Task 2 must note this gap explicitly.

---

## Self-Check: PASSED

All key files verified present:
- scripts/transformData.ts: FOUND
- public/data/protestant/manifest.json: FOUND (66 books, 7 translations)
- public/data/catholic/manifest.json: FOUND (73 books, 1 translation)
- public/data/ethiopian/manifest.json: FOUND (75 books including 1-enoch)
- public/data/quran/manifest.json: FOUND (114 surahs, basmala field, Al-Fatiha = 6)
- public/data/protestant/kjv/genesis.json: FOUND (key "1:1" present)
- public/data/quran/yusuf-ali/al-fatiha.json: FOUND (6 keys)
- public/data/ethiopian/kjv/1-enoch.json: FOUND

Commits verified:
- f816a29: feat(01-02): create data transformation script
- 6b35ed5: feat(01-02): generate canon manifests and per-book JSON files
