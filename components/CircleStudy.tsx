import React, { useEffect, useMemo, useState } from 'react';
import {
  Lock, Unlock, History, StickyNote, Package, Sparkles, Check, X, Plus, Trash2, Pencil, ChevronDown, ChevronUp, BookOpen, Download, Flag, Clock,
} from 'lucide-react';
import { StudyGroup, StudySession, ReflectionEntry, PassagePointer, CircleNote, StudyPack } from '../types';
import { MemberAvatar } from './CirclePill';
import { Button, TextInput, TextArea, Field, Eyebrow, Pill, useToast, useConfirm, cx } from './ui/primitives';
import {
  type CircleActor, type CircleFocus, type StudyPackInput,
  subscribeSessions, subscribeNotes, subscribePacks, loadReflections,
  endSession, startSession, updateSessionWrapUp,
  addNote, updateNote, deleteNote,
  createPack, updatePack, deletePack,
  sessionToMarkdown,
} from '../services/circleStore';
import { summarizeStudySession } from '../services/geminiService';
import { runtimeAIEnabled } from '../services/runtimeConfig';
import { downloadText } from '../services/studyLog';

export interface CircleStudyContext {
  group: StudyGroup;
  actor: CircleActor;
  isLeader: boolean;
  /** What the reader has open right now. */
  currentFocus: CircleFocus;
  onOpenPointer?: (p: PassagePointer) => void;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const PassageChip: React.FC<{ p: PassagePointer; onOpen?: (p: PassagePointer) => void; dark?: boolean }> = ({ p, onOpen, dark }) => {
  const cls = cx('px-1.5 py-0.5 rounded border text-[10px] font-bold', dark ? 'bg-yellow-200 border-yellow-500 text-slate-900' : 'bg-yellow-100 border-yellow-400 text-slate-900');
  return onOpen
    ? <button type="button" onClick={() => onOpen(p)} className={cx(cls, 'hover:bg-yellow-300')} title="Open these verses">{p.label}</button>
    : <span className={cls}>{p.label}</span>;
};

const TakeawayEditor: React.FC<{ value: string[]; onChange: (v: string[]) => void }> = ({ value, onChange }) => {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (!t) return; onChange([...value, t]); setDraft(''); };
  return (
    <div className="space-y-1.5">
      <ul className="space-y-1">
        {value.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Check size={14} className="shrink-0 mt-0.5 text-green-600" />
            <span className="flex-1">{t}</span>
            <button type="button" aria-label="Remove takeaway" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600"><X size={14} /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <TextInput value={draft} onChange={e => setDraft(e.target.value)} placeholder="One thing we learnt…" className="flex-1 min-w-0" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button type="button" size="sm" variant="secondary" onClick={add} disabled={!draft.trim()}><Plus size={14} /></Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Session controls: end (locks everyone) / start next
// ---------------------------------------------------------------------------

export const SessionControls: React.FC<CircleStudyContext & { reflections: ReflectionEntry[] }> = ({ group, actor, isLeader, currentFocus, reflections }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [wrapping, setWrapping] = useState(false);
  const [summary, setSummary] = useState('');
  const [takeaways, setTakeaways] = useState<string[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nextTitle, setNextTitle] = useState('');
  const [current, setCurrent] = useState<StudySession | null>(null);

  useEffect(() => {
    if (!group.currentSessionId) { setCurrent(null); return; }
    return subscribeSessions(group.id, list => setCurrent(list.find(s => s.id === group.currentSessionId) ?? null));
  }, [group.id, group.currentSessionId]);

  const ended = group.status === 'ended';
  const aiAvailable = runtimeAIEnabled();

  const draftWithAi = async () => {
    setDrafting(true);
    try {
      const said = reflections.filter(r => r.author !== 'System').map(r => ({ author: r.author, text: r.text, ref: r.ref?.label }));
      const draft = await summarizeStudySession((current?.passages ?? []).map(p => p.label), said);
      if (draft.summary) setSummary(draft.summary);
      if (draft.takeaways.length) setTakeaways(draft.takeaways);
      toast({ title: 'Draft ready', description: 'Edit anything before you end the session.' });
    } catch (err) {
      toast({ title: 'Could not draft a summary', description: err instanceof Error ? err.message : 'Try again or write it by hand.', tone: 'error' });
    } finally {
      setDrafting(false);
    }
  };

  const doEnd = async () => {
    const ok = await confirm({
      title: `End ${current?.title ?? 'this session'}?`,
      description: 'Everyone in the circle is locked out of adding reflections until you start the next session. The summary and takeaways are kept in History.',
      confirmLabel: 'End session for everyone',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await endSession(actor, group.id, { summary: summary.trim(), takeaways });
      setWrapping(false);
      toast({ title: 'Session ended', description: 'The circle is locked. Start the next session when you are ready.' });
    } catch (err) {
      toast({ title: 'Could not end the session', description: err instanceof Error ? err.message : undefined, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const doStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await startSession(actor, group.id, nextTitle, currentFocus);
      setNextTitle('');
      toast({ title: 'New session started', description: `Everyone is unlocked and pointed at ${currentFocus.label}.` });
    } catch (err) {
      toast({ title: 'Could not start a session', description: err instanceof Error ? err.message : undefined, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cx('rounded-2xl p-4 border', ended ? 'bg-red-50 border-red-300 text-slate-900' : 'bg-white/10 border-white/20')}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Eyebrow icon={ended ? <Lock size={12} /> : <Unlock size={12} />} className={ended ? 'text-red-800' : 'text-slate-200'}>
          {ended ? 'Session ended · circle locked' : `${current?.title ?? 'Session'} · open`}
        </Eyebrow>
        {current && (
          <span className={cx('text-[10px] font-bold uppercase tracking-wider flex items-center gap-1', ended ? 'text-red-700' : 'text-slate-400')}>
            <Clock size={11} /> {ended && current.endedAt ? `ended ${when(current.endedAt)}` : `since ${when(current.startedAt)}`}
          </span>
        )}
      </div>

      {!ended && !wrapping && (
        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
          <p className={cx('text-xs', 'text-slate-300')}>
            {current?.passages.length ? <>Read so far: {current.passages.map(p => p.label).join(' → ')}</> : 'Reflections are being collected.'}
          </p>
          {isLeader ? (
            <Button size="sm" variant="secondary" onClick={() => setWrapping(true)}><Flag size={14} /> End session</Button>
          ) : (
            <span className="text-[11px] text-slate-400">Only the leader can end the session.</span>
          )}
        </div>
      )}

      {!ended && wrapping && (
        <div className="mt-3 bg-white rounded-2xl p-3 text-slate-900 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black">Wrap up {current?.title ?? 'the session'}</p>
            {aiAvailable && (
              <Button size="xs" variant="accent" onClick={draftWithAi} disabled={drafting || reflections.filter(r => r.author !== 'System').length === 0} title="Draft a summary from what members said">
                <Sparkles size={12} /> {drafting ? 'Drafting…' : 'Draft with AI'}
              </Button>
            )}
          </div>
          <Field label="What happened" hint="A few sentences the circle can look back on">
            <TextArea value={summary} onChange={e => setSummary(e.target.value)} placeholder="We read… The thing that stood out was…" rows={4} />
          </Field>
          <Field label="What we learnt">
            <TakeawayEditor value={takeaways} onChange={setTakeaways} />
          </Field>
          <div className="flex gap-2 flex-wrap">
            <Button variant="danger" size="sm" onClick={doEnd} disabled={busy}><Lock size={14} /> End and lock for everyone</Button>
            <Button variant="ghost" size="sm" onClick={() => setWrapping(false)} disabled={busy}>Keep going</Button>
          </div>
        </div>
      )}

      {ended && (
        <div className="mt-2 space-y-3">
          {current?.summary && <p className="text-sm">{current.summary}</p>}
          {current && current.takeaways.length > 0 && (
            <ul className="text-sm space-y-0.5">{current.takeaways.map((t, i) => <li key={i} className="flex gap-1.5"><Check size={14} className="shrink-0 mt-0.5 text-green-700" />{t}</li>)}</ul>
          )}
          {isLeader ? (
            <form onSubmit={doStart} className="flex flex-wrap items-end gap-2 bg-white rounded-2xl p-3 border-2 border-black">
              <Field label="Next session" hint={`Starts at ${currentFocus.label}`} className="flex-1 min-w-[12rem]">
                <TextInput value={nextTitle} onChange={e => setNextTitle(e.target.value)} placeholder={`Session ${(group.sessionCount ?? 0) + 1}`} />
              </Field>
              <Button type="submit" variant="success" size="sm" disabled={busy}><Unlock size={14} /> Start and unlock</Button>
            </form>
          ) : (
            <p className="text-xs font-bold text-red-800 flex items-center gap-1"><Lock size={12} /> Waiting for the leader to start the next session. You can still read History, Notes and Packs.</p>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// History: every session, what was read, what was said, what was learnt
// ---------------------------------------------------------------------------

const SessionCard: React.FC<{ group: StudyGroup; session: StudySession; you: string; onOpenPointer?: (p: PassagePointer) => void }> = ({ group, session, you, onOpenPointer }) => {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reflections, setReflections] = useState<ReflectionEntry[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const [summary, setSummary] = useState(session.summary);
  const [takeaways, setTakeaways] = useState(session.takeaways);

  useEffect(() => { setTitle(session.title); setSummary(session.summary); setTakeaways(session.takeaways); }, [session.title, session.summary, session.takeaways]);

  useEffect(() => {
    if (!open || reflections) return;
    loadReflections(group.id, session.id).then(setReflections).catch(() => setReflections([]));
  }, [open, reflections, group.id, session.id]);

  const isCurrent = session.id === group.currentSessionId;

  const save = async () => {
    try {
      await updateSessionWrapUp(group.id, session.id, { title: title.trim() || session.title, summary: summary.trim(), takeaways });
      setEditing(false);
      toast({ title: 'Session updated' });
    } catch (err) {
      toast({ title: 'Could not save', description: err instanceof Error ? err.message : undefined, tone: 'error' });
    }
  };

  const exportMd = async () => {
    const entries = reflections ?? (await loadReflections(group.id, session.id).catch(() => []));
    const md = sessionToMarkdown(group.name, session, entries);
    downloadText(`${group.name}-${session.title}.md`.replace(/\s+/g, '-').toLowerCase(), md);
  };

  return (
    <div className={cx('rounded-2xl border-2 bg-white text-slate-900', isCurrent ? 'border-green-500' : 'border-slate-200')}>
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full text-left p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black leading-tight flex items-center gap-2 flex-wrap">
            {session.title}
            {isCurrent && session.status === 'open' && <Pill tone="green">Open now</Pill>}
            {session.status === 'closed' && <Pill tone="slate"><Lock size={10} /> Ended</Pill>}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{when(session.startedAt)} · {session.startedBy} · {session.reflectionCount} reflection{session.reflectionCount === 1 ? '' : 's'}</p>
          {session.passages.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-1">{session.passages.map((p, i) => <PassageChip key={i} p={p} onOpen={onOpenPointer} />)}</p>
          )}
        </div>
        {open ? <ChevronUp size={16} className="shrink-0 mt-1" /> : <ChevronDown size={16} className="shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
          {editing ? (
            <div className="space-y-2">
              <Field label="Title"><TextInput value={title} onChange={e => setTitle(e.target.value)} /></Field>
              <Field label="Summary"><TextArea value={summary} onChange={e => setSummary(e.target.value)} rows={4} /></Field>
              <Field label="What we learnt"><TakeawayEditor value={takeaways} onChange={setTakeaways} /></Field>
              <div className="flex gap-2"><Button size="sm" variant="dark" onClick={save}><Check size={14} /> Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div>
            </div>
          ) : (
            <>
              <div>
                <Eyebrow>Summary</Eyebrow>
                <p className="text-sm mt-1">{session.summary || <span className="text-slate-400">Nothing written yet.</span>}</p>
              </div>
              <div>
                <Eyebrow>What we learnt</Eyebrow>
                {session.takeaways.length ? (
                  <ul className="text-sm mt-1 space-y-0.5">{session.takeaways.map((t, i) => <li key={i} className="flex gap-1.5"><Check size={14} className="shrink-0 mt-0.5 text-green-700" />{t}</li>)}</ul>
                ) : <p className="text-sm text-slate-400 mt-1">No takeaways recorded.</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="xs" variant="secondary" onClick={() => setEditing(true)}><Pencil size={12} /> Edit</Button>
                <Button size="xs" variant="ghost" onClick={exportMd}><Download size={12} /> Export</Button>
              </div>
            </>
          )}
          <div>
            <Eyebrow>Reflections</Eyebrow>
            {reflections === null ? (
              <p className="text-sm text-slate-400 mt-1">Loading…</p>
            ) : reflections.filter(r => r.author !== 'System').length === 0 ? (
              <p className="text-sm text-slate-400 mt-1">Nobody shared a reflection in this session.</p>
            ) : (
              <div className="mt-1 space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {reflections.map(r => (
                  <div key={r.id} className={cx('rounded-xl p-2 border text-sm', r.author === 'System' ? 'border-dashed border-slate-200 text-slate-500 text-xs' : 'border-slate-200')}>
                    {r.author !== 'System' && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-purple-700 flex items-center gap-1.5 flex-wrap">
                        <MemberAvatar name={r.author} size="xs" you={r.author === you} /> {r.author}
                        {r.ref && <PassageChip p={r.ref} onOpen={onOpenPointer} />}
                      </p>
                    )}
                    <p className="mt-0.5">{r.text}</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">{when(r.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SessionHistory: React.FC<CircleStudyContext> = ({ group, actor, onOpenPointer }) => {
  const [sessions, setSessions] = useState<StudySession[] | null>(null);
  useEffect(() => subscribeSessions(group.id, setSessions), [group.id]);

  const totals = useMemo(() => {
    const list = sessions ?? [];
    return {
      sessions: list.length,
      reflections: list.reduce((n, s) => n + s.reflectionCount, 0),
      passages: new Set(list.flatMap(s => s.passages.map(p => p.label))).size,
      takeaways: list.reduce((n, s) => n + s.takeaways.length, 0),
    };
  }, [sessions]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="text-purple-300" />
        <div>
          <Eyebrow className="text-slate-200">Everything this circle has learnt</Eyebrow>
          <p className="text-xs text-slate-300">{totals.sessions} session{totals.sessions === 1 ? '' : 's'} · {totals.passages} passage{totals.passages === 1 ? '' : 's'} · {totals.reflections} reflections · {totals.takeaways} takeaways</p>
        </div>
      </div>
      {sessions === null ? (
        <p className="text-sm text-slate-300">Loading history…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-slate-300">No sessions yet.</p>
      ) : (
        sessions.map(s => <SessionCard key={s.id} group={group} session={s} you={actor.alias} onOpenPointer={onOpenPointer} />)
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared notes
// ---------------------------------------------------------------------------

export const CircleNotes: React.FC<CircleStudyContext & { attachable?: PassagePointer | null }> = ({ group, actor, isLeader, attachable, onOpenPointer }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [notes, setNotes] = useState<CircleNote[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attach, setAttach] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  useEffect(() => subscribeNotes(group.id, setNotes), [group.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await addNote(actor, group.id, { title: title.trim(), body: body.trim(), ref: attach && attachable ? attachable : undefined });
      setTitle(''); setBody('');
      toast({ title: 'Note shared with the circle' });
    } catch (err) {
      toast({ title: 'Could not save the note', description: err instanceof Error ? err.message : undefined, tone: 'error' });
    }
  };

  const saveEdit = async (id: string) => {
    try {
      await updateNote(group.id, id, { title: editTitle.trim(), body: editBody.trim() });
      setEditingId(null);
    } catch (err) {
      toast({ title: 'Could not update the note', description: err instanceof Error ? err.message : undefined, tone: 'error' });
    }
  };

  const remove = async (n: CircleNote) => {
    const ok = await confirm({ title: 'Delete this note?', description: 'It disappears for everyone in the circle.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    deleteNote(group.id, n.id).catch(err => toast({ title: 'Could not delete', description: err instanceof Error ? err.message : undefined, tone: 'error' }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StickyNote className="text-yellow-300" />
        <div>
          <Eyebrow className="text-slate-200">Shared notes</Eyebrow>
          <p className="text-xs text-slate-300">Longer thoughts, questions to bring next time, things to look up. Everyone in the circle sees them.</p>
        </div>
      </div>
      <form onSubmit={submit} className="bg-white rounded-2xl p-3 text-slate-900 space-y-2">
        <TextInput value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" aria-label="Note title" />
        <TextArea value={body} onChange={e => setBody(e.target.value)} placeholder="Write the note…" rows={3} aria-label="Note body" />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {attachable ? (
            <label className="flex items-center gap-1.5 text-xs font-bold"><input type="checkbox" checked={attach} onChange={e => setAttach(e.target.checked)} /> Attach {attachable.label}</label>
          ) : <span className="text-[11px] text-slate-500">Select verses in the reader to attach them.</span>}
          <Button type="submit" size="sm" variant="dark" disabled={!body.trim()}><Plus size={14} /> Add note</Button>
        </div>
      </form>
      {notes === null ? <p className="text-sm text-slate-300">Loading notes…</p> : notes.length === 0 ? <p className="text-sm text-slate-300">No notes yet.</p> : (
        <div className="space-y-2">
          {notes.map(n => {
            const mine = n.authorUid === actor.uid;
            return (
              <div key={n.id} className="bg-white rounded-2xl p-3 text-slate-900 border-2 border-slate-200">
                {editingId === n.id ? (
                  <div className="space-y-2">
                    <TextInput value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" />
                    <TextArea value={editBody} onChange={e => setEditBody(e.target.value)} rows={3} />
                    <div className="flex gap-2"><Button size="xs" variant="dark" onClick={() => saveEdit(n.id)} disabled={!editBody.trim()}><Check size={12} /> Save</Button><Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {n.title && <p className="font-black leading-tight">{n.title}</p>}
                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-700 flex items-center gap-1.5 flex-wrap mt-0.5">
                          <MemberAvatar name={n.author} size="xs" you={mine} /> {n.author}
                          {n.ref && <PassageChip p={n.ref} onOpen={onOpenPointer} />}
                        </p>
                      </div>
                      {(mine || isLeader) && (
                        <div className="flex gap-1 shrink-0">
                          {mine && <button type="button" aria-label="Edit note" onClick={() => { setEditingId(n.id); setEditTitle(n.title); setEditBody(n.body); }} className="p-1 rounded text-slate-500 hover:text-black"><Pencil size={14} /></button>}
                          <button type="button" aria-label="Delete note" onClick={() => remove(n)} className="p-1 rounded text-slate-500 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm mt-1.5 whitespace-pre-wrap">{n.body}</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1.5">{when(n.updatedAt)}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Study packs
// ---------------------------------------------------------------------------

const emptyPack = (): StudyPackInput => ({ title: '', description: '', passages: [], questions: [], notes: '' });

const PackEditor: React.FC<{
  initial: StudyPackInput;
  currentFocus: CircleFocus;
  attachable?: PassagePointer | null;
  onSave: (p: StudyPackInput) => Promise<void>;
  onCancel: () => void;
}> = ({ initial, currentFocus, attachable, onSave, onCancel }) => {
  const [pack, setPack] = useState<StudyPackInput>(initial);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  const addPassage = (p: PassagePointer) => {
    if (pack.passages.some(x => x.label === p.label)) return;
    setPack({ ...pack, passages: [...pack.passages, p] });
  };
  const currentPointer: PassagePointer = { tradition: currentFocus.tradition, book: currentFocus.book, chapter: currentFocus.chapter, verses: currentFocus.verses ?? [], label: currentFocus.label };
  const addQuestion = () => { const q = question.trim(); if (!q) return; setPack({ ...pack, questions: [...pack.questions, q] }); setQuestion(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pack.title.trim()) return;
    setBusy(true);
    try { await onSave({ ...pack, title: pack.title.trim(), description: pack.description.trim(), notes: pack.notes.trim() }); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-3 text-slate-900 space-y-3 border-2 border-black">
      <Field label="Pack title"><TextInput value={pack.title} onChange={e => setPack({ ...pack, title: e.target.value })} placeholder="e.g. Exodus 1–4: the call" required data-autofocus /></Field>
      <Field label="What it is for" hint="Optional"><TextInput value={pack.description} onChange={e => setPack({ ...pack, description: e.target.value })} placeholder="Read before Tuesday; we will discuss questions 1–3" /></Field>
      <Field label="Passages">
        <div className="space-y-1.5">
          {pack.passages.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {pack.passages.map((p, i) => (
                <li key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 border border-yellow-400 text-xs font-bold">
                  {p.label}
                  <button type="button" aria-label={`Remove ${p.label}`} onClick={() => setPack({ ...pack, passages: pack.passages.filter((_, j) => j !== i) })} className="text-slate-500 hover:text-red-600"><X size={12} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-1.5 flex-wrap">
            <Button type="button" size="xs" variant="secondary" onClick={() => addPassage(currentPointer)}><BookOpen size={12} /> Add {currentFocus.label}</Button>
            {attachable && attachable.label !== currentFocus.label && <Button type="button" size="xs" variant="secondary" onClick={() => addPassage(attachable)}><Plus size={12} /> Add {attachable.label}</Button>}
          </div>
        </div>
      </Field>
      <Field label="Questions to think about">
        <div className="space-y-1.5">
          {pack.questions.length > 0 && (
            <ol className="list-decimal pl-5 space-y-0.5 text-sm">
              {pack.questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2"><span className="flex-1">{q}</span><button type="button" aria-label="Remove question" onClick={() => setPack({ ...pack, questions: pack.questions.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-600"><X size={14} /></button></li>
              ))}
            </ol>
          )}
          <div className="flex gap-1">
            <TextInput value={question} onChange={e => setQuestion(e.target.value)} placeholder="Add a question…" className="flex-1 min-w-0" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuestion(); } }} />
            <Button type="button" size="sm" variant="secondary" onClick={addQuestion} disabled={!question.trim()}><Plus size={14} /></Button>
          </div>
        </div>
      </Field>
      <Field label="Notes and background" hint="Optional"><TextArea value={pack.notes} onChange={e => setPack({ ...pack, notes: e.target.value })} rows={4} placeholder="Context, links, things to remember…" /></Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="dark" disabled={busy || !pack.title.trim()}><Check size={14} /> Save pack</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
};

export const CirclePacks: React.FC<CircleStudyContext & { attachable?: PassagePointer | null }> = ({ group, actor, isLeader, currentFocus, attachable, onOpenPointer }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [packs, setPacks] = useState<StudyPack[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => subscribePacks(group.id, setPacks), [group.id]);

  const fail = (title: string) => (err: unknown) => toast({ title, description: err instanceof Error ? err.message : undefined, tone: 'error' });

  const remove = async (p: StudyPack) => {
    const ok = await confirm({ title: `Delete "${p.title}"?`, description: 'The pack is removed for everyone in the circle.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    deletePack(group.id, p.id).catch(fail('Could not delete the pack'));
  };

  const exportPack = (p: StudyPack) => {
    const md = [
      `# ${p.title}`,
      p.description,
      '',
      '## Passages',
      ...p.passages.map(x => `- ${x.label}`),
      '',
      '## Questions',
      ...p.questions.map((q, i) => `${i + 1}. ${q}`),
      '',
      '## Notes',
      p.notes,
    ].join('\n');
    downloadText(`${group.name}-${p.title}.md`.replace(/\s+/g, '-').toLowerCase(), md);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Package className="text-green-300" />
          <div>
            <Eyebrow className="text-slate-200">Study packs</Eyebrow>
            <p className="text-xs text-slate-300">Passages, questions and notes bundled for the circle to work through.</p>
          </div>
        </div>
        {!creating && <Button size="sm" variant="primary" onClick={() => { setCreating(true); setEditingId(null); }}><Plus size={14} /> New pack</Button>}
      </div>

      {creating && (
        <PackEditor
          initial={{ ...emptyPack(), passages: [{ tradition: currentFocus.tradition, book: currentFocus.book, chapter: currentFocus.chapter, verses: currentFocus.verses ?? [], label: currentFocus.label }] }}
          currentFocus={currentFocus}
          attachable={attachable}
          onCancel={() => setCreating(false)}
          onSave={async p => { try { await createPack(actor, group.id, p); setCreating(false); toast({ title: 'Pack created', description: 'Everyone in the circle can open it.' }); } catch (err) { fail('Could not create the pack')(err); } }}
        />
      )}

      {packs === null ? <p className="text-sm text-slate-300">Loading packs…</p> : packs.length === 0 && !creating ? <p className="text-sm text-slate-300">No packs yet. Make one from what you are reading now.</p> : (
        <div className="space-y-2">
          {packs.map(p => (
            editingId === p.id ? (
              <PackEditor
                key={p.id}
                initial={{ title: p.title, description: p.description, passages: p.passages, questions: p.questions, notes: p.notes }}
                currentFocus={currentFocus}
                attachable={attachable}
                onCancel={() => setEditingId(null)}
                onSave={async next => { try { await updatePack(group.id, p.id, next); setEditingId(null); toast({ title: 'Pack updated' }); } catch (err) { fail('Could not update the pack')(err); } }}
              />
            ) : (
              <div key={p.id} className="bg-white rounded-2xl text-slate-900 border-2 border-slate-200">
                <button type="button" onClick={() => setOpenId(openId === p.id ? null : p.id)} className="w-full text-left p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black leading-tight">{p.title}</p>
                    {p.description && <p className="text-xs text-slate-600 mt-0.5">{p.description}</p>}
                    <p className="text-[11px] text-slate-500 mt-1">{p.passages.length} passage{p.passages.length === 1 ? '' : 's'} · {p.questions.length} question{p.questions.length === 1 ? '' : 's'} · by {p.createdBy}</p>
                  </div>
                  {openId === p.id ? <ChevronUp size={16} className="shrink-0 mt-1" /> : <ChevronDown size={16} className="shrink-0 mt-1" />}
                </button>
                {openId === p.id && (
                  <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
                    {p.passages.length > 0 && (
                      <div><Eyebrow>Passages</Eyebrow><p className="mt-1 flex flex-wrap gap-1">{p.passages.map((x, i) => <PassageChip key={i} p={x} onOpen={onOpenPointer} />)}</p></div>
                    )}
                    {p.questions.length > 0 && (
                      <div><Eyebrow>Questions</Eyebrow><ol className="list-decimal pl-5 text-sm mt-1 space-y-0.5">{p.questions.map((q, i) => <li key={i}>{q}</li>)}</ol></div>
                    )}
                    {p.notes && <div><Eyebrow>Notes</Eyebrow><p className="text-sm mt-1 whitespace-pre-wrap">{p.notes}</p></div>}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="xs" variant="secondary" onClick={() => { setEditingId(p.id); setCreating(false); }}><Pencil size={12} /> Edit</Button>
                      <Button size="xs" variant="ghost" onClick={() => exportPack(p)}><Download size={12} /> Export</Button>
                      {(p.createdByUid === actor.uid || isLeader) && <Button size="xs" variant="ghost" className="text-red-700" onClick={() => remove(p)}><Trash2 size={12} /> Delete</Button>}
                    </div>
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
};
