import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Copy, Check, Highlighter, StickyNote, Columns2, X, AlertTriangle,
  Type as TypeIcon, Minus, Plus, Wand2, ArrowRight, Sparkles, Brain, BookOpen, ListTree, Bookmark, Users, TextSelect, ArrowLeftRight, Languages,
} from 'lucide-react';
import { ChapterVerse, Scene, ChapterContext } from '../types';
import {
  HIGHLIGHT_COLORS, HighlightColor, getHighlights, setHighlight, getVerseNotes, setRangeNote,
  getReaderPrefs, setReaderPrefs, ReaderPrefs, hasSeen, markSeen,
} from '../services/highlights';
import { formatVerseRanges, passageRef, firstVerseOfKey, versesOfKey } from '../services/refs';

export type ReaderMode = 'read' | 'study';

/** What the reader currently has selected — one verse or many. */
export interface VerseSelection {
  verses: number[];   // sorted
  key: string;        // "4" or "1-10"
  label: string;      // "Exodus 4:1-10" / "Al-Fatiha, ayahs 1-2"
  text: string;       // the verses' text, numbered when more than one
  /** The same verses in the companion translation, when one is showing. */
  companion?: { name: string; text: string };
}

/** A second translation shown in small print under every verse. */
export interface CompanionText {
  id: string;
  name: string;
  language?: string;   // BCP-47
  verses: ChapterVerse[];
}

interface ScriptureReaderProps {
  mode: ReaderMode;
  chapterKey: string;          // tradition/slug/chapter — highlight + note scope (marks belong to the verse, not the translation)
  label: string;               // "Genesis 1" or "Al-Fatiha"
  translationName: string;
  license: string;
  verses: ChapterVerse[];
  verseLabel: string;          // "Verse" | "Ayah"
  isQuran: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** BCP-47 tag of the main text — sets `lang` for hyphenation and screen readers. */
  language?: string;
  /** Second language under every verse; null/undefined for none. */
  companion?: CompanionText | null;
  /** Make the small language the big one. */
  onSwapCompanion?: () => void;
  onCompanionOff?: () => void;
  /** Marks are recorded under this name, so a shared copy can carry it later. */
  author?: string;
  /** Illustrated scenes for this chapter (pictures woven into the text). */
  scenes?: Scene[];
  illustrating?: boolean;
  onIllustrate?: () => void;
  /** One-paragraph neutral summary, shown as a teaser above the text. */
  contextSummary?: string;
  /** Full neutral context — study mode pins its events, cautions and terms to the verses. */
  context?: ChapterContext | null;
  /** Study mode: fetch the same verse in other public-domain translations. */
  compareTranslations?: (verse: number) => Promise<{ name: string; text: string }[]>;
  /** Side-rail actions */
  onQuiz?: () => void;
  onModeChange?: (mode: ReaderMode) => void;
  chapterCount?: number;
  currentChapter?: number;
  /** App-provided cards for the right rail (study circle, journey…). */
  extraRail?: React.ReactNode;
  /** Select and scroll to these verses once (e.g. opened from My study or a circle reflection). */
  focusVerses?: number[] | null;
  onFocusVersesHandled?: () => void;
  /** "I have read this chapter" — shown at the end of the chapter. */
  completed?: boolean;
  onComplete?: () => void;
  /** Where "Keep reading" goes, e.g. "Al-Baqarah" or "Exodus 4". */
  nextLabel?: string;
  /** Open the chapter notes drawer (fallback when in-place chapter notes are not wired). */
  onReflect?: () => void;
  /** The chapter-level note ("what stood out"), shown once at the top as a card and edited in place. */
  chapterNote?: string;
  onSaveChapterNote?: (text: string) => void;
  /** Share the selected verses with the reader's study circle without leaving the page. */
  circleName?: string;
  onShareSelection?: (sel: VerseSelection) => void;
  /** Lets the app mirror the selection (e.g. attach it to a circle reflection). */
  onSelectionChange?: (sel: VerseSelection | null) => void;
}

const colorClass = (c?: HighlightColor) => HIGHLIGHT_COLORS.find(h => h.id === c)?.className ?? '';

/** The last verse a note key ("4" or "1-10") covers; NaN if none. The note card sits under this verse. */
const lastVerseOfKey = (key: string): number => { const vs = versesOfKey(key); return vs[vs.length - 1] ?? NaN; };
const isRangeKey = (key: string) => key.includes('-') || key.includes(',');

/** The centre column must be at least this wide before notes move into a margin beside the text. */
const MARGIN_MIN_WIDTH = 820;
const MARGIN_COL = 208;

interface Block {
  scene: Scene | null;
  verses: ChapterVerse[];
}

/** Group verses under their scene (or one block when there is no plan). */
const groupByScene = (verses: ChapterVerse[], scenes: Scene[]): Block[] => {
  if (!scenes.length) return [{ scene: null, verses }];
  const blocks: Block[] = [];
  const covered = new Set<number>();
  for (const s of scenes) {
    const vs = verses.filter(v => v.verse >= s.from && v.verse <= s.to);
    vs.forEach(v => covered.add(v.verse));
    if (vs.length) blocks.push({ scene: s, verses: vs });
  }
  const rest = verses.filter(v => !covered.has(v.verse));
  if (rest.length) blocks.push({ scene: null, verses: rest });
  return blocks;
};

/** "vv. 3–5", "v. 3", "verses 3-5", "ayahs 2–4", "1:3-5" → [3, 5]; null if no number. */
export const parseRefRange = (ref: string): [number, number] | null => {
  const tail = ref.includes(':') ? ref.split(':').pop()! : ref;
  const m = tail.match(/(\d+)(?:\s*[-–—]\s*(\d+))?/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return [Math.min(a, b), Math.max(a, b)];
};

const overlaps = (a: [number, number], b: [number, number]) => a[0] <= b[1] && b[0] <= a[1];

/**
 * The end of a chapter always answers "now what?": mark it read, say what
 * stood out, test yourself, and keep going — into the next chapter, the next
 * book, or the next surah. Shared by the reader and the comic page.
 */
export const ChapterEnd: React.FC<{
  label: string;
  completed?: boolean;
  onComplete?: () => void;
  onQuiz?: () => void;
  onReflect?: () => void;
  canNext?: boolean;
  onNext?: () => void;
  nextLabel?: string;
  className?: string;
}> = ({ label, completed = false, onComplete, onQuiz, onReflect, canNext, onNext, nextLabel, className }) => (
  <div className={`mt-10 pt-6 border-t-2 border-dashed border-amber-300 print:hidden ${className ?? ''}`} style={{ fontFamily: 'inherit' }}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-widest font-bold text-slate-500">End of {label}</p>
        <p className="comic-font text-3xl leading-none mt-1">{completed ? 'Well read.' : 'Finished?'}</p>
      </div>
      {onComplete && (
        <button
          onClick={onComplete}
          disabled={completed}
          aria-pressed={completed}
          title={completed ? 'You marked this chapter as read' : 'Count this chapter as read'}
          className={`inline-flex items-center gap-2 font-black uppercase tracking-wider px-4 py-3 rounded-full border-4 border-black ${completed ? 'bg-green-400 text-black' : 'bg-white hover:bg-green-50 shadow-[3px_3px_0_0_#000] active:translate-y-[2px] active:shadow-none'}`}
        >
          <Check size={18} /> {completed ? 'Read' : 'Mark as read'}
        </button>
      )}
    </div>
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
      {onReflect && (
        <button onClick={onReflect} className="text-left rounded-2xl border-[3px] border-black bg-amber-100 hover:bg-amber-200 p-4 shadow-[3px_3px_0_0_#000] active:translate-y-[2px] active:shadow-none">
          <StickyNote size={20} className="text-amber-800" />
          <p className="font-black mt-2 leading-tight">Write what stood out</p>
          <p className="text-xs text-slate-600 mt-0.5">One line is enough. It stays at the top of this chapter and under My study.</p>
        </button>
      )}
      {onQuiz && (
        <button onClick={onQuiz} className="text-left rounded-2xl border-[3px] border-black bg-purple-600 text-white hover:bg-purple-500 p-4 shadow-[3px_3px_0_0_#000] active:translate-y-[2px] active:shadow-none">
          <Brain size={20} />
          <p className="font-black mt-2 leading-tight">Test yourself</p>
          <p className="text-xs text-purple-100 mt-0.5">A few questions drawn from these verses.</p>
        </button>
      )}
      {canNext && onNext ? (
        <button onClick={onNext} className="text-left rounded-2xl border-[3px] border-black bg-black text-yellow-300 hover:bg-slate-800 p-4 shadow-[3px_3px_0_0_#000] active:translate-y-[2px] active:shadow-none">
          <ArrowRight size={20} />
          <p className="font-black mt-2 leading-tight">Keep reading</p>
          <p className="text-xs text-yellow-100 mt-0.5">{nextLabel ? `Next: ${nextLabel}` : 'Next chapter'}</p>
        </button>
      ) : (
        <div className="rounded-2xl border-[3px] border-dashed border-slate-300 p-4 text-slate-500">
          <BookOpen size={20} />
          <p className="font-black mt-2 leading-tight">That was the last one</p>
          <p className="text-xs mt-0.5">Pick another book from the top.</p>
        </div>
      )}
    </div>
  </div>
);

const Rail: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white border-[3px] border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 mb-2">{icon} {title}</p>
    {children}
  </div>
);

/**
 * The reading page — an illustrated edition with rails on either side:
 * left = where am I (chapter, scenes, text size), right = what can I do
 * (quiz, illustrate, my highlights and notes). Study mode goes verse by
 * verse with notes and side-by-side translations. Any number of verses can
 * be selected at once (tap to toggle, shift+tap or "Select range" to sweep),
 * and highlight / copy / note / share act on the whole selection.
 *
 * Notes sit beside the verse they belong to: in flowing text the paragraph
 * breaks under the verse and resumes after the card; on a wide screen the
 * cards move into a margin column aligned with the verse, like a printed
 * study Bible. A second translation, when chosen, runs in small print under
 * every verse.
 */
export const ScriptureReader: React.FC<ScriptureReaderProps> = ({
  mode, chapterKey, label, translationName, license, verses, verseLabel, isQuran,
  canPrev, canNext, onPrev, onNext, language = 'en', companion = null, onSwapCompanion, onCompanionOff, author,
  scenes = [], illustrating = false, onIllustrate, contextSummary, context = null, compareTranslations,
  onQuiz, onModeChange, chapterCount = 1, currentChapter = 1, extraRail, focusVerses = null, onFocusVersesHandled, completed = false, onComplete, nextLabel, onReflect,
  chapterNote = '', onSaveChapterNote, circleName, onShareSelection, onSelectionChange,
}) => {
  // Context pinned to verses (study mode)
  const events = useMemo(() => (context?.events ?? []).map(e => ({ ...e, range: parseRefRange(e.ref) })), [context]);
  const cautions = useMemo(() => (context?.oftenQuoted ?? []).map(q => ({ ...q, range: parseRefRange(q.ref) })), [context]);
  const eventsFor = (from: number, to: number) => events.filter(e => e.range && overlaps(e.range, [from, to]));
  const cautionsFor = (verse: number) => cautions.filter(q => q.range && q.range[0] === verse);
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => getReaderPrefs());
  const [highlights, setHighlights] = useState<Record<string, HighlightColor>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Selection: a sorted set of verse numbers, the last tapped verse (range anchor), and whether the next tap sweeps a range
  const [selected, setSelected] = useState<number[]>([]);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [rangeMode, setRangeMode] = useState(false);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);   // note key: "4" or "1-10"
  const [noteDraft, setNoteDraft] = useState('');
  const [chapterNoteOpen, setChapterNoteOpen] = useState(false);
  const [chapterDraft, setChapterDraft] = useState('');
  const [compareOpen, setCompareOpen] = useState<number | null>(null);
  const [compareRows, setCompareRows] = useState<Record<number, { name: string; text: string }[] | 'loading'>>({});
  const [copied, setCopied] = useState(false);
  const [seenTap, setSeenTap] = useState(() => hasSeen('verseTap'));
  const meta = author ? { author } : undefined;

  const clearSelection = () => { setSelected([]); setAnchor(null); setRangeMode(false); };

  useEffect(() => {
    setHighlights(getHighlights(chapterKey));
    setNotes(getVerseNotes(chapterKey));
    clearSelection();
    setNoteOpen(null);
    setChapterNoteOpen(false);
    setCompareOpen(null);
    setCompareRows({});
  }, [chapterKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Opened from "My study" or a circle reflection: land on those verses once the chapter is on screen
  useEffect(() => {
    if (!focusVerses || !focusVerses.length) return;
    const t = window.setTimeout(() => {
      const present = focusVerses.filter(n => verses.some(v => v.verse === n)).sort((a, b) => a - b);
      setSelected(present);
      setAnchor(present[present.length - 1] ?? null);
      document.getElementById(`v-${present[0] ?? focusVerses[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocusVersesHandled?.();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusVerses, chapterKey, verses.length]);

  const isSelected = (v: number) => selected.includes(v);
  const single = selected.length === 1;

  /** Tap toggles a verse; shift+tap (or Select range, then tap) sweeps from the last tapped verse. */
  const tapVerse = (v: number, e?: React.MouseEvent) => {
    const extend = rangeMode || !!e?.shiftKey;
    if (e?.shiftKey) e.preventDefault();
    setSelected(prev => {
      if (extend && anchor != null && anchor !== v) {
        const [a, b] = anchor < v ? [anchor, v] : [v, anchor];
        const sweep = verses.filter(x => x.verse >= a && x.verse <= b).map(x => x.verse);
        return Array.from(new Set([...prev, ...sweep])).sort((x, y) => x - y);
      }
      return prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v].sort((x, y) => x - y);
    });
    setAnchor(v);
    setRangeMode(false);
    if (!seenTap) { markSeen('verseTap'); setSeenTap(true); }
  };

  const companionByVerse = useMemo(() => {
    const m: Record<number, string> = {};
    for (const v of companion?.verses ?? []) m[v.verse] = v.text.trim();
    return m;
  }, [companion]);

  const selection: VerseSelection | null = useMemo(() => {
    if (!selected.length) return null;
    const rows = verses.filter(v => selected.includes(v.verse));
    const text = rows.length === 1 ? rows[0].text.trim() : rows.map(v => `${v.verse} ${v.text.trim()}`).join(' ');
    const sel: VerseSelection = { verses: selected, key: formatVerseRanges(selected), label: passageRef(label, selected, isQuran), text };
    if (companion) {
      const other = rows.map(v => companionByVerse[v.verse] ?? '').filter(Boolean);
      if (other.length) sel.companion = { name: companion.name, text: rows.length === 1 ? other[0] : rows.map(v => `${v.verse} ${companionByVerse[v.verse] ?? '—'}`).join(' ') };
    }
    return sel;
  }, [selected, verses, label, isQuran, companion, companionByVerse]);

  useEffect(() => { onSelectionChange?.(selection); }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePrefs = (next: Partial<ReaderPrefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    setReaderPrefs(merged);
  };

  /** Highlight (or clear) every selected verse. */
  const applyHighlight = (color: HighlightColor | null, only?: number) => {
    const targets = only != null ? [only] : selected;
    let map = highlights;
    for (const v of targets) map = setHighlight(chapterKey, v, color, meta);
    setHighlights(map);
  };
  const selectionColor = selection ? (selection.verses.every(v => highlights[String(v)] === highlights[String(selection.verses[0])]) ? highlights[String(selection.verses[0])] : undefined) : undefined;

  const copySelection = async () => {
    if (!selection) return;
    const text = selection.companion
      ? `"${selection.text}" — ${selection.label} (${translationName})\n"${selection.companion.text}" — ${selection.label} (${selection.companion.name})`
      : `"${selection.text}" — ${selection.label} (${translationName})`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  const openNote = (key: string) => {
    setNoteOpen(key);
    setNoteDraft(notes[key] || '');
    // Bring the editor (which appears under the last verse of the range) into view
    window.setTimeout(() => document.getElementById(`note-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };
  const saveNote = (key: string) => {
    setNotes(setRangeNote(chapterKey, key, noteDraft, meta));
    setNoteOpen(null);
  };
  const deleteNote = (key: string) => {
    setNoteDraft('');
    setNotes(setRangeNote(chapterKey, key, '', meta));
    setNoteOpen(null);
  };

  const openChapterNote = () => {
    setChapterDraft(chapterNote);
    setChapterNoteOpen(true);
    window.setTimeout(() => document.getElementById('chapter-note')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };
  const reflect = onSaveChapterNote ? openChapterNote : onReflect;

  const toggleCompare = async (verse: number) => {
    if (compareOpen === verse) { setCompareOpen(null); return; }
    setCompareOpen(verse);
    if (!compareRows[verse] && compareTranslations) {
      setCompareRows(r => ({ ...r, [verse]: 'loading' }));
      try {
        const rows = await compareTranslations(verse);
        setCompareRows(r => ({ ...r, [verse]: rows }));
      } catch {
        setCompareRows(r => ({ ...r, [verse]: [] }));
      }
    }
  };

  const jumpToVerses = (vs: number[]) => {
    setSelected(vs);
    setAnchor(vs[vs.length - 1] ?? null);
    document.getElementById(`v-${vs[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  /** Select a note's verses and bring the note card itself into view. */
  const jumpToNote = (key: string) => {
    const vs = versesOfKey(key);
    setSelected(vs);
    setAnchor(vs[vs.length - 1] ?? null);
    (document.getElementById(`note-${key}`) ?? document.getElementById(`v-${vs[0]}`))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const fontStyle = useMemo(
    () => ({ fontSize: `${(mode === 'read' ? 1.18 : 1.02) * prefs.fontScale}rem`, lineHeight: 1.9 }),
    [prefs.fontScale, mode]
  );
  const fontFamily = prefs.serif ? 'Georgia, "Times New Roman", serif' : 'inherit';
  const blocks = useMemo(() => groupByScene(verses, scenes), [verses, scenes]);
  const hero = scenes.find(s => s.image);
  const pictures = scenes.filter(s => s.image).length;
  const highlightedVerses = Object.keys(highlights).map(Number).sort((a, b) => a - b);
  // Notes keyed by the last verse they cover ("4" sits under verse 4; "1-10" sits under verse 10, labelled with the range)
  const notesByLast = useMemo(() => {
    const m: Record<number, { key: string; text: string }[]> = {};
    for (const [key, text] of Object.entries(notes) as [string, string][]) {
      const last = lastVerseOfKey(key);
      if (!Number.isFinite(last)) continue;
      (m[last] ||= []).push({ key, text });
    }
    return m;
  }, [notes]);
  const noteKeys = Object.keys(notes).sort((a, b) => firstVerseOfKey(a) - firstVerseOfKey(b));
  const openEndsAt = noteOpen ? lastVerseOfKey(noteOpen) : NaN;
  const openInChapter = Number.isFinite(openEndsAt) && verses.some(v => v.verse === openEndsAt);
  /** Every note key whose card appears under `verse`, the one being written included. */
  const noteKeysEndingAt = (verse: number): string[] => {
    const keys = (notesByLast[verse] ?? []).map(n => n.key);
    if (noteOpen && openEndsAt === verse && !keys.includes(noteOpen)) keys.push(noteOpen);
    return keys;
  };
  const hasMarks = highlightedVerses.length > 0 || noteKeys.length > 0 || !!chapterNote;

  /* ---- Wide screens: notes in a margin column aligned with their verse ---- */
  const centreRef = useRef<HTMLDivElement>(null);
  const notesColRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [marginMode, setMarginMode] = useState(false);
  const [marginLayout, setMarginLayout] = useState<{ tops: Record<string, number>; height: number }>({ tops: {}, height: 0 });
  const marginKeys = useMemo(() => {
    const keys = Object.keys(notes).filter(k => verses.some(v => v.verse === lastVerseOfKey(k)));
    if (noteOpen && openInChapter && !keys.includes(noteOpen)) keys.push(noteOpen);
    return keys.sort((a, b) => lastVerseOfKey(a) - lastVerseOfKey(b));
  }, [notes, noteOpen, openInChapter, verses]);

  useLayoutEffect(() => {
    const el = centreRef.current;
    if (!el || mode !== 'read' || typeof ResizeObserver === 'undefined') { setMarginMode(false); return; }
    const check = () => setMarginMode(el.getBoundingClientRect().width >= MARGIN_MIN_WIDTH);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  useLayoutEffect(() => {
    if (!marginMode) return;
    const col = notesColRef.current;
    if (!col || typeof ResizeObserver === 'undefined') return;
    const compute = () => {
      const base = col.getBoundingClientRect().top;
      const wanted = marginKeys
        .map(k => {
          const el = document.getElementById(`v-${lastVerseOfKey(k)}`);
          if (!el) return null;
          const rects = el.getClientRects();
          const last = rects.length ? rects[rects.length - 1] : el.getBoundingClientRect();
          return { k, top: Math.max(0, last.top - base) };
        })
        .filter((x): x is { k: string; top: number } => !!x)
        .sort((a, b) => a.top - b.top);
      let cursor = 0;
      const tops: Record<string, number> = {};
      for (const w of wanted) {
        const top = Math.max(w.top, cursor);
        tops[w.k] = top;
        cursor = top + (cardRefs.current[w.k]?.offsetHeight ?? 0) + 10;
      }
      setMarginLayout(prev => {
        const same = prev.height === cursor && Object.keys(prev.tops).length === Object.keys(tops).length && Object.entries(tops).every(([k, v]) => prev.tops[k] === v);
        return same ? prev : { tops, height: cursor };
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    const text = centreRef.current?.querySelector<HTMLElement>('[data-reader-text]');
    if (text) ro.observe(text);
    for (const k of marginKeys) { const c = cardRefs.current[k]; if (c) ro.observe(c); }
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marginMode, marginKeys.join('|'), noteOpen, noteDraft, verses, scenes, prefs.fontScale, prefs.serif, companion?.id, chapterNoteOpen, chapterNote, contextSummary]);

  const ProvenanceBadge: React.FC<{ v: ChapterVerse }> = ({ v }) =>
    v.source && v.source !== 'bundled' ? (
      <span
        className={`inline-flex items-center gap-0.5 align-super text-[10px] font-bold px-1 rounded border ${v.source === 'reconstructed' ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-blue-100 border-blue-300 text-blue-900'}`}
        title={v.source === 'reconstructed' ? 'Reproduced by AI — not from a printed edition. Verify before quoting.' : 'Filled from another public-domain translation.'}
      >
        <AlertTriangle size={9} /> {v.source === 'reconstructed' ? 'AI' : 'borrowed'}
      </span>
    ) : null;

  const Badge: React.FC<{ n: number }> = ({ n }) => (
    <span
      className="inline-flex items-center justify-center rounded-full bg-black text-yellow-300 font-black align-middle mr-1 select-none border border-yellow-300"
      style={{ width: '1.55em', height: '1.55em', fontSize: '0.55em', fontFamily: 'inherit', transform: 'translateY(-0.15em)' }}
      aria-label={`${verseLabel.toLowerCase()} ${n}`}
    >
      {n}
    </span>
  );

  /** Small amber mark after a verse that has a note — the note itself is right below (or in the margin). */
  const NoteMark: React.FC<{ verse: number }> = ({ verse }) => {
    const keys = noteKeysEndingAt(verse).filter(k => notes[k]);
    if (!keys.length) return null;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (marginMode) jumpToNote(keys[0]); else openNote(keys[0]); }}
        className="inline-flex items-center justify-center align-middle mx-0.5 rounded-full bg-amber-300 text-amber-900 border border-amber-500 hover:bg-amber-200"
        style={{ width: '1.3em', height: '1.3em', fontSize: '0.6em', transform: 'translateY(-0.2em)' }}
        title={keys.length > 1 ? `${keys.length} notes here` : `Your note on ${verseLabel.toLowerCase()}${isRangeKey(keys[0]) ? 's' : ''} ${keys[0]}`}
        aria-label={`Note on ${verseLabel.toLowerCase()} ${keys[0]}`}
      >
        <StickyNote size={11} />
      </button>
    );
  };

  const VerseSpan: React.FC<{ v: ChapterVerse; dropCap: boolean }> = ({ v, dropCap }) => {
    const hl = highlights[String(v.verse)];
    const isSel = isSelected(v.verse);
    const text = v.text.trim();
    return (
      <span
        id={`v-${v.verse}`}
        lang={language}
        onClick={(e) => tapVerse(v.verse, e)}
        aria-selected={isSel}
        className={`cursor-pointer rounded px-0.5 transition-colors box-decoration-clone ${colorClass(hl)} ${isSel ? 'ring-2 ring-purple-500 bg-purple-50/60' : 'hover:bg-black/5'}`}
      >
        <Badge n={v.verse} />
        {dropCap ? (
          <>
            <span className="float-left font-black text-amber-800 mr-2 mt-1" style={{ fontSize: '3.4em', lineHeight: 0.78, fontFamily: 'Georgia, serif' }}>{text.charAt(0)}</span>
            {text.slice(1)}
          </>
        ) : text}
        <ProvenanceBadge v={v} /><NoteMark verse={v.verse} />{' '}
      </span>
    );
  };

  /** Two languages: one block per verse — big primary line, small grey secondary line, one badge on the left. */
  const VerseBlock: React.FC<{ v: ChapterVerse }> = ({ v }) => {
    const hl = highlights[String(v.verse)];
    const isSel = isSelected(v.verse);
    const other = companionByVerse[v.verse];
    return (
      <div
        id={`v-${v.verse}`}
        onClick={(e) => tapVerse(v.verse, e)}
        aria-selected={isSel}
        className={`cursor-pointer rounded-lg px-2 py-1.5 -mx-2 transition-colors flex gap-3 ${colorClass(hl)} ${isSel ? 'ring-2 ring-purple-500 bg-purple-50/60' : 'hover:bg-black/5'}`}
      >
        <span className="shrink-0 pt-[0.35em]"><Badge n={v.verse} /></span>
        <div className="min-w-0 flex-1">
          <p lang={language} style={fontStyle}>{v.text.trim()} <ProvenanceBadge v={v} /><NoteMark verse={v.verse} /></p>
          <p lang={companion?.language} className="text-slate-500" style={{ fontSize: `${0.62 * prefs.fontScale}rem`, lineHeight: 1.6 }} title={companion?.name}>
            {other || <span className="text-slate-400" title={`Not in ${companion?.name}`}>—</span>}
          </p>
        </div>
      </div>
    );
  };

  const IllustrateCta = () =>
    onIllustrate && !pictures ? (
      <div className="my-6 flex flex-col items-center gap-2 text-center print:hidden">
        <button
          onClick={onIllustrate}
          disabled={illustrating}
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-wider px-5 py-3 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50"
        >
          <Wand2 size={18} /> {illustrating ? 'Drawing the scenes…' : 'Illustrate this chapter'}
        </button>
        <p className="text-xs text-slate-500 max-w-sm">One picture per scene, drawn once and kept for everyone who reads this chapter after you.</p>
      </div>
    ) : null;

  const FontControls = () => (
    <div className="flex items-center gap-1 text-sm font-bold">
      <span className="flex items-center gap-1 border-2 border-black rounded bg-white px-1">
        <button onClick={() => updatePrefs({ fontScale: Math.max(0.85, +(prefs.fontScale - 0.1).toFixed(2)) })} className="p-1 hover:bg-gray-100" title="Smaller text"><Minus size={14} /></button>
        <TypeIcon size={16} />
        <button onClick={() => updatePrefs({ fontScale: Math.min(1.6, +(prefs.fontScale + 0.1).toFixed(2)) })} className="p-1 hover:bg-gray-100" title="Larger text"><Plus size={14} /></button>
      </span>
      <button
        onClick={() => updatePrefs({ serif: !prefs.serif })}
        className={`px-2 py-1 border-2 border-black rounded ${prefs.serif ? 'bg-yellow-200' : 'bg-white'}`}
        title="Toggle serif typeface"
      >
        {prefs.serif ? 'Serif' : 'Sans'}
      </button>
    </div>
  );

  /** "Also showing isiZulu underneath · Swap · Hide" — where the two-language view is controlled. */
  const CompanionControls: React.FC<{ compact?: boolean }> = ({ compact }) =>
    companion ? (
      <div className={`flex flex-wrap items-center gap-1.5 ${compact ? '' : 'text-xs'}`} style={{ fontFamily: 'inherit' }}>
        {!compact && <span className="inline-flex items-center gap-1 text-slate-600 font-bold"><Languages size={13} /> {companion.name} underneath</span>}
        {onSwapCompanion && (
          <button onClick={onSwapCompanion} className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-full border-2 border-black bg-white hover:bg-yellow-100" title={`Read ${companion.name} large, with ${translationName} underneath`}>
            <ArrowLeftRight size={12} /> Make {companion.name.length > 18 ? 'it' : companion.name} the big text
          </button>
        )}
        {onCompanionOff && (
          <button onClick={onCompanionOff} className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-full border-2 border-black bg-white hover:bg-slate-100" title="Show one language only">
            <X size={12} /> One language
          </button>
        )}
      </div>
    ) : null;

  const sceneRange = (s: Scene) => (s.from === s.to ? `${verseLabel} ${s.from}` : `${verseLabel}s ${s.from}–${s.to}`);

  const noteTitle = (key: string) => `${verseLabel}${isRangeKey(key) ? 's' : ''} ${key}`;

  const renderNoteEditor = (noteKey: string, compact?: boolean) => (
    <div id={`note-${noteKey}`} className="bg-white border-[3px] border-amber-400 rounded-xl p-2.5 shadow-[3px_3px_0_0_#f59e0b]" style={{ fontFamily: 'inherit' }}>
      <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-1">{notes[noteKey] ? 'Edit your note' : 'New note'} · {noteTitle(noteKey)}</p>
      <textarea
        value={noteDraft}
        onChange={e => setNoteDraft(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveNote(noteKey); if (e.key === 'Escape') setNoteOpen(null); }}
        placeholder="What do you want to remember here?"
        className={`w-full p-2 border-2 border-black rounded text-sm ${compact ? 'min-h-[80px]' : 'min-h-[70px]'}`}
        autoFocus
      />
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <button onClick={() => saveNote(noteKey)} disabled={!noteDraft.trim() && !notes[noteKey]} className="px-3 py-1 bg-yellow-300 border-2 border-black rounded text-xs font-bold disabled:opacity-40">Save</button>
        <button onClick={() => setNoteOpen(null)} className="px-3 py-1 bg-white border-2 border-black rounded text-xs font-bold">Cancel</button>
        {notes[noteKey] && <button onClick={() => deleteNote(noteKey)} className="ml-auto px-2 py-1 text-xs font-bold text-red-700 hover:underline">Delete</button>}
      </div>
    </div>
  );

  /** A saved note, beside its verse. Tap to edit in place. */
  const renderNoteCard = (noteKey: string, text: string, compact?: boolean) => (
    <button
      id={`note-${noteKey}`}
      type="button"
      onClick={(e) => { e.stopPropagation(); openNote(noteKey); }}
      className={`block w-full text-left bg-amber-50 border-l-4 border-amber-400 rounded-r-lg hover:bg-amber-100 ${compact ? 'px-2.5 py-2 text-xs leading-snug' : 'px-3 py-2 text-sm'}`}
      style={{ fontFamily: 'inherit' }}
      title="Tap to edit"
    >
      <span className="block text-[10px] font-black uppercase tracking-widest text-amber-800 mb-0.5"><StickyNote size={10} className="inline -mt-0.5 mr-1" />{isRangeKey(noteKey) ? `Your note on ${noteTitle(noteKey).toLowerCase()}` : 'Your note'}</span>
      <span className="text-slate-800 whitespace-pre-wrap">{text}</span>
    </button>
  );

  /** The cards (and editor) that belong under `verse`, or null when there are none. Inline only; the margin renders its own. */
  const cardsUnder = (verse: number): React.ReactNode => {
    if (marginMode) return null;
    const keys = noteKeysEndingAt(verse);
    if (!keys.length) return null;
    return (
      <div className="my-3 space-y-2 print:break-inside-avoid" style={{ fontFamily: 'inherit' }}>
        {keys.map(k => <React.Fragment key={k}>{noteOpen === k ? renderNoteEditor(k) : notes[k] ? renderNoteCard(k, notes[k]) : null}</React.Fragment>)}
      </div>
    );
  };

  /** Chapter-level note: once at the top, edited in place. */
  const renderChapterNote = () => {
    if (!onSaveChapterNote) return null;
    if (chapterNoteOpen) {
      return (
        <div id="chapter-note" className="mb-6 bg-white border-[3px] border-amber-400 rounded-xl p-3 shadow-[3px_3px_0_0_#f59e0b] print:hidden" style={{ fontFamily: 'inherit' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-1">What stood out in {label}?</p>
          <textarea
            value={chapterDraft}
            onChange={e => setChapterDraft(e.target.value)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { onSaveChapterNote(chapterDraft); setChapterNoteOpen(false); } if (e.key === 'Escape') setChapterNoteOpen(false); }}
            placeholder="One line is enough."
            className="w-full p-2 border-2 border-black rounded text-sm min-h-[80px]"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <button onClick={() => { onSaveChapterNote(chapterDraft); setChapterNoteOpen(false); }} className="px-3 py-1 bg-yellow-300 border-2 border-black rounded text-xs font-bold">Save</button>
            <button onClick={() => setChapterNoteOpen(false)} className="px-3 py-1 bg-white border-2 border-black rounded text-xs font-bold">Cancel</button>
            {chapterNote && <button onClick={() => { onSaveChapterNote(''); setChapterNoteOpen(false); }} className="ml-auto px-2 py-1 text-xs font-bold text-red-700 hover:underline">Delete</button>}
          </div>
        </div>
      );
    }
    if (!chapterNote) return null;
    return (
      <button id="chapter-note" type="button" onClick={openChapterNote} className="mb-6 w-full text-left bg-amber-50 border-[3px] border-amber-300 rounded-xl px-4 py-3 hover:bg-amber-100" style={{ fontFamily: 'inherit' }} title="Tap to edit">
        <span className="block text-[10px] font-black uppercase tracking-widest text-amber-800 mb-0.5"><StickyNote size={10} className="inline -mt-0.5 mr-1" />What stood out to you</span>
        <span className="text-sm text-slate-800 whitespace-pre-wrap">{chapterNote}</span>
      </button>
    );
  };

  /**
   * Read mode, one scene block: flowing text that breaks under any verse
   * with a note so the card sits beside it, then resumes. With a second
   * language on, every verse is its own block and the card follows it.
   */
  const renderReadBlock = (b: Block, bi: number) => {
    if (companion) {
      return (
        <div className="space-y-1">
          {b.verses.map(v => (
            <React.Fragment key={v.verse}>
              <VerseBlock v={v} />
              {cardsUnder(v.verse)}
            </React.Fragment>
          ))}
        </div>
      );
    }
    const runs: { verses: ChapterVerse[]; cards: React.ReactNode }[] = [];
    let cur: ChapterVerse[] = [];
    for (const v of b.verses) {
      cur.push(v);
      const cards = cardsUnder(v.verse);
      if (cards) { runs.push({ verses: cur, cards }); cur = []; }
    }
    if (cur.length) runs.push({ verses: cur, cards: null });
    return runs.map((r, ri) => (
      <React.Fragment key={ri}>
        <p className="text-justify" style={fontStyle}>
          {r.verses.map((v, vi) => <VerseSpan key={v.verse} v={v} dropCap={bi === 0 && ri === 0 && vi === 0} />)}
        </p>
        {r.cards}
      </React.Fragment>
    ));
  };

  const textBody = (
    <>
      {contextSummary && mode === 'read' && (
        <p className="mb-6 text-sm md:text-base text-slate-700 italic border-l-4 border-amber-400 pl-4">{contextSummary}</p>
      )}
      {renderChapterNote()}
      {!seenTap && !hasMarks && (
        <p className="mb-5 text-xs md:text-sm text-slate-600 bg-white/70 border-2 border-dashed border-slate-300 rounded-lg px-3 py-2 print:hidden" style={{ fontFamily: 'inherit' }}>
          Tap any {verseLabel.toLowerCase()} to highlight it, write a note beside it, or {circleName ? `share it with ${circleName}` : 'share it'}. Tap a second one to select a passage.
        </p>
      )}
      <IllustrateCta />

      {mode === 'read' ? (
        blocks.map((b, bi) => (
          <section key={b.scene?.id ?? `rest-${bi}`} id={b.scene ? `scene-${b.scene.id}` : undefined} className={bi > 0 ? 'mt-8 scroll-mt-28' : 'scroll-mt-28'}>
            {b.scene && (
              <figure className="mb-4 -mx-2 md:-mx-6">
                {b.scene.image && bi > 0 && (
                  <img src={b.scene.image} alt={b.scene.title} className="w-full h-auto rounded-xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" loading="lazy" />
                )}
                <figcaption className={`${b.scene.image && bi > 0 ? 'mt-3' : ''} flex items-baseline gap-3 px-2 md:px-6`}>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-black text-yellow-300 px-2 py-0.5 rounded" style={{ fontFamily: 'inherit' }}>
                    {sceneRange(b.scene)}
                  </span>
                  <span className="comic-font text-2xl md:text-3xl">{b.scene.title}</span>
                </figcaption>
              </figure>
            )}
            {renderReadBlock(b, bi)}
          </section>
        ))
      ) : (
        <ol className="space-y-3" style={fontStyle}>
          {blocks.map((b, bi) => (
            <React.Fragment key={b.scene?.id ?? `rest-${bi}`}>
              {b.scene && (
                <li id={`scene-${b.scene.id}`} className="list-none pt-6 first:pt-0 scroll-mt-28">
                  <div className="flex items-center gap-3">
                    {b.scene.image && <img src={b.scene.image} alt="" className="w-20 h-20 object-cover rounded-lg border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" loading="lazy" />}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500" style={{ fontFamily: 'inherit' }}>{sceneRange(b.scene)}</p>
                      <p className="comic-font text-3xl leading-none">{b.scene.title}</p>
                      <p className="text-sm text-slate-600 mt-1" style={{ fontFamily: 'inherit' }}>{b.scene.caption}</p>
                    </div>
                  </div>
                  {eventsFor(b.scene.from, b.scene.to).length > 0 && (
                    <div className="mt-3 bg-white border-2 border-black rounded-lg p-3 text-sm" style={{ fontFamily: 'inherit' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">What is happening</p>
                      <ol className="space-y-1">
                        {eventsFor(b.scene.from, b.scene.to).map((e, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="shrink-0 font-black text-amber-700">{e.ref}</span>
                            <span>{e.what}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </li>
              )}
              {b.verses.map(v => {
                const hl = highlights[String(v.verse)];
                const isSel = isSelected(v.verse);
                const rows = compareRows[v.verse];
                const other = companionByVerse[v.verse];
                return (
                  <li key={v.verse} id={`v-${v.verse}`} className={`rounded-lg border-2 scroll-mt-28 ${isSel ? 'border-purple-500' : 'border-transparent'} p-2 ${colorClass(hl)}`}>
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => tapVerse(v.verse, e)}
                        aria-pressed={isSel}
                        className={`shrink-0 w-9 h-9 rounded-full border-2 font-black text-sm flex items-center justify-center hover:scale-110 transition-transform ${isSel ? 'bg-purple-600 border-purple-800 text-white' : 'bg-black border-yellow-300 text-yellow-300'}`}
                        title={`${verseLabel} ${v.verse}`}
                      >
                        {v.verse}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p lang={language} onClick={(e) => tapVerse(v.verse, e)} className="cursor-pointer">
                          {v.text.trim()} <ProvenanceBadge v={v} /><NoteMark verse={v.verse} />
                        </p>
                        {companion && (
                          <p lang={companion.language} onClick={(e) => tapVerse(v.verse, e)} className="cursor-pointer text-slate-500 mt-0.5" style={{ fontSize: '0.72em', lineHeight: 1.6 }} title={companion.name}>
                            {other || <span className="text-slate-400">—</span>}
                          </p>
                        )}
                        {cautionsFor(v.verse).map((q, i) => (
                          <div key={i} className="mt-2 text-sm bg-amber-100 border-2 border-amber-400 rounded-lg px-3 py-2" style={{ fontFamily: 'inherit' }}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">Often quoted on its own</p>
                            <p className="text-amber-900">{q.caution}</p>
                          </div>
                        ))}
                        {noteKeysEndingAt(v.verse).length > 0 && (
                          <div className="mt-2 space-y-2" style={{ fontFamily: 'inherit' }}>
                            {noteKeysEndingAt(v.verse).map(k => <React.Fragment key={k}>{noteOpen === k ? renderNoteEditor(k) : notes[k] ? renderNoteCard(k, notes[k]) : null}</React.Fragment>)}
                          </div>
                        )}
                        {compareOpen === v.verse && (
                          <div className="mt-2 text-sm space-y-1 bg-slate-50 border-2 border-slate-200 rounded p-2">
                            {rows === 'loading' || !rows ? (
                              <p className="text-slate-500 animate-pulse">Loading other translations…</p>
                            ) : rows.length === 0 ? (
                              <p className="text-slate-500">No other public-domain translation has this {verseLabel.toLowerCase()} yet.</p>
                            ) : (
                              rows.map(r => (
                                <p key={r.name}><span className="font-bold text-slate-700">{r.name}:</span> {r.text}</p>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </React.Fragment>
          ))}
        </ol>
      )}

      {/* A note whose verse is not on this page (should not happen) still gets an editor */}
      {noteOpen && !openInChapter && (
        <div className="mt-6 print:hidden">{renderNoteEditor(noteOpen)}</div>
      )}

      {/* End of chapter: what now? */}
      <ChapterEnd
        label={label}
        completed={completed}
        onComplete={onComplete}
        onQuiz={onQuiz}
        onReflect={reflect}
        canNext={canNext}
        onNext={onNext}
        nextLabel={nextLabel}
      />
    </>
  );

  return (
    <div className="animate-fade-in lg:grid lg:grid-cols-[220px_minmax(0,1fr)_240px] lg:gap-6 lg:items-start">
      {/* ---- Left rail: where am I ---- */}
      <aside className="hidden lg:block sticky top-28 space-y-3 print:hidden">
        <Rail title="Where you are" icon={<BookOpen size={12} />}>
          <p className="font-black text-sm leading-tight">{label}</p>
          {!isQuran && chapterCount > 1 && (
            <>
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400" style={{ width: `${(currentChapter / chapterCount) * 100}%` }} />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Chapter {currentChapter} of {chapterCount} · {verses.length} {verseLabel.toLowerCase()}s</p>
            </>
          )}
          {(isQuran || chapterCount <= 1) && <p className="text-[11px] text-slate-500 mt-1">{verses.length} {verseLabel.toLowerCase()}s</p>}
          <p className="text-[11px] text-slate-500">{translationName}{companion ? ` + ${companion.name}` : ''}</p>
          {completed && <p className="text-[11px] font-black text-green-700 mt-1 flex items-center gap-1"><Check size={12} /> Read</p>}
        </Rail>
        {scenes.length > 0 && (
          <Rail title="Scenes" icon={<ListTree size={12} />}>
            <ol className="space-y-1">
              {scenes.map((s, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => document.getElementById(`scene-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="w-full text-left flex items-start gap-2 rounded px-1 py-1 hover:bg-yellow-100"
                  >
                    <span className="shrink-0 w-5 h-5 rounded-full bg-black text-yellow-300 text-[10px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold leading-tight">{s.title}</span>
                      <span className="block text-[10px] text-slate-500">{sceneRange(s)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </Rail>
        )}
        <Rail title="Text" icon={<TypeIcon size={12} />}>
          <FontControls />
          {companion && <div className="mt-2"><CompanionControls /></div>}
        </Rail>
      </aside>

      {/* ---- Centre: the page ---- */}
      <div className="min-w-0" ref={centreRef}>
        {/* Mobile toolbar (rails are hidden below lg) */}
        <div className="flex lg:hidden flex-wrap items-center justify-between gap-2 mb-4 print:hidden">
          <div className="flex items-center gap-1">
            <button onClick={onPrev} disabled={!canPrev} className="p-2 border-2 border-black rounded-full bg-white disabled:opacity-40 hover:bg-gray-100" aria-label="Previous chapter"><ChevronLeft size={16} /></button>
            <span className="px-1 font-black text-sm">{label}</span>
            <button onClick={onNext} disabled={!canNext} className="p-2 border-2 border-black rounded-full bg-white disabled:opacity-40 hover:bg-gray-100" aria-label="Next chapter"><ChevronRight size={16} /></button>
          </div>
          <FontControls />
          {companion && <CompanionControls compact />}
        </div>

        <article
          className={`mx-auto border-4 border-black rounded-2xl shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] overflow-hidden ${marginMode ? 'max-w-none' : 'max-w-3xl'}`}
          style={{ fontFamily, background: 'linear-gradient(180deg, #fffdf6 0%, #fbf5e6 100%)' }}
        >
          {hero?.image ? (
            <div className="relative h-56 md:h-80 bg-slate-900">
              <img src={hero.image} alt={hero.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <p className="text-xs uppercase tracking-widest font-bold opacity-80" style={{ fontFamily: 'inherit' }}>{translationName}{companion ? ` + ${companion.name}` : ''}</p>
                <h2 className="comic-font text-5xl md:text-6xl leading-none drop-shadow">{label}</h2>
              </div>
            </div>
          ) : (
            <header className="text-center px-6 pt-10 pb-4">
              <h2 className="comic-font text-5xl md:text-6xl">{label}</h2>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mt-2" style={{ fontFamily: 'inherit' }}>
                {translationName}{companion ? ` + ${companion.name}` : ''}
              </p>
            </header>
          )}

          {marginMode ? (
            <div className="grid" style={{ gridTemplateColumns: `minmax(0,1fr) ${MARGIN_COL}px` }}>
              <div data-reader-text className="px-6 py-6 md:px-10 md:py-8 min-w-0">{textBody}</div>
              <aside
                ref={notesColRef}
                className="relative border-l-2 border-dashed border-amber-300 bg-amber-50/40 print:hidden"
                style={{ minHeight: marginLayout.height + 32 }}
                aria-label="Your notes beside the text"
              >
                {marginKeys.map(k => (
                  <div
                    key={k}
                    ref={el => { cardRefs.current[k] = el; }}
                    className="absolute left-3 right-3 transition-[top] duration-150"
                    style={{ top: marginLayout.tops[k] ?? 0, visibility: k in marginLayout.tops ? 'visible' : 'hidden' }}
                  >
                    {noteOpen === k ? renderNoteEditor(k, true) : notes[k] ? renderNoteCard(k, notes[k], true) : null}
                  </div>
                ))}
                {marginKeys.length === 0 && (
                  <p className="absolute top-8 left-3 right-3 text-[11px] text-slate-500" style={{ fontFamily: 'inherit' }}>Your notes appear here, beside the {verseLabel.toLowerCase()} they belong to.</p>
                )}
              </aside>
            </div>
          ) : (
            <div data-reader-text className="px-6 py-6 md:px-12 md:py-8">{textBody}</div>
          )}
        </article>

        {/* Selection toolbar — appears when one or more verses are selected */}
        {selection && (
          <div className="sticky bottom-3 z-30 mx-auto max-w-3xl mt-4 print:hidden">
            <div className="bg-slate-900 text-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-black text-sm" title={selection.label}>
                {verseLabel}{selection.verses.length > 1 ? 's' : ''} {selection.key}
                {selection.verses.length > 1 && <span className="ml-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-wider">{selection.verses.length} selected</span>}
              </span>
              <button
                onClick={() => setRangeMode(r => !r)}
                aria-pressed={rangeMode}
                title="Then tap another verse to select everything in between (or hold Shift while tapping)"
                className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border-2 border-black ${rangeMode ? 'bg-yellow-300 text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                <TextSelect size={14} /> {rangeMode ? 'Tap the last verse…' : 'Select range'}
              </button>
              <span className="flex items-center gap-1.5" title="Highlight">
                <Highlighter size={16} className="text-slate-300" />
                {HIGHLIGHT_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => applyHighlight(c.id)}
                    className={`w-6 h-6 rounded-full border-2 ${selectionColor === c.id ? 'border-white scale-110' : 'border-black'} ${c.className}`}
                    title={c.label}
                    aria-label={`Highlight ${c.label}`}
                  />
                ))}
                {selection.verses.some(v => highlights[String(v)]) && (
                  <button onClick={() => applyHighlight(null)} className="text-xs underline text-slate-300 ml-1">clear</button>
                )}
              </span>
              <button onClick={copySelection} className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white text-slate-900 rounded border-2 border-black" title={selection.companion ? 'Copies both languages' : 'Copy'}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={() => openNote(selection.key)} className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-amber-300 text-slate-900 rounded border-2 border-black" title={notes[selection.key] ? 'Edit the note on these verses' : 'Write a note beside these verses'}>
                <StickyNote size={14} /> {notes[selection.key] ? 'Edit note' : 'Note'}
              </button>
              {compareTranslations && single && (
                <button onClick={() => { if (mode !== 'study') onModeChange?.('study'); toggleCompare(selection.verses[0]); }} className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-sky-300 text-slate-900 rounded border-2 border-black">
                  <Columns2 size={14} /> Compare
                </button>
              )}
              {onShareSelection && (
                <button onClick={() => onShareSelection(selection)} className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-green-400 text-slate-900 rounded border-2 border-black" title={circleName ? `Share ${selection.label} with ${circleName}` : 'Share with your circle'}>
                  <Users size={14} /> Share{circleName ? <span className="hidden sm:inline"> with {circleName}</span> : ''}
                </button>
              )}
              <button onClick={clearSelection} className="ml-auto p-1 rounded hover:bg-white/10" title="Clear selection" aria-label="Clear selection"><X size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Right rail: what can I do ---- */}
      <aside className="hidden lg:block sticky top-28 space-y-3 print:hidden">
        {extraRail}
        <Rail title="Do" icon={<Brain size={12} />}>
          <div className="space-y-2">
            {onQuiz && (
              <button onClick={onQuiz} className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-wider text-xs px-3 py-2 rounded-full border-2 border-black">
                <Brain size={14} /> Quiz me
              </button>
            )}
            {onIllustrate && (
              <button onClick={onIllustrate} disabled={illustrating} className="w-full flex items-center justify-center gap-2 bg-white hover:bg-purple-50 text-purple-800 font-black uppercase tracking-wider text-xs px-3 py-2 rounded-full border-2 border-black disabled:opacity-50">
                <Wand2 size={14} /> {illustrating ? 'Drawing…' : pictures ? `${pictures}/${scenes.length} drawn` : 'Illustrate'}
              </button>
            )}
          </div>
        </Rail>
        {mode === 'study' && context && (context.terms.length > 0 || context.people.length > 0) && (
          <Rail title="Words & people" icon={<ListTree size={12} />}>
            <dl className="space-y-1.5 text-[11px] leading-tight max-h-72 overflow-y-auto pr-1">
              {context.terms.map((t, i) => (
                <div key={`t${i}`}><dt className="font-black inline">{t.term}: </dt><dd className="inline text-slate-700">{t.meaning}</dd></div>
              ))}
              {context.people.map((p, i) => (
                <div key={`p${i}`}><dt className="font-black inline text-purple-800">{p.name}: </dt><dd className="inline text-slate-700">{p.role}</dd></div>
              ))}
            </dl>
          </Rail>
        )}
        <Rail title="My marks" icon={<Bookmark size={12} />}>
          {highlightedVerses.length === 0 && noteKeys.length === 0 ? (
            <p className="text-[11px] text-slate-500">Tap any {verseLabel.toLowerCase()} to highlight it or add a note. Tap several, or use Select range, to mark a passage like {isQuran ? 'ayahs 1-10' : '4:1-10'}.</p>
          ) : (
            <div className="space-y-2">
              {highlightedVerses.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 mb-1">Highlighted {verseLabel.toLowerCase()}s · tap to go there</p>
                  <div className="flex flex-wrap gap-1">
                  {highlightedVerses.map(n => (
                    <button key={n} onClick={() => jumpToVerses([n])} className={`w-7 h-7 rounded-full border-2 border-black text-xs font-black ${colorClass(highlights[String(n)])}`} title={`${verseLabel} ${n}`}>
                      {n}
                    </button>
                  ))}
                  </div>
                </div>
              )}
              {noteKeys.length > 0 && (
                <ul className="space-y-1">
                  <li className="text-[10px] font-bold text-slate-500">Notes · tap to go there</li>
                  {noteKeys.map(k => (
                    <li key={k}>
                      <button onClick={() => jumpToNote(k)} className="text-left w-full text-[11px] leading-tight hover:bg-amber-50 rounded px-1" title="Go to this note">
                        <span className="font-black">{noteTitle(k)}:</span> {notes[k].slice(0, 60)}{notes[k].length > 60 ? '…' : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Rail>
      </aside>
    </div>
  );
};
