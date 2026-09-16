import React, { useEffect, useMemo, useState } from 'react';
import { Users, PlusCircle, Link2, MessageSquare, Target, BookOpen, Send, LogOut, Check, ArrowRight, Info, Pencil, X, Lock, Cloud, History, StickyNote, Package, Crown } from 'lucide-react';
import { StudyGroup, PassagePointer } from '../types';
import { MemberAvatar } from './CirclePill';
import { Tradition, CanonManifest } from '../services/types';
import { loadManifest } from '../services/manifestService';
import { Button, TextInput, TextArea, Field, Card, Eyebrow, Pill, Select, Segmented, cx } from './ui/primitives';
import type { CircleActor, CircleFocus } from '../services/circleStore';
import { SessionControls, SessionHistory, CircleNotes, CirclePacks } from './CircleStudy';

type HubTab = 'now' | 'history' | 'notes' | 'packs';

interface CollaborativeHubProps {
  groups: StudyGroup[];
  selectedGroupId: string | null;
  displayName: string;
  /** Canon the reader is in — the circle's chapter is chosen from its books. */
  tradition: Tradition;
  /** What the reader has open right now — one tap makes it the circle's chapter. */
  currentPassage: { book: string; chapter: number; label: string };
  /** Verses selected in the reader, if any — attachable to notes and packs. */
  attachable?: PassagePointer | null;
  /** Present when the reader is signed in: circles then live in the cloud. */
  actor?: CircleActor | null;
  onSignIn?: () => void;
  onCreate: (name: string, focus: string) => void;
  /** Returns false when the invite could not be read. */
  onJoin: (inviteOrLink: string) => boolean | Promise<boolean>;
  onSelect: (groupId: string) => void;
  onRename: (groupId: string, name: string, focus: string) => void;
  onSetTargetToCurrent: (groupId: string) => void;
  onSetTarget: (groupId: string, book: string, chapter: number) => void;
  onGoToTarget: (groupId: string) => void;
  onInvite: (groupId: string) => void;
  onAddReflection: (groupId: string, text: string) => void;
  /** Tap the passage chip on a reflection to open those verses. */
  onOpenPointer?: (p: PassagePointer) => void;
  onLeave: (groupId: string) => void;
  onDisplayNameChange: (name: string) => void;
}

/**
 * Study circle: a few people reading the same chapter and saying what stood
 * out. Share an invite, everyone lands on the same passage. Signed-in readers
 * get sessions, history, shared notes and study packs synced across devices.
 */
export const CollaborativeHub: React.FC<CollaborativeHubProps> = ({
  groups, selectedGroupId, displayName, tradition, currentPassage, attachable, actor, onSignIn,
  onCreate, onJoin, onSelect, onRename, onSetTargetToCurrent, onSetTarget, onGoToTarget, onInvite, onAddReflection, onOpenPointer, onLeave, onDisplayNameChange,
}) => {
  const [createForm, setCreateForm] = useState({ name: '', focus: '' });
  const [invite, setInvite] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [reflection, setReflection] = useState('');
  const [showNew, setShowNew] = useState(groups.length === 0);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', focus: '' });
  const [pickingChapter, setPickingChapter] = useState(false);
  const [manifest, setManifest] = useState<CanonManifest | null>(null);
  const [pickBook, setPickBook] = useState<string>('');
  const [pickChapter, setPickChapter] = useState<number>(1);
  const [tab, setTab] = useState<HubTab>('now');

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;
  const isQuran = tradition === 'quran';
  const isCloud = !!(selectedGroup?.cloud && actor);
  const isLeader = isCloud && selectedGroup?.ownerUid === actor?.uid;
  const locked = isCloud && selectedGroup?.status === 'ended';

  useEffect(() => {
    let cancelled = false;
    loadManifest(tradition).then(m => { if (!cancelled) setManifest(m); }).catch(() => { if (!cancelled) setManifest(null); });
    return () => { cancelled = true; };
  }, [tradition]);

  // Reset editors when switching circles
  useEffect(() => {
    setEditing(false);
    setPickingChapter(false);
    setTab('now');
    if (selectedGroup) {
      setEditForm({ name: selectedGroup.name, focus: selectedGroup.focus || '' });
      setPickBook(selectedGroup.targetBook || currentPassage.book);
      setPickChapter(selectedGroup.targetChapter || currentPassage.chapter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  const bookOptions = useMemo(() => (manifest?.books ?? []).map(b => ({ value: b.displayName, label: b.displayName, group: b.section || 'Books', searchText: b.displayName })), [manifest]);
  const pickedBook = manifest?.books.find(b => b.displayName === pickBook);
  const chapterOptions = useMemo(() => {
    const n = isQuran ? 1 : (pickedBook?.chapters.length ?? 1);
    return Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: `Chapter ${i + 1}` }));
  }, [pickedBook, isQuran]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    onCreate(createForm.name.trim(), createForm.focus.trim());
    setCreateForm({ name: '', focus: '' });
    setShowNew(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite.trim()) return;
    setJoining(true);
    try {
      const ok = await onJoin(invite.trim());
      if (ok) { setInvite(''); setInviteError(null); setShowNew(false); }
      else setInviteError(actor ? 'That invite could not be found online. Ask the host to sign in and share a fresh link.' : 'That invite could not be read. Ask for the link again.');
    } finally {
      setJoining(false);
    }
  };

  const handleReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflection.trim() || !selectedGroup) return;
    onAddReflection(selectedGroup.id, reflection.trim());
    setReflection('');
  };

  const onTarget = selectedGroup?.targetBook === currentPassage.book && selectedGroup?.targetChapter === currentPassage.chapter;
  const circleLabel = selectedGroup?.targetLabel || (selectedGroup?.targetBook ? `${selectedGroup.targetBook}${isQuran ? '' : ` ${selectedGroup.targetChapter}`}` : '');

  const currentFocus: CircleFocus = {
    tradition,
    book: currentPassage.book,
    chapter: currentPassage.chapter,
    verses: attachable && attachable.book === currentPassage.book && attachable.chapter === currentPassage.chapter ? attachable.verses : [],
    label: attachable && attachable.book === currentPassage.book && attachable.chapter === currentPassage.chapter ? attachable.label : currentPassage.label,
  };

  const studyCtx = selectedGroup && actor ? { group: selectedGroup, actor, isLeader, currentFocus, onOpenPointer } : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="bg-green-300 border-[3px] border-black rounded-full p-3 shrink-0"><Users className="text-slate-900" /></span>
        <div>
          <h3 className="comic-font text-3xl leading-none">Study circle</h3>
          <p className="text-sm text-slate-600 mt-1">A few people, one chapter, and what stood out to each of you.</p>
        </div>
      </div>

      {/* Sign in to sync */}
      {!actor && onSignIn && (
        <div className="flex items-start gap-3 flex-wrap rounded-2xl border-[3px] border-black bg-blue-50 p-3 shadow-[4px_4px_0_0_#000]">
          <Cloud className="text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-[12rem]">
            <p className="font-black leading-tight">Sign in to read together for real</p>
            <p className="text-xs text-slate-600 mt-0.5">Circles you make while signed in live online: reflections sync between members, sessions and everything you learnt are kept, and you get shared notes and study packs on every device.</p>
          </div>
          <Button size="sm" variant="primary" onClick={onSignIn}><Lock size={14} /> Sign in</Button>
        </div>
      )}

      {/* Your circles */}
      {groups.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <Eyebrow>Your circles</Eyebrow>
            <Button size="xs" variant="ghost" onClick={() => setShowNew(v => !v)}><PlusCircle size={14} /> {showNew ? 'Hide' : 'New or join'}</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {groups.map(group => {
              const active = group.id === selectedGroupId;
              const ended = group.cloud && group.status === 'ended';
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onSelect(group.id)}
                  aria-pressed={active}
                  className={cx(
                    'text-left border-[3px] border-black rounded-2xl p-3 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                    active ? 'bg-slate-900 text-white shadow-[4px_4px_0_0_#000]' : 'bg-white hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-lg leading-tight truncate flex items-center gap-1.5">
                      {group.name}
                      {group.cloud && <Cloud size={12} className={active ? 'text-blue-300' : 'text-blue-500'} aria-label="Synced online" />}
                    </p>
                    {active && <Check size={16} className="shrink-0 text-yellow-300" />}
                  </div>
                  <p className={cx('text-xs', active ? 'text-slate-300' : 'text-slate-500')}>{group.focus || 'Open topic'}</p>
                  <p className={cx('text-[11px] mt-2 flex items-center gap-1.5 flex-wrap', active ? 'text-slate-300' : 'text-slate-500')}>
                    {ended ? <Pill tone="red"><Lock size={10} /> Session ended</Pill> : group.targetBook ? `Reading ${group.targetLabel || `${group.targetBook}${(group.tradition ?? 'protestant') === 'quran' ? '' : ` ${group.targetChapter}`}`}` : 'No chapter set yet'}
                    {group.cloud ? <span>· {group.members.length} member{group.members.length === 1 ? '' : 's'}{group.sessionCount ? ` · session ${group.sessionCount}` : ''}</span> : <span>· {group.reflections.filter(r => r.author !== 'System').length} reflections</span>}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* New or join */}
      {showNew && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <form onSubmit={handleCreate} className="border-[3px] border-black rounded-2xl p-4 bg-white space-y-3 shadow-[4px_4px_0_0_#000]">
            <Eyebrow icon={<PlusCircle size={12} />}>Start a circle</Eyebrow>
            <Field label="Name">
              <TextInput placeholder="e.g. Tuesday group" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required />
            </Field>
            <Field label="What are you reading for?" hint="Optional">
              <TextInput placeholder="e.g. Understanding Genesis" value={createForm.focus} onChange={e => setCreateForm({ ...createForm, focus: e.target.value })} />
            </Field>
            <Button type="submit" variant="dark" block disabled={!createForm.name.trim()}>Create circle</Button>
            {actor && <p className="text-[11px] text-slate-500">You will be the leader: you end sessions and start new ones.</p>}
          </form>

          <form onSubmit={handleJoin} className="border-[3px] border-black rounded-2xl p-4 bg-amber-50 space-y-3 shadow-[4px_4px_0_0_#000]">
            <Eyebrow icon={<Link2 size={12} />} className="text-amber-900">Join with an invite</Eyebrow>
            <Field label="Paste the invite link or code">
              <TextInput
                placeholder="https://… or SC1.…"
                value={invite}
                onChange={e => { setInvite(e.target.value); setInviteError(null); }}
                aria-invalid={!!inviteError}
                className={cx('font-mono text-sm', inviteError && 'ring-4 ring-red-200')}
              />
            </Field>
            {inviteError && <p className="text-xs font-bold text-red-700">{inviteError}</p>}
            <Button type="submit" variant="primary" block disabled={!invite.trim() || joining}>{joining ? 'Joining…' : 'Join'}</Button>
          </form>
        </div>
      )}

      {/* Who am I to the circle */}
      <Field label="Your name in circles" hint="Shown on every reflection you share." className="max-w-sm">
        <TextInput placeholder="How should others see you?" value={displayName} onChange={e => onDisplayNameChange(e.target.value)} />
      </Field>

      {/* Selected circle */}
      {selectedGroup && (
        <Card tone="dark" className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            {editing ? (
              <form
                className="min-w-0 flex-1 space-y-2"
                onSubmit={e => { e.preventDefault(); if (!editForm.name.trim()) return; onRename(selectedGroup.id, editForm.name.trim(), editForm.focus.trim()); setEditing(false); }}
              >
                <Eyebrow className="text-green-300">Rename circle</Eyebrow>
                <TextInput data-autofocus autoFocus value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Circle name" aria-label="Circle name" required />
                <TextInput value={editForm.focus} onChange={e => setEditForm({ ...editForm, focus: e.target.value })} placeholder="What are you reading for? (optional)" aria-label="Focus" />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" variant="primary" disabled={!editForm.name.trim()}><Check size={14} /> Save</Button>
                  <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div className="min-w-0">
                <Eyebrow className="text-green-300">{isCloud ? (isLeader ? 'Circle · you lead it' : 'Circle · synced') : 'Circle · this device'}</Eyebrow>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-2xl leading-tight">{selectedGroup.name}</h4>
                  <button type="button" onClick={() => { setEditForm({ name: selectedGroup.name, focus: selectedGroup.focus || '' }); setEditing(true); }} aria-label="Rename circle" title="Rename" className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"><Pencil size={14} /></button>
                </div>
                <p className="text-sm text-slate-300">{selectedGroup.focus || 'Open topic'}</p>
              </div>
            )}
            {!editing && (
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="primary" onClick={() => onInvite(selectedGroup.id)}><Link2 size={14} /> Copy invite</Button>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => onLeave(selectedGroup.id)}><LogOut size={14} /> Leave</Button>
              </div>
            )}
          </div>

          {isCloud && (
            <Segmented<HubTab>
              ariaLabel="Circle view"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'now', label: 'Now', icon: <Target size={14} /> },
                { value: 'history', label: 'History', icon: <History size={14} /> },
                { value: 'notes', label: 'Notes', icon: <StickyNote size={14} /> },
                { value: 'packs', label: 'Packs', icon: <Package size={14} /> },
              ]}
            />
          )}

          {isCloud && studyCtx && tab === 'history' && <SessionHistory {...studyCtx} />}
          {isCloud && studyCtx && tab === 'notes' && <CircleNotes {...studyCtx} attachable={attachable} />}
          {isCloud && studyCtx && tab === 'packs' && <CirclePacks {...studyCtx} attachable={attachable} />}

          {(!isCloud || tab === 'now') && (
            <>
              {/* Members */}
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <Eyebrow icon={<Users size={12} />} className="text-slate-200">Members · {selectedGroup.members.length}</Eyebrow>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Code {selectedGroup.code}</span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {selectedGroup.members.map((m, i) => {
                    const uid = selectedGroup.memberUids?.[i];
                    const you = isCloud ? uid === actor?.uid : m === (displayName.trim() || 'You');
                    const leads = isCloud && uid === selectedGroup.ownerUid;
                    return (
                      <li key={uid ?? m} className={cx('inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-bold', you ? 'bg-green-400 text-black border-black' : 'bg-white/10 border-white/30 text-white')}>
                        <MemberAvatar name={m} size="xs" you={you} />
                        {m}{you ? ' (you)' : ''}{leads && <Crown size={11} className={you ? 'text-black' : 'text-yellow-300'} aria-label="Leader" />}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-slate-400 mt-2">{isCloud ? 'Everyone who opens the invite while signed in appears here for the whole circle.' : 'People appear here on the device they joined from. Send the invite and they will show up on theirs.'}</p>
              </div>

              {isCloud && studyCtx && <SessionControls {...studyCtx} reflections={selectedGroup.reflections} />}

              {/* Reading together */}
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Eyebrow icon={<Target size={12} />} className="text-slate-200">Reading together</Eyebrow>
                  {!pickingChapter && !locked && (
                    <button type="button" onClick={() => { setPickBook(selectedGroup.targetBook || currentPassage.book); setPickChapter(selectedGroup.targetChapter || currentPassage.chapter); setPickingChapter(true); }} className="text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-white flex items-center gap-1"><Pencil size={12} /> Change</button>
                  )}
                </div>
                {pickingChapter ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={e => { e.preventDefault(); if (!pickBook) return; onSetTarget(selectedGroup.id, pickBook, isQuran ? 1 : pickChapter); setPickingChapter(false); }}
                  >
                    <div className="text-slate-900 min-w-[12rem] flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-1">{isQuran ? 'Surah' : 'Book'}</p>
                      <Select<string>
                        ariaLabel={isQuran ? 'Surah' : 'Book'}
                        searchable
                        width={300}
                        value={pickBook || null}
                        onChange={v => { setPickBook(v); setPickChapter(1); }}
                        options={bookOptions}
                        placeholder={manifest ? `Choose a ${isQuran ? 'surah' : 'book'}…` : 'Loading…'}
                        className="w-full"
                        buttonClassName="w-full"
                      />
                    </div>
                    {!isQuran && (
                      <div className="text-slate-900 w-36">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-1">Chapter</p>
                        <Select<string>
                          ariaLabel="Chapter"
                          width={200}
                          value={String(pickChapter)}
                          onChange={v => setPickChapter(Number(v))}
                          options={chapterOptions}
                          className="w-full"
                          buttonClassName="w-full"
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" variant="primary" disabled={!pickBook}><Check size={14} /> Set</Button>
                      <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setPickingChapter(false)}><X size={14} /></Button>
                    </div>
                    {!onTarget && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => { onSetTargetToCurrent(selectedGroup.id); setPickingChapter(false); }}>
                        <Target size={14} /> Use {currentFocus.label}
                      </Button>
                    )}
                  </form>
                ) : selectedGroup.targetBook ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="font-black text-lg">{circleLabel}</p>
                    {onTarget ? (
                      <Pill tone="green"><Check size={12} /> You are on it</Pill>
                    ) : (
                      <Button size="sm" variant="primary" onClick={() => onGoToTarget(selectedGroup.id)}><BookOpen size={14} /> Open it <ArrowRight size={14} /></Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm text-slate-200">No chapter set yet.</p>
                    {!locked && <Button size="sm" variant="secondary" onClick={() => onSetTargetToCurrent(selectedGroup.id)}><Target size={14} /> Use {currentFocus.label}</Button>}
                  </div>
                )}
                {!pickingChapter && !locked && onTarget && currentFocus.verses && currentFocus.verses.length > 0 && selectedGroup.targetLabel !== currentFocus.label && (
                  <Button size="xs" variant="secondary" onClick={() => onSetTargetToCurrent(selectedGroup.id)}><Target size={12} /> Focus everyone on {currentFocus.label}</Button>
                )}
              </div>

              <div className="bg-white rounded-2xl p-4 text-slate-900 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="text-purple-600" />
                  <div>
                    <Eyebrow>Reflections{isCloud && selectedGroup.sessionCount ? ` · session ${selectedGroup.sessionCount}` : ''}</Eyebrow>
                    <p className="font-black text-lg leading-tight">What stood out?</p>
                  </div>
                </div>
                {locked ? (
                  <p className="text-sm font-bold text-red-800 bg-red-50 border-2 border-red-200 rounded-xl px-3 py-2 flex items-center gap-2"><Lock size={14} /> The session has ended. Reflections are locked until the leader starts the next one.</p>
                ) : (
                  <form onSubmit={handleReflection} className="space-y-2">
                    <TextArea
                      placeholder={`A verse, a question, a thought${displayName ? `, ${displayName}` : ''}…`}
                      value={reflection}
                      onChange={e => setReflection(e.target.value)}
                      onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleReflection(e); }}
                    />
                    <Button type="submit" variant="accent" block disabled={!reflection.trim()}><Send size={16} /> Share as {displayName || 'You'}</Button>
                  </form>
                )}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {selectedGroup.reflections.length === 0 ? (
                    <p className="text-sm text-slate-500">No reflections yet. Yours could be the first.</p>
                  ) : (
                    selectedGroup.reflections.slice().reverse().map(entry => (
                      <div key={entry.id} className={cx('rounded-2xl p-3 border-2', entry.author === 'System' ? 'border-dashed border-slate-200 text-slate-500' : 'border-slate-200')}>
                        {entry.author !== 'System' && (
                          <p className="text-[11px] font-black uppercase tracking-widest text-purple-700 flex items-center gap-1.5 flex-wrap">
                            <MemberAvatar name={entry.author} size="xs" you={entry.author === (displayName.trim() || 'You')} /> {entry.author}
                            {entry.ref && (
                              onOpenPointer ? (
                                <button type="button" onClick={() => onOpenPointer(entry.ref!)} title="Open these verses" className="normal-case tracking-normal px-1.5 py-0.5 rounded bg-yellow-200 border border-yellow-500 text-slate-900 text-[10px] hover:bg-yellow-300">{entry.ref.label}</button>
                              ) : (
                                <span className="normal-case tracking-normal px-1.5 py-0.5 rounded bg-yellow-200 border border-yellow-500 text-slate-900 text-[10px]">{entry.ref.label}</span>
                              )
                            )}
                          </p>
                        )}
                        <p className="text-sm mt-0.5">{entry.text}</p>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1.5">{new Date(entry.createdAt).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-[11px] text-slate-500 flex items-start gap-1.5"><Info size={12} className="shrink-0 mt-0.5" /> {isCloud
                  ? 'Reflections sync live for everyone in the circle. Earlier sessions live under History.'
                  : 'Invites carry the circle and its chapter to any device. Reflections are saved on the device they were written on; sign in to sync them with the circle.'}</p>
              </div>
            </>
          )}
        </Card>
      )}

      {groups.length === 0 && !showNew && (
        <Button variant="success" onClick={() => setShowNew(true)}><PlusCircle size={16} /> Start or join a circle</Button>
      )}
    </div>
  );
};
