# Collaborative reading — todo

Goal: reading with other people should feel like sitting next to them with the same book open. Nothing about it may take the reader off the text. Parked on 2026-09-16 as a list; the no-backend parts (§7, §3 data model, §8 layout, §1, §6) were built the same day. Everything that needs two devices to see each other (§2, §4, §5, the rest of §3) is still open.

## Where things stand (2026-09-16, evening)

- A circle can be created, joined by invite link, renamed, given a chapter, and has device-local reflections (rail card, header pill, verse toolbar "Share", multi-verse refs like Exodus 4:1-10 that jump back to the verses).
- Every highlight and verse note now carries `visibility` (`private` by default) and `author`, and is keyed to the verse (`tradition/slug/chapter`), not to a translation. Old stores are folded into the new shape on first start.
- Notes sit beside the verse in every mode. A second translation can run in small print under every verse. The circle lives in the header.
- Everything is still local. No one sees anyone else's reflections, selection, or position. That is the wall every open item below runs into.

## Testing rule

Every "no, press this, not that" a tester needs is a defect in the UI. Give a tester one task ("read Exodus 4 with a friend and share a verse") and watch without speaking; log every question against the screen they were on. Controls say what will happen ("Set circle to Exodus 4"), the next step appears where the eye already is, empty states teach in place, and nothing important lives only behind an icon, a hover, or a shift-click.

Traps found and fixed on 2026-09-16: the streak was a bare fire icon with a number (now "1-day streak", explained in the profile menu); the display name could only be changed inside the circle drawer (now in the profile menu); "Together" was an icon with a green dot (now a word; the circle pill carries the state); notes only showed in Study mode (now beside the verse everywhere); first-time readers had no idea verses were tappable (a one-line hint under the title, gone after the first tap).

## 1. Controls in the header (not the drawer)

- [x] When you are in a circle, the header shows a compact **circle pill** next to the passage picker: member avatars (initials in a colour that follows the person everywhere), circle name, a dot that is green when you are on the circle's chapter and amber when you have drifted. (The doc originally asked for "green when others are here" — that needs presence, §2.)
- [x] Tapping the pill opens a popover with: members, where the circle is, "Go there" / "Set circle to <this chapter>", the "for the circle" switch, the last three reflections with tappable passage chips, a composer with a detachable passage chip, "Copy invite", "Manage" (drawer). Works on phones, so the rail is no longer required.
- [x] The **"for the circle" switch** ("Move the circle when I change chapter"): on, any chapter change moves the circle's chapter too; off, you wander alone. Lives in the pill popover rather than inside the picker, so it is visible while reading.
- [x] Header shows a one-line banner when you drift from the circle's chapter: "<Circle> is on Exodus 4. You are on Exodus 5. Go there · Bring the circle here".
- [ ] "Follow <leader>" — needs presence (§2).

## 2. Focus and following

- [ ] **Follow mode**: one member is the reader/leader; others' pages scroll to the verse the leader selects. Toggle per person ("Follow Shaun" / "Read on my own").
- [ ] **Shared focus verse**: the leader's current selection shows as a soft outline on everyone's page, distinct from your own highlight colours.
- [ ] Presence dots per verse: small avatars in the margin next to the verse each member is on. (`MemberAvatar` and `memberColor()` in `services/circles.ts` are ready for this.)
- [ ] Hand-off: any member can "Take the lead"; the previous leader sees a toast.

## 3. Shared marks and reflections

**Rule first: everything a person writes or highlights is private by default.** Reading together does not mean everyone reads your margins. Model (now in the code):

- Every highlight and verse note has `visibility: 'private' | 'circle'`, default `private`, plus `author` (the display name at the time) and `at`. Private marks never leave the device (or, once accounts exist, never leave the owner's account). `setMarkVisibility()` flips one mark; nothing in the UI calls it yet because nothing would happen.
- Sharing is a deliberate act on one mark: a "Share with circle" toggle on the note editor and on the highlight toolbar (same place as today's Share button). The mark keeps existing privately; a shared copy goes to the circle with the author's name. Un-sharing removes the copy.
- Visual language: private highlights use the reader's own five colours; circle highlights show as an outline/underline in the member's avatar colour (`memberColor(name).hex`), never filling the verse, so your own colours stay yours. Private notes sit beside the verse in amber; circle notes sit beside the verse in the circle's dark card style with the author's avatar.
- A per-circle "Show others' marks" switch in the header pill, default on, so a person can read clean when they want to.
- Study mode gets a filter row: Mine · Everyone · <each member>.
- Nothing is shared retroactively when you join a circle; nothing you shared is deleted when you leave, but it is no longer attributed to a live member (shows "former member").
- Bulk action later: "Share all my highlights in this chapter with the circle", with a confirm dialog that lists what will be shared.

- [x] Add `visibility` + `author` to the local highlight/note stores now (all `private`), so the data model is ready before sync exists. Marks are keyed to the verse, not the translation, so a highlight survives switching or swapping languages. Chapter-level notes ("what stood out") still live in the older `scriptureComix_notes` store as plain strings and are private by construction; give them the same fields when they move.
- [ ] Reflections sync across members (today they are per device).
- [ ] Shared highlights carry an author and render as outlines in the member's colour; filter per person.
- [ ] Verse-anchored threads: replies under a reflection, all pointing at the same "Exodus 4:1-10".
- [ ] Reactions on reflections are fine; keep it to a couple, no counts race.
- [ ] "Share with circle" toggle on the note editor and highlight toolbar — add together with sync, so the toggle does something the first day it exists.

## 4. Sessions ("we read together on Tuesday")

- [ ] A **session** = circle + chapter + start time. Starting one sends everyone to the chapter and turns follow mode on.
- [ ] End of session: "Mark as read" for everyone who was there, one shared summary card (who was there, what was shared), saved under My study.
- [ ] Reading plan for the circle: the paths feature, but shared — next chapter is the circle's next chapter.

## 5. Plumbing (blocks 2, 3 and 4)

- [ ] Pick a realtime backend: Supabase Realtime (presence + broadcast + Postgres for reflections) is the least code; PartyKit/Liveblocks if we want CRDT-style shared state later.
- [ ] Data: `circles`, `members`, `reflections` (with `ref` pointer), `presence` (member → passage + selection + last seen), `sessions`, and `marks` (the `circle`-visibility copies: chapter key, verse key, kind, colour or text, author).
- [ ] Identity: invite link joins as a lightweight member (display name + device key); real accounts later. The display name is now editable from the profile menu, not only the circle drawer.
- [ ] Offline: keep the local store as the cache; sync when online; never lose a reflection written offline.
- [ ] Privacy: reflections are visible to circle members only; export in the study file stays as-is.

## 6. Small UX items already noticed

- [x] Rail composer shows the attached passage as a removable chip (× to detach; "Attach …" brings it back). Same in the pill popover.
- [x] Reflection chips work from the drawer list (they jump to the verses).
- [x] Mobile: the circle pill in the header carries members, chapter, reflections and the composer, so the rail is not needed.
- [x] Quran: the circle list no longer shows a chapter number for a surah.

## 7. Notes beside the verse, even when reading alone

- [x] Read mode: a verse with a note gets a small amber note mark after it; the note renders as an amber card directly under the line the verse ends on (the paragraph breaks at that verse and resumes after the card).
- [x] Wide screens: notes move into a right-hand margin column aligned to the verse's vertical position (the last line of the verse), pushed down when two would overlap. Switches on when the centre column is at least 820px wide — about a 1440px window with both rails showing — and falls back to the under-the-line card below that. Measured, not breakpoint-based, so it also works when a rail disappears.
- [x] Tap the note card to edit in place; tap the verse and choose "Note" to add one ("Edit note" when one exists). Range notes ("4:1-10") sit under the last verse of the range with the range label. Cmd/Ctrl+Enter saves, Escape cancels.
- [x] Chapter-level notes ("what stood out") show once at the top of the chapter as a card, editable in place. "Write what stood out" at the end of the chapter opens that card, not the drawer.
- [x] My study keeps listing everything; the rail's "My marks" list jumps to the note card itself.
- [x] Comic page: notes appear under the panel that contains the note's last verse; tapping one opens the verse in Read mode.
- [x] All of this is private by default (see §3).

## 8. Zulu Bible, and two languages on one page

Goal: read in the language you chose, in large type, with a second language in small print under each verse.

**Text source (checked again 2026-09-16, evening).** eBible.org's Scriptures index carries no Zulu edition (no `zul*` ids); archive.org's search finds nothing for "Zulu Bible 1893" or ZULB93; biblesa.co.za/zul93 is a reader, not a download. The 1893 text itself is old enough to be out of copyright, but whichever digital edition is found must have its licence confirmed and recorded. Next places to look: the Digital Bible Society's DBL entry for "Zulu (1903)", find.bible's "The Zulu Old Version" record (it names a rights holder), and the Crosswire/SWORD module list.

- [x] Import script `scripts/importZulu1893.ts`: accepts a USFM folder or a tab-separated `book<TAB>chapter<TAB>verse<TAB>text` file; maps USFM codes, English names and isiZulu names (uGenesise, 1 Samuweli, uJohane …) to our slugs; writes `public/data/protestant/zul1893/<slug>.json`; adds `{ id: 'zul1893', displayName: 'IBhayibheli Elingcwele (isiZulu 1893)', language: 'zu', isPublicDomain: true, copyright }` to the manifest (`--copyright "…"` records the edition's licence); warns about missing books and short chapters. Smoke-tested on a four-line sample in an isolated copy; **not run against the real data because there is none yet.**
- [x] `TranslationMeta` has `language` (BCP-47); every existing entry is tagged `en`. The picker groups versions by language once there is more than one, and the reader sets `lang` on the text.
- [x] **Companion translation**: "Also show underneath" in the picker's Version tab; remembered per canon (`scriptureComix_companion_v1`, in the study export). Loaded through `loadChapter(tradition, companionId, slug, chapter, { repair: 'none' })`, aligned by verse number.
- [x] Layout: one block per verse — big primary line, small grey secondary line, badge once on the left. Font size scales both. "Make <it> the big text" swaps the languages; "One language" turns it off. Study mode shows the secondary line inside each verse row. Marks stay put on swap.
- [x] Copy includes both lines with both translation names; Share quotes both.
- [x] Missing verse in the companion: "—".
- [ ] Scenes, context and quizzes stay in English for now; add `language` to the context/quiz request later so a Zulu-first reader can get them in Zulu when we generate them.
- [ ] After Zulu: Xhosa, Sotho, Afrikaans via the same path (source → import script → manifest entry → nothing else to change).

## Order to build the rest

1. Find and licence a Zulu source (§8) — the only remaining item that needs no backend.
2. Backend + synced reflections (§5, §3) — the first time two people actually see each other. Ship the "Share with circle" toggle on marks the same day.
3. Presence + follow mode (§2), then the green "others are here" dot on the pill.
4. Sessions (§4).
