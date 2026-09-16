# ScriptureComix 

**Interactive / Visual Bible Adventures**

This is a personal project I’m building for anyone who — like me — loves the Bible but struggles with traditional text-only reading.  
My aim: make reading, understanding and studying God’s Word easier and more engaging by presenting Scripture in *visual, contextual and interactive format*.  

---

## 🚀 What it does

- Turns Bible chapters into comic-style panels with images + text bubbles  
- Provides AI-powered explainers and contextual notes (summaries, historical/cultural background, deeper meaning)  
- Supports multiple translations, versions, and even “lost books” / alternate canons for user choice  
- Offers a mix of free content and optional premium (paywall) features — while avoiding intrusive ads  
- Allows users to read, study, and interact — regardless of age or background  

---

## 💡 Project status

- **Work in progress** — this is a bootstrapped, personal initiative.  
- All core features are being built and refined; many advanced features still under development.  
- Hosting, AI-model usage, and image generation are currently funded through community support and donations.  

---

## 📂 How to run locally (for developers)

```bash
# Clone the repo
git clone https://github.com/TheC0deJunkie/ScriptureComix.git
cd ScriptureComix

# Install dependencies
npm install

# Start development server (Vite)
npm run dev
```

## 🔐 Accounts and sync (Firebase)

Reading works without an account. Signing in (profile menu → **Sign in**) keeps
streak, points, bookmarks and reader profile in sync across devices.

- **Backend:** Firebase project `scripturecomix` — Authentication + Cloud Firestore.
- **Sign-in methods:** Email/password, Google, Phone (SMS).
- **Code:** `services/firebase.ts` (bootstrap), `services/authService.ts` (sign-in flows),
  `services/userStore.ts` (Firestore reads/writes), `components/AuthProvider.tsx`,
  `components/AuthModal.tsx`.
- **Data layout:** `users/{uid}` (account + reader profile) and `users/{uid}/state/stats`.
  Rules in `firestore.rules` are owner-only with field allow-lists.
- **Config:** copy the `VITE_FIREBASE_*` block from `.env.example` into `.env`.
  Without it the app runs normally and simply hides the sign-in option.

```bash
# One-time project setup (needs `npx -y firebase-tools@latest login` first)
npx -y firebase-tools@latest use scripturecomix
npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID>      # values for .env
npx -y firebase-tools@latest deploy --only auth               # email/password + Google
npx -y firebase-tools@latest deploy --only firestore          # rules + indexes

# Local emulators (set VITE_FIREBASE_USE_EMULATORS=true in .env)
npx -y firebase-tools@latest emulators:start
```

Phone sign-in has to be switched on in the console
(Authentication → Sign-in method → Phone); the CLI cannot enable it.

### Study circles online

Signed-in readers' circles live in Firestore (`services/circleStore.ts`) instead of
on one device:

- **Sessions.** Every circle has an open session. The leader (whoever created it)
  can **end the session**, which locks reflections for everyone, and later **start
  the next one**. Ending a session records a summary and takeaways (optionally
  drafted by AI from what members said).
- **Focus.** Setting the circle's chapter, or the verses you have selected, moves
  everyone and is logged on the session, so History shows every passage read.
- **History, Notes, Packs** tabs on the circle page: past sessions with their
  reflections and takeaways (exportable as Markdown), shared notes, and study packs
  (passages + questions + notes) the circle builds together.
- **Together menu.** The header dropdown lists your circles with Switch / Go back /
  End session / Exit.

Data layout: `circles/{id}` (members, focus, status, current session),
`circles/{id}/sessions/{sid}` (+ `reflections`), `circles/{id}/notes`,
`circles/{id}/packs`, and `codes/{CODE}` for invite lookup. Rules are in
`firestore.rules`; only members can read a circle, only the leader can lock it.

## 🌍 isiZulu

`public/data/protestant/zul1883/` is the 1883 isiZulu Bible (American Bible
Society, public domain), built from the Internet Archive scan's OCR. The scan is
two-column and the plain OCR text merges the columns line by line, so the
pipeline starts from the word-coordinate XML:

1. `scripts/djvuColumns.ts` rebuilds each page one column at a time.
2. `scripts/parseZuluOcr.ts` turns that into `book<TAB>chapter<TAB>verse<TAB>text`,
   dropping page headers, chapter headings and cross-reference lines, and reports
   coverage against the KJV versification.
3. `scripts/importZulu1893.ts` writes the per-book JSON and the manifest entry.

About 86% of verses come through with correct boundaries; the rest are filled
from the KJV and marked, and OCR misreads remain in the text. Pick it under
Version (language chips at the top of the list), choose Zulu as your language
in the profile menu, or show it under another translation with "Also show
underneath".

```bash
curl -L -o zulu_djvu.xml "https://archive.org/download/zulu-bible/Zulu%20Bible_djvu.xml"
npx tsx scripts/djvuColumns.ts zulu_djvu.xml zulu_cols.txt
npx tsx scripts/parseZuluOcr.ts zulu_cols.txt data/sources/zul1883.txt
npx tsx scripts/importZulu1893.ts data/sources/zul1883.txt --id zul1883 --name "IBhayibheli Elingcwele (isiZulu 1883)" --copyright "…"
```

## 🎛️ UI conventions

All controls come from `components/ui/primitives.tsx` — `Button`, `IconButton`, `Segmented`, `Select` (a real listbox with keyboard and type-ahead), `Popover`, `Dialog`, `Drawer`, `TextInput`/`TextArea`/`Field`, and `useToast()` / `useConfirm()` from the `UiProvider`. Rules of the house:

- No native `<select>`, `alert()` or `confirm()`. Use `Select`, toasts and `useConfirm`.
- Every layer closes on Escape and returns focus to where it came from; body scroll locks under modals.
- Navigation lives in one place: the passage picker in the header (`components/PassagePicker.tsx`). Do not add a second book/chapter control.
- Everything a reader marks is visible in **My study** (`components/StudyLibrary.tsx`) and exportable as one JSON file (`services/studyLog.ts`).
- Study circles are shared as invite links (`services/circles.ts`); reflections stay on the device until a backend exists, and the UI says so.

## 📦 How content is generated (generate once, everyone has it)

Readers never trigger AI. Everything is produced ahead of time and shipped under `public/data/`:

- **Scripture text** — per-book JSON, fetched once per device into IndexedDB (`services/scriptureStore.ts`). Missing verses are borrowed from another public-domain translation, or reconstructed once and written back with a ledger in `public/data/_provenance.json`.
- **Quizzes** — `services/quizFactory.ts` builds unlimited variants from the verse text with no AI (offline). AI comprehension quizzes are pre-generated into `public/data/quizzes/`.
- **Study context** — neutral "what happened here" per chapter (`services/neutrality.ts` charter), pre-generated into `public/data/context/`.

Generate ahead of time with:

```bash
npx tsx scripts/pregenerate.ts --tradition protestant --translation kjv --books genesis,exodus --chapters 1-10
npx tsx scripts/pregenerate.ts --tradition ethiopian --books 1-enoch --what verses,quiz,context
```

It is resumable: existing files are skipped. In `npm run dev`, opening a chapter also generates and writes back anything missing (`scripts/scripturePatchPlugin.ts`). Production builds do not call AI unless `VITE_RUNTIME_AI=true`.
