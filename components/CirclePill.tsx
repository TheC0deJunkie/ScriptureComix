import React, { useRef, useState } from 'react';
import { Users, ChevronDown, Link2, Settings2, Target, ArrowRight, Check, Send, X } from 'lucide-react';
import { StudyGroup, PassagePointer } from '../types';
import { memberColor, memberInitials } from '../services/circles';
import { Popover, Button, cx } from './ui/primitives';

/** One member's avatar: initials in the colour that follows them everywhere. */
export const MemberAvatar: React.FC<{ name: string; size?: 'xs' | 'sm' | 'md'; you?: boolean; className?: string }> = ({ name, size = 'sm', you, className }) => {
  const c = memberColor(name);
  const dim = size === 'xs' ? 'w-5 h-5 text-[9px]' : size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  return (
    <span
      className={cx('inline-flex items-center justify-center rounded-full border-2 border-black font-black select-none', dim, c.bg, c.text, className)}
      title={you ? `${name} (you)` : name}
      aria-label={you ? `${name} (you)` : name}
    >
      {memberInitials(name)}
    </span>
  );
};

interface CirclePillProps {
  group: StudyGroup;
  /** The reader's own name in circles. */
  you: string;
  /** Where the circle is ("Exodus 4"), and whether the reader is there. */
  circleLabel: string | null;
  onChapter: boolean;
  /** What the reader has open ("Exodus 5"). */
  currentLabel: string;
  onGoThere: () => void;
  onSetToCurrent: () => void;
  onCopyInvite: () => void;
  onManage: () => void;
  /** "For the circle": when on, changing chapter moves the circle too. */
  followCircle: boolean;
  onFollowCircleChange: (v: boolean) => void;
  /** Reflections, so a phone can read and write them without the rail. */
  onOpenPointer: (p: PassagePointer) => void;
  onAddReflection: (text: string, ref?: PassagePointer) => void;
  /** What is selected in the text right now — offered as an attachment. */
  attachable: { label: string; pointer: PassagePointer } | null;
}

/**
 * The circle, in the header, at every screen size: who is in it, where it
 * is, and the two things people do most — go to the circle's chapter, or
 * bring the circle to theirs. Reflections live here too so a phone never
 * needs the drawer.
 */
export const CirclePill: React.FC<CirclePillProps> = ({
  group, you, circleLabel, onChapter, currentLabel, onGoThere, onSetToCurrent, onCopyInvite, onManage,
  followCircle, onFollowCircleChange, onOpenPointer, onAddReflection, attachable,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [attach, setAttach] = useState(true);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const members = group.members.length ? group.members : [you];
  const shown = members.slice(0, 3);
  const more = members.length - shown.length;
  const recent = group.reflections.filter(r => r.author !== 'System').slice(-3).reverse();
  const drifted = !!circleLabel && !onChapter;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAddReflection(draft.trim(), attach && attachable ? attachable.pointer : undefined);
    setDraft('');
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={drifted ? `${group.name} is reading ${circleLabel} right now` : `${group.name}${circleLabel ? ` · reading ${circleLabel} together` : ''}`}
        className={cx(
          'flex items-center gap-1.5 min-w-0 border-[3px] border-black rounded-full bg-white pl-1.5 pr-2 py-1 shadow-[3px_3px_0_0_#000] transition-colors hover:bg-green-50',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300', open && 'bg-green-100',
        )}
      >
        <span className="flex -space-x-1.5">
          {shown.map(m => <MemberAvatar key={m} name={m} size="sm" you={m === you} />)}
          {more > 0 && <span className="w-6 h-6 rounded-full border-2 border-black bg-slate-200 text-[9px] font-black flex items-center justify-center">+{more}</span>}
        </span>
        <span className="hidden sm:inline font-black text-xs truncate max-w-[9rem]">{group.name}</span>
        <span
          className={cx('w-2 h-2 rounded-full border border-black shrink-0', drifted ? 'bg-amber-400' : circleLabel ? 'bg-green-500' : 'bg-slate-300')}
          aria-hidden="true"
        />
        <ChevronDown size={14} className={cx('shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} width={340} label={`Circle: ${group.name}`} className="p-3 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-700 flex items-center gap-1"><Users size={11} /> Study circle</p>
            <p className="font-black text-base leading-tight truncate">{group.name}</p>
            {group.focus && <p className="text-xs text-slate-500 truncate">{group.focus}</p>}
          </div>
          <button type="button" onClick={() => { setOpen(false); onManage(); }} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-full border-2 border-black bg-white hover:bg-slate-100" title="Rename, switch circle, leave">
            <Settings2 size={12} /> Manage
          </button>
        </div>

        {/* Members */}
        <ul className="flex flex-wrap gap-1.5" aria-label="Members">
          {members.map(m => (
            <li key={m} className="inline-flex items-center gap-1 rounded-full border-2 border-black bg-white pl-0.5 pr-2 py-0.5 text-[11px] font-bold">
              <MemberAvatar name={m} size="xs" you={m === you} /> {m}{m === you ? ' (you)' : ''}
            </li>
          ))}
        </ul>

        {/* Where the circle is */}
        <div className={cx('rounded-xl border-2 p-2.5', drifted ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50')}>
          {circleLabel ? (
            <>
              <p className="text-xs">
                <span className="text-slate-500">Circle is reading</span> <b>{circleLabel}</b>
                {onChapter && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider text-green-700"><Check size={11} /> together</span>}
              </p>
              {drifted && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="xs" variant="primary" onClick={() => { setOpen(false); onGoThere(); }}>Read with them <ArrowRight size={12} /></Button>
                  <Button size="xs" variant="secondary" onClick={() => { onSetToCurrent(); }} title={`Move the circle to ${currentLabel} so everyone reads it with you`}><Target size={12} /> Bring them to {currentLabel}</Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-xs text-slate-600">No chapter set yet.</p>
              <Button size="xs" variant="secondary" onClick={onSetToCurrent}><Target size={12} /> Set circle to {currentLabel}</Button>
            </div>
          )}
          <label className="mt-2 flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
            <span
              role="switch"
              aria-checked={followCircle}
              tabIndex={0}
              onClick={() => onFollowCircleChange(!followCircle)}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onFollowCircleChange(!followCircle); } }}
              className={cx('relative inline-block w-9 h-5 rounded-full border-2 border-black transition-colors', followCircle ? 'bg-green-400' : 'bg-slate-200')}
            >
              <span className={cx('absolute top-0.5 w-3 h-3 rounded-full bg-black transition-all', followCircle ? 'left-4' : 'left-0.5')} />
            </span>
            <span>Move the circle when I change chapter</span>
          </label>
          <p className="text-[10px] text-slate-500 mt-1 pl-11">{followCircle ? 'On: the circle follows you.' : 'Off: you wander alone; the circle stays put.'}</p>
        </div>

        {/* Reflections */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">What stood out</p>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing shared yet. Select verses and choose Share, or write below.</p>
          ) : (
            <ul className="space-y-1">
              {recent.map(r => (
                <li key={r.id} className="bg-slate-50 rounded-lg px-2 py-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 flex-wrap">
                    <MemberAvatar name={r.author} size="xs" you={r.author === you} /> {r.author}
                    {r.ref && (
                      <button type="button" onClick={() => { setOpen(false); onOpenPointer(r.ref!); }} className="normal-case tracking-normal font-black text-[10px] px-1.5 py-0.5 rounded bg-yellow-300 text-black hover:bg-yellow-200" title="Open these verses">
                        {r.ref.label}
                      </button>
                    )}
                  </p>
                  <p className="text-xs leading-snug text-slate-800 mt-0.5">{r.text}</p>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={submit} className="mt-2 space-y-1">
            {attachable && attach && (
              <p className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-300 text-black font-black">
                  {attachable.label}
                  <button type="button" onClick={() => setAttach(false)} aria-label="Do not attach these verses" title="Detach" className="rounded hover:bg-yellow-200"><X size={11} /></button>
                </span>
                will be attached
              </p>
            )}
            {attachable && !attach && (
              <button type="button" onClick={() => setAttach(true)} className="text-[10px] font-bold text-slate-500 underline">Attach {attachable.label}</button>
            )}
            <div className="flex gap-1">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={attachable && attach ? 'Say something about it…' : 'Share a thought with the circle'}
                aria-label="Share a reflection with your circle"
                className="min-w-0 flex-1 bg-white text-slate-900 text-xs font-bold rounded-lg px-2 py-1.5 border-2 border-black placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-green-300"
              />
              <button type="submit" disabled={!draft.trim()} aria-label="Share" className="shrink-0 w-8 h-8 rounded-lg bg-green-400 border-2 border-black text-black disabled:opacity-40 flex items-center justify-center"><Send size={14} /></button>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-between gap-2 border-t-2 border-dashed border-slate-200 pt-2">
          <Button size="xs" variant="dark" onClick={onCopyInvite}><Link2 size={12} /> Copy invite</Button>
          <p className="text-[10px] text-slate-500 text-right">Reflections stay on this device until sync is built.</p>
        </div>
      </Popover>
    </>
  );
};
