import React, { useMemo, useRef } from 'react';
import { Bookmark, Highlighter, StickyNote, Download, Upload, ArrowRight, BookOpen, Flame, Sparkles, Library } from 'lucide-react';
import { Drawer, Button, Card, Eyebrow, EmptyState, Pill, cx } from './ui/primitives';
import { UserStats } from '../types';
import { HIGHLIGHT_COLORS } from '../services/highlights';
import { LastRead, listStudiedChapters, StudiedChapter } from '../services/studyLog';
import { versesOfKey } from '../services/refs';

export interface OpenTarget {
  tradition?: string;
  translationId?: string;
  bookSlug?: string;
  bookName: string;
  chapter: number;
  mode?: 'read' | 'study';
  verse?: number;
  verses?: number[];
}

interface StudyLibraryProps {
  open: boolean;
  onClose: () => void;
  stats: UserStats;
  lastRead: LastRead | null;
  chapterNotes: Record<string, string>;      // "Book Chapter" → note
  onOpen: (t: OpenTarget) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  refreshKey?: unknown;                        // change to recompute the list
}

const colorDot = (id: string) => HIGHLIGHT_COLORS.find(c => c.id === id)?.className ?? 'bg-slate-200';

/**
 * "My study" — every chapter you have marked, your bookmarks and chapter
 * notes, where you left off, and a way to carry it all to another device.
 */
export const StudyLibrary: React.FC<StudyLibraryProps> = ({ open, onClose, stats, lastRead, chapterNotes, onOpen, onExport, onImportFile, refreshKey }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const studied = useMemo(() => (open ? listStudiedChapters() : []), [open, refreshKey]);
  const highlightCount = studied.reduce((n, c) => n + c.highlights.length, 0);
  const noteCount = studied.reduce((n, c) => n + c.notes.length, 0) + Object.values(chapterNotes).filter(Boolean).length;
  const bookmarks = stats.bookmarks;

  const parseLabel = (label: string): { bookName: string; chapter: number } => {
    const m = label.match(/^(.*)\s(\d+)$/);
    return m ? { bookName: m[1], chapter: Number(m[2]) } : { bookName: label, chapter: 1 };
  };

  const Row: React.FC<{ c: StudiedChapter }> = ({ c }) => (
    <li className="bg-white border-[3px] border-black rounded-2xl p-3 shadow-[3px_3px_0_0_#000]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-base leading-tight">{c.bookName} {c.chapter}</p>
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">{c.tradition}{c.translation ? ` · ${c.translation}` : ''}</p>
        </div>
        <Button size="xs" variant="primary" onClick={() => onOpen({ tradition: c.tradition, translationId: c.translation, bookSlug: c.slug, bookName: c.bookName, chapter: c.chapter, mode: 'study' })}>
          Open <ArrowRight size={12} />
        </Button>
      </div>
      {c.highlights.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {c.highlights.map(h => (
            <button
              key={h.verse}
              type="button"
              onClick={() => onOpen({ tradition: c.tradition, translationId: c.translation, bookSlug: c.slug, bookName: c.bookName, chapter: c.chapter, mode: 'study', verse: h.verse })}
              className={cx('w-7 h-7 rounded-full border-2 border-black text-[11px] font-black hover:scale-110 transition-transform', colorDot(h.color))}
              title={`Verse ${h.verse}`}
            >
              {h.verse}
            </button>
          ))}
        </div>
      )}
      {c.notes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {c.notes.map(n => (
            <li key={n.ref}>
              <button
                type="button"
                onClick={() => onOpen({ tradition: c.tradition, translationId: c.translation, bookSlug: c.slug, bookName: c.bookName, chapter: c.chapter, mode: 'study', verses: versesOfKey(n.ref) })}
                className="w-full text-left text-sm bg-amber-50 border-l-4 border-amber-400 rounded px-2 py-1 hover:bg-amber-100"
              >
                <span className="font-black text-amber-800">v{n.ref}: </span>
                <span className="text-slate-800">{n.text.length > 120 ? n.text.slice(0, 120) + '…' : n.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  return (
    <Drawer open={open} onClose={onClose} label="My study" width="md" header={
      <div className="flex items-center gap-2">
        <span className="bg-yellow-300 border-2 border-black rounded-full p-1.5"><Library size={16} /></span>
        <div>
          <p className="comic-font text-2xl leading-none">My study</p>
          <p className="text-[11px] text-slate-500 font-bold">Everything you have marked, on this device</p>
        </div>
      </div>
    }>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            [<Flame size={14} className="text-orange-500" />, stats.streak, 'day streak'],
            [<BookOpen size={14} className="text-blue-600" />, stats.chaptersRead, 'chapters'],
            [<Sparkles size={14} className="text-purple-600" />, stats.xp, 'xp'],
          ].map(([icon, n, label], i) => (
            <Card key={i} className="p-3 text-center">
              <p className="flex items-center justify-center gap-1 font-black text-xl leading-none">{icon as React.ReactNode}{n as number}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">{label as string}</p>
            </Card>
          ))}
        </div>

        {lastRead && (
          <Card tone="dark" className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Eyebrow className="text-yellow-300">Where you left off</Eyebrow>
              <p className="font-black text-lg leading-tight truncate">{lastRead.bookName} {lastRead.chapter}</p>
              <p className="text-[11px] text-slate-300">{new Date(lastRead.at).toLocaleString()}</p>
            </div>
            <Button size="sm" variant="primary" onClick={() => onOpen({ tradition: lastRead.tradition, translationId: lastRead.translationId ?? undefined, bookSlug: lastRead.bookSlug ?? undefined, bookName: lastRead.bookName, chapter: lastRead.chapter, mode: 'read' })}>
              Continue <ArrowRight size={14} />
            </Button>
          </Card>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <Eyebrow icon={<Bookmark size={12} />}>Bookmarks</Eyebrow>
            <Pill tone="yellow">{bookmarks.length}</Pill>
          </div>
          {bookmarks.length === 0 ? (
            <p className="text-sm text-slate-500">No bookmarks yet. In a comic, tap the bookmark to keep a chapter here.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bookmarks.map(b => {
                const p = parseLabel(b);
                return (
                  <button key={b} type="button" onClick={() => onOpen({ bookName: p.bookName, chapter: p.chapter })} className="px-3 py-1.5 bg-white border-2 border-black rounded-full text-xs font-black hover:bg-yellow-100">{b}</button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <Eyebrow icon={<Highlighter size={12} />}>Marked chapters</Eyebrow>
            <div className="flex gap-1">
              <Pill tone="yellow" title="Highlighted verses">{highlightCount} highlights</Pill>
              <Pill tone="amber" title="Notes">{noteCount} notes</Pill>
            </div>
          </div>
          {studied.length === 0 ? (
            <EmptyState icon={<StickyNote size={24} />} title="Nothing marked yet" body="While reading, tap any verse to highlight it or write a note. It shows up here so you can come back to it." className="py-6" />
          ) : (
            <ul className="space-y-2">{studied.map(c => <Row key={c.key} c={c} />)}</ul>
          )}
        </section>

        {Object.keys(chapterNotes).filter(k => chapterNotes[k]).length > 0 && (
          <section>
            <Eyebrow icon={<StickyNote size={12} />} className="text-slate-500 mb-2">Chapter notes</Eyebrow>
            <ul className="space-y-1.5">
              {(Object.entries(chapterNotes) as [string, string][]).filter(([, v]) => v).map(([k, v]) => {
                const p = parseLabel(k);
                return (
                  <li key={k}>
                    <button type="button" onClick={() => onOpen({ bookName: p.bookName, chapter: p.chapter })} className="w-full text-left bg-white border-2 border-black rounded-xl p-3 hover:bg-amber-50">
                      <p className="font-black text-sm">{k}</p>
                      <p className="text-sm text-slate-700 mt-0.5">{v.length > 160 ? v.slice(0, 160) + '…' : v}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="border-t-2 border-dashed border-slate-300 pt-4">
          <Eyebrow className="text-slate-500 mb-1">Keep it safe</Eyebrow>
          <p className="text-sm text-slate-600 mb-3">Your study lives only in this browser. Save it as a file to back it up or move it to another device.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="dark" onClick={onExport}><Download size={14} /> Save study file</Button>
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={14} /> Load study file</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              onChange={e => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.currentTarget.value = ''; }}
            />
          </div>
        </section>
      </div>
    </Drawer>
  );
};
