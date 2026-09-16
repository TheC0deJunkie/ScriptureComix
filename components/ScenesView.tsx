import React from 'react';
import { Image as ImageIcon, Film, Wand2, StickyNote } from 'lucide-react';
import { ChapterVerse, Scene } from '../types';
import { ChapterEnd } from './ScriptureReader';
import { versesOfKey } from '../services/refs';

interface ScenesViewProps {
  label: string;
  verseLabel: string;
  scenes: Scene[];
  verses: ChapterVerse[];
  status: 'loading' | 'ready' | 'unavailable';
  illustrating: boolean; // pictures still being drawn
  onIllustrate?: () => void; // reader asks for this chapter to be drawn now
  /** End-of-chapter actions, same as the reader's */
  canNext?: boolean;
  onNext?: () => void;
  onQuiz?: () => void;
  completed?: boolean;
  onComplete?: () => void;
  nextLabel?: string;
  onReflect?: () => void;
  /** Your verse notes for this chapter ("4" or "1-10" → text); each shows under the panel that holds its last verse. */
  notes?: Record<string, string>;
  /** Tap a note to open it beside the verse in the reader. */
  onOpenNote?: (key: string) => void;
}

const IllustrateButton: React.FC<{ onClick?: () => void; busy: boolean; label: string }> = ({ onClick, busy, label }) =>
  onClick ? (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-wider px-5 py-3 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50"
    >
      <Wand2 size={18} /> {busy ? 'Drawing…' : label}
    </button>
  ) : null;

/** Round comic-style verse badge so "this is verse 2" is obvious at a glance. */
export const VerseBadge: React.FC<{ n: number; size?: 'sm' | 'md' }> = ({ n, size = 'md' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full bg-black text-yellow-300 font-black align-middle mr-1 select-none border-2 border-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.6)] ${size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs'}`}
    style={{ fontFamily: 'inherit' }}
    aria-label={`verse ${n}`}
  >
    {n}
  </span>
);

const HALFTONE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(0,0,0,0.12) 1px, transparent 1.4px)',
  backgroundSize: '9px 9px',
  backgroundColor: '#fff8e1',
};

/**
 * A real comic page: square panels that are never cropped, a yellow narration
 * box on every panel, and the verses always visible underneath with round
 * numbered badges. The first scene is the splash panel; the rest pair up.
 */
export const ScenesView: React.FC<ScenesViewProps> = ({ label, verseLabel, scenes, verses, status, illustrating, onIllustrate, canNext, onNext, onQuiz, completed, onComplete, nextLabel, onReflect, notes = {}, onOpenNote }) => {
  const missing = scenes.filter(s => !s.image).length;
  const lastVerse = (key: string) => { const vs = versesOfKey(key); return vs[vs.length - 1] ?? NaN; };
  const notesFor = (s: Scene) => Object.entries(notes).filter(([k]) => { const l = lastVerse(k); return l >= s.from && l <= s.to; });

  if (status === 'loading') {
    return <p className="text-center py-10 font-bold text-slate-500 animate-pulse">Laying out the panels of {label}…</p>;
  }
  if (status === 'unavailable' || !scenes.length) {
    return (
      <div className="text-center py-10 text-slate-600 max-w-xl mx-auto">
        <Film size={40} className="mx-auto mb-3 text-slate-400" />
        <p className="font-bold">{label} has not been illustrated yet.</p>
        <p className="text-sm mt-1 mb-4">Pictures are drawn once and then kept for everyone. You can draw this chapter now.</p>
        <IllustrateButton onClick={onIllustrate} busy={illustrating} label="Illustrate this chapter" />
      </div>
    );
  }

  const rangeOf = (s: Scene) => (s.from === s.to ? `${verseLabel} ${s.from}` : `${verseLabel}s ${s.from}–${s.to}`);
  const versesOf = (s: Scene) => verses.filter(v => v.verse >= s.from && v.verse <= s.to);

  const Narration: React.FC<{ s: Scene; className?: string }> = ({ s, className }) => (
    <div className={`bg-yellow-100 border-[3px] border-black p-3 ${className ?? ''}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{rangeOf(s)}</p>
      <p className="comic-font text-2xl leading-none mt-0.5">{s.title}</p>
      <p className="text-sm leading-snug mt-1 text-slate-800">{s.caption}</p>
    </div>
  );

  // The picture is always a full square. On wide screens the narration box sits
  // over its bottom edge like a real comic; on phones it goes underneath so the
  // picture is never hidden behind the words.
  const Picture: React.FC<{ s: Scene; i: number }> = ({ s, i }) => (
    <div className="border-b-4 border-black">
      <div className="relative aspect-square bg-slate-900 overflow-hidden">
        {s.image ? (
          <img src={s.image} alt={s.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-slate-300 p-8" style={HALFTONE}>
            <ImageIcon size={56} className="mb-2 text-slate-400" />
            <p className="text-xs uppercase tracking-widest font-black text-slate-600">{illustrating ? 'Drawing…' : 'Not drawn yet'}</p>
            <p className="text-sm mt-3 italic text-slate-500 max-w-xs">{s.visualPrompt.slice(0, 140)}{s.visualPrompt.length > 140 ? '…' : ''}</p>
          </div>
        )}
        <span className="absolute top-3 left-3 bg-yellow-300 border-[3px] border-black rounded-full w-11 h-11 flex items-center justify-center comic-font text-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          {i + 1}
        </span>
        <Narration s={s} className="hidden md:block absolute left-3 right-3 bottom-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" />
      </div>
      <Narration s={s} className="md:hidden border-x-0 border-b-0" />
    </div>
  );

  const Text: React.FC<{ s: Scene }> = ({ s }) => (
    <div className="p-4 md:p-5 text-[15px] leading-relaxed" style={HALFTONE}>
      {versesOf(s).map(v => (
        <span key={v.verse} className="inline">
          <VerseBadge n={v.verse} size="sm" />
          <span className="bg-white/80 box-decoration-clone px-1 rounded">{v.text.trim()}</span>{' '}
        </span>
      ))}
      {notesFor(s).length > 0 && (
        <div className="mt-3 space-y-1.5">
          {notesFor(s).map(([k, text]) => (
            <button
              key={k}
              type="button"
              onClick={() => onOpenNote?.(k)}
              className="block w-full text-left bg-amber-50 border-l-4 border-amber-400 rounded-r px-2.5 py-1.5 text-sm hover:bg-amber-100"
              title="Open this note beside the verse"
            >
              <span className="block text-[10px] font-black uppercase tracking-widest text-amber-800"><StickyNote size={10} className="inline -mt-0.5 mr-1" />Your note on {verseLabel.toLowerCase()}{k.includes('-') || k.includes(',') ? 's' : ''} {k}</span>
              <span className="text-slate-800">{text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const [first, ...rest] = scenes;

  return (
    <div className="pb-8">
      <div className="text-center mb-6">
        <h2 className="comic-font text-5xl md:text-6xl">{label}</h2>
        <p className="text-xs uppercase tracking-widest font-bold text-slate-500 mt-1">
          {scenes.length} panels
          {illustrating && missing > 0 && <span className="ml-2 text-purple-700 animate-pulse">· drawing {missing} picture{missing === 1 ? '' : 's'}…</span>}
          {!illustrating && missing > 0 && <span className="ml-2 text-slate-400">· {missing} not yet drawn</span>}
        </p>
        {!illustrating && missing > 0 && (
          <div className="mt-3">
            <IllustrateButton onClick={onIllustrate} busy={illustrating} label={`Draw the ${missing} missing picture${missing === 1 ? '' : 's'}`} />
          </div>
        )}
      </div>

      {/* The page */}
      <div className="bg-white border-4 border-black p-3 md:p-5 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
          {/* Splash panel: picture and verses side by side */}
          <section className="md:col-span-2 border-4 border-black bg-white grid grid-cols-1 md:grid-cols-2 overflow-hidden">
            <Picture s={first} i={0} />
            <div className="md:border-l-4 md:border-black -mt-1 md:mt-0"><Text s={first} /></div>
          </section>

          {rest.map((s, i) => (
            <section key={s.id} className="border-4 border-black bg-white overflow-hidden flex flex-col">
              <Picture s={s} i={i + 1} />
              <Text s={s} />
            </section>
          ))}
        </div>
      </div>

      {/* End of chapter — the same "now what?" block as the reader */}
      <ChapterEnd
        label={label}
        completed={completed}
        onComplete={onComplete}
        onQuiz={onQuiz}
        onReflect={onReflect}
        canNext={canNext}
        onNext={onNext}
        nextLabel={nextLabel}
        className="max-w-3xl mx-auto"
      />
    </div>
  );
};
