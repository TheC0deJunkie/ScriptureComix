/**
 * Firestore-backed study circles. Used only for signed-in readers; signed-out
 * readers keep the device-only circles in App.tsx.
 *
 * Layout (rules in firestore.rules):
 *
 *   codes/{CODE}                                   -> { circleId }   invite lookup
 *   circles/{circleId}                             -> circle + members + current focus + session pointer
 *   circles/{circleId}/sessions/{sessionId}        -> one sitting: passages, summary, takeaways
 *   circles/{circleId}/sessions/{sid}/reflections  -> what people said during that sitting
 *   circles/{circleId}/notes/{noteId}              -> shared notes (any time)
 *   circles/{circleId}/packs/{packId}              -> study packs the circle builds
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteField,
  increment,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getDb } from './firebase';
import { generateCircleCode } from './circles';
import type { StudyGroup, StudySession, ReflectionEntry, PassagePointer, CircleNote, StudyPack } from '../types';

export interface CircleActor {
  uid: string;
  /** Display name at the time of the action; stored on the record so it survives renames. */
  alias: string;
}

export interface CircleFocus {
  tradition?: string;
  book: string;
  chapter: number;
  verses?: number[];
  label: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const circlesCol = () => collection(getDb(), 'circles');
const circleRef = (id: string) => doc(getDb(), 'circles', id);
const codeRef = (code: string) => doc(getDb(), 'codes', code.toUpperCase());
const sessionsCol = (circleId: string) => collection(getDb(), 'circles', circleId, 'sessions');
const sessionRef = (circleId: string, sessionId: string) => doc(getDb(), 'circles', circleId, 'sessions', sessionId);
const reflectionsCol = (circleId: string, sessionId: string) => collection(getDb(), 'circles', circleId, 'sessions', sessionId, 'reflections');
const notesCol = (circleId: string) => collection(getDb(), 'circles', circleId, 'notes');
const packsCol = (circleId: string) => collection(getDb(), 'circles', circleId, 'packs');

const toIso = (v: unknown): string => {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
};

/** Firestore rejects `undefined`; drop those keys before writing. */
const clean = <T extends Record<string, unknown>>(o: T): T => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
};

const pointerFromFocus = (f: CircleFocus): PassagePointer =>
  clean({ tradition: f.tradition, book: f.book, chapter: f.chapter, verses: f.verses ?? [], label: f.label }) as PassagePointer;

const sysEntry = (text: string) => ({ authorUid: 'system', author: 'System', text, createdAt: serverTimestamp() });

/** Maps a circle document to the StudyGroup shape the app already renders. */
export function circleFromDoc(snap: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }): StudyGroup {
  const d = snap.data();
  const members: Record<string, { name?: string }> = d.members ?? {};
  const memberUids: string[] = Array.isArray(d.memberUids) ? d.memberUids : [];
  return {
    id: snap.id,
    cloud: true,
    name: d.name ?? 'Circle',
    focus: d.focus ?? '',
    code: d.code ?? '',
    members: memberUids.map(uid => members[uid]?.name || 'Member'),
    memberUids,
    ownerUid: d.ownerUid,
    createdAt: toIso(d.createdAt),
    tradition: d.tradition,
    targetBook: d.targetBook,
    targetChapter: d.targetChapter,
    targetVerses: Array.isArray(d.targetVerses) ? d.targetVerses : undefined,
    targetLabel: d.targetLabel,
    status: d.status === 'ended' ? 'ended' : 'active',
    currentSessionId: d.currentSessionId ?? null,
    sessionCount: d.sessionCount ?? 0,
    endedAt: d.endedAt ? toIso(d.endedAt) : undefined,
    reflections: [],
  };
}

const sessionFromDoc = (snap: QueryDocumentSnapshot<DocumentData>): StudySession => {
  const d = snap.data();
  return {
    id: snap.id,
    number: d.number ?? 0,
    title: d.title ?? `Session ${d.number ?? ''}`.trim(),
    status: d.status === 'closed' ? 'closed' : 'open',
    startedAt: toIso(d.startedAt),
    startedBy: d.startedBy ?? '',
    endedAt: d.endedAt ? toIso(d.endedAt) : undefined,
    endedBy: d.endedBy,
    passages: Array.isArray(d.passages) ? d.passages : [],
    summary: d.summary ?? '',
    takeaways: Array.isArray(d.takeaways) ? d.takeaways : [],
    reflectionCount: d.reflectionCount ?? 0,
  };
};

const reflectionFromDoc = (snap: QueryDocumentSnapshot<DocumentData>): ReflectionEntry => {
  const d = snap.data();
  return { id: snap.id, author: d.author ?? 'Member', text: d.text ?? '', createdAt: toIso(d.createdAt), ...(d.ref ? { ref: d.ref } : {}) };
};

const noteFromDoc = (snap: QueryDocumentSnapshot<DocumentData>): CircleNote => {
  const d = snap.data();
  return {
    id: snap.id,
    authorUid: d.authorUid ?? '',
    author: d.author ?? 'Member',
    title: d.title ?? '',
    body: d.body ?? '',
    ...(d.ref ? { ref: d.ref } : {}),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
};

const packFromDoc = (snap: QueryDocumentSnapshot<DocumentData>): StudyPack => {
  const d = snap.data();
  return {
    id: snap.id,
    title: d.title ?? 'Study pack',
    description: d.description ?? '',
    passages: Array.isArray(d.passages) ? d.passages : [],
    questions: Array.isArray(d.questions) ? d.questions : [],
    notes: d.notes ?? '',
    createdByUid: d.createdByUid ?? '',
    createdBy: d.createdBy ?? 'Member',
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
};

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/** Every circle the reader belongs to, most recently active first. */
export function subscribeMyCircles(uid: string, cb: (groups: StudyGroup[]) => void, onError?: (e: unknown) => void): () => void {
  const q = query(circlesCol(), where('memberUids', 'array-contains', uid));
  return onSnapshot(
    q,
    snap => {
      const groups = snap.docs.map(circleFromDoc);
      const at = (s: QueryDocumentSnapshot<DocumentData>) => toIso(s.data().updatedAt ?? s.data().createdAt);
      const order = new Map(snap.docs.map(s => [s.id, at(s)]));
      groups.sort((a, b) => (order.get(b.id) ?? '').localeCompare(order.get(a.id) ?? ''));
      cb(groups);
    },
    err => { console.warn('[circles] subscription failed', err); onError?.(err); },
  );
}

export function subscribeSessions(circleId: string, cb: (sessions: StudySession[]) => void): () => void {
  const q = query(sessionsCol(circleId), orderBy('number', 'desc'));
  return onSnapshot(q, snap => cb(snap.docs.map(sessionFromDoc)), err => console.warn('[circles] sessions failed', err));
}

export function subscribeReflections(circleId: string, sessionId: string, cb: (entries: ReflectionEntry[]) => void): () => void {
  const q = query(reflectionsCol(circleId, sessionId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snap => cb(snap.docs.map(reflectionFromDoc)), err => console.warn('[circles] reflections failed', err));
}

export async function loadReflections(circleId: string, sessionId: string): Promise<ReflectionEntry[]> {
  const snap = await getDocs(query(reflectionsCol(circleId, sessionId), orderBy('createdAt', 'asc')));
  return snap.docs.map(reflectionFromDoc);
}

export function subscribeNotes(circleId: string, cb: (notes: CircleNote[]) => void): () => void {
  const q = query(notesCol(circleId), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, snap => cb(snap.docs.map(noteFromDoc)), err => console.warn('[circles] notes failed', err));
}

export function subscribePacks(circleId: string, cb: (packs: StudyPack[]) => void): () => void {
  const q = query(packsCol(circleId), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, snap => cb(snap.docs.map(packFromDoc)), err => console.warn('[circles] packs failed', err));
}

// ---------------------------------------------------------------------------
// Circle lifecycle
// ---------------------------------------------------------------------------

export async function createCircle(actor: CircleActor, name: string, focus: string, at: CircleFocus): Promise<string> {
  const db = getDb();
  const circle = doc(circlesCol());
  const session = doc(sessionsCol(circle.id));
  const code = generateCircleCode();
  const batch = writeBatch(db);
  batch.set(circle, clean({
    name,
    focus,
    code,
    ownerUid: actor.uid,
    memberUids: [actor.uid],
    members: { [actor.uid]: { name: actor.alias, joinedAt: serverTimestamp() } },
    tradition: at.tradition,
    targetBook: at.book,
    targetChapter: at.chapter,
    targetVerses: at.verses ?? [],
    targetLabel: at.label,
    status: 'active',
    currentSessionId: session.id,
    sessionCount: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  batch.set(codeRef(code), { circleId: circle.id, createdAt: serverTimestamp() });
  batch.set(session, {
    number: 1,
    title: 'Session 1',
    status: 'open',
    startedAt: serverTimestamp(),
    startedBy: actor.alias,
    startedByUid: actor.uid,
    passages: [pointerFromFocus(at)],
    summary: '',
    takeaways: [],
    reflectionCount: 0,
  });
  batch.set(doc(reflectionsCol(circle.id, session.id)), sysEntry(`${actor.alias} started this circle on ${at.label}.`));
  await batch.commit();
  return circle.id;
}

export class CircleNotFoundError extends Error {
  constructor() { super('No online circle has that code.'); this.name = 'CircleNotFoundError'; }
}

/** Joins by invite code. Resolves the circle id; throws CircleNotFoundError when the code is unknown. */
export async function joinCircleByCode(actor: CircleActor, code: string): Promise<{ id: string; group: StudyGroup }> {
  const lookup = await getDoc(codeRef(code));
  if (!lookup.exists()) throw new CircleNotFoundError();
  const circleId = lookup.data().circleId as string;
  const snap = await getDoc(circleRef(circleId));
  if (!snap.exists()) throw new CircleNotFoundError();
  const data = snap.data();
  const already = Array.isArray(data.memberUids) && data.memberUids.includes(actor.uid);
  if (!already) {
    await updateDoc(circleRef(circleId), {
      memberUids: arrayUnion(actor.uid),
      [`members.${actor.uid}`]: { name: actor.alias, joinedAt: serverTimestamp() },
      updatedAt: serverTimestamp(),
    });
    if (data.currentSessionId && data.status !== 'ended') {
      addDoc(reflectionsCol(circleId, data.currentSessionId), sysEntry(`${actor.alias} joined the circle.`)).catch(() => {});
    }
  }
  const fresh = await getDoc(circleRef(circleId));
  return { id: circleId, group: circleFromDoc({ id: circleId, data: () => fresh.data() ?? data }) };
}

export async function leaveCircle(actor: CircleActor, circleId: string): Promise<void> {
  await runTransaction(getDb(), async tx => {
    const snap = await tx.get(circleRef(circleId));
    if (!snap.exists()) return;
    const d = snap.data();
    const remaining: string[] = (d.memberUids ?? []).filter((u: string) => u !== actor.uid);
    const update: DocumentData = {
      memberUids: arrayRemove(actor.uid),
      [`members.${actor.uid}`]: deleteField(),
      updatedAt: serverTimestamp(),
    };
    // The leader handing over on the way out keeps the circle alive for everyone else.
    if (d.ownerUid === actor.uid && remaining.length) update.ownerUid = remaining[0];
    tx.update(circleRef(circleId), update);
  });
}

export async function renameCircle(circleId: string, name: string, focus: string): Promise<void> {
  await updateDoc(circleRef(circleId), { name, focus, updatedAt: serverTimestamp() });
}

/** Moves the circle's focus (chapter or verses) and logs it on the open session. */
export async function setCircleFocus(actor: CircleActor, circleId: string, at: CircleFocus): Promise<void> {
  await runTransaction(getDb(), async tx => {
    const snap = await tx.get(circleRef(circleId));
    if (!snap.exists()) throw new Error('Circle not found');
    const d = snap.data();
    tx.update(circleRef(circleId), clean({
      tradition: at.tradition,
      targetBook: at.book,
      targetChapter: at.chapter,
      targetVerses: at.verses ?? [],
      targetLabel: at.label,
      updatedAt: serverTimestamp(),
    }));
    if (d.currentSessionId && d.status !== 'ended') {
      const sRef = sessionRef(circleId, d.currentSessionId);
      const sSnap = await tx.get(sRef);
      const passages: PassagePointer[] = sSnap.exists() && Array.isArray(sSnap.data().passages) ? sSnap.data().passages : [];
      const last = passages[passages.length - 1];
      const next = pointerFromFocus(at);
      if (!last || last.label !== next.label) tx.update(sRef, { passages: [...passages, next] });
      tx.set(doc(reflectionsCol(circleId, d.currentSessionId)), sysEntry(`Now reading ${at.label}.`));
    }
  });
}

export class SessionLockedError extends Error {
  constructor() { super('This session has ended. The leader can start a new one.'); this.name = 'SessionLockedError'; }
}

export async function addReflection(actor: CircleActor, group: StudyGroup, text: string, ref?: PassagePointer): Promise<void> {
  if (group.status === 'ended' || !group.currentSessionId) throw new SessionLockedError();
  const sessionId = group.currentSessionId;
  const batch = writeBatch(getDb());
  batch.set(doc(reflectionsCol(group.id, sessionId)), clean({
    authorUid: actor.uid,
    author: actor.alias,
    text,
    ref: ref ? clean(ref as unknown as Record<string, unknown>) : undefined,
    createdAt: serverTimestamp(),
  }));
  batch.update(sessionRef(group.id, sessionId), { reflectionCount: increment(1) });
  batch.update(circleRef(group.id), { updatedAt: serverTimestamp() });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Leader only (rules enforce it): closes the open session and locks the circle for everyone. */
export async function endSession(actor: CircleActor, circleId: string, wrapUp: { summary: string; takeaways: string[] }): Promise<void> {
  await runTransaction(getDb(), async tx => {
    const snap = await tx.get(circleRef(circleId));
    if (!snap.exists()) throw new Error('Circle not found');
    const d = snap.data();
    if (d.currentSessionId) {
      tx.update(sessionRef(circleId, d.currentSessionId), {
        status: 'closed',
        endedAt: serverTimestamp(),
        endedBy: actor.alias,
        endedByUid: actor.uid,
        summary: wrapUp.summary,
        takeaways: wrapUp.takeaways,
      });
    }
    tx.update(circleRef(circleId), { status: 'ended', endedAt: serverTimestamp(), endedBy: actor.uid, updatedAt: serverTimestamp() });
  });
}

/** Leader only: opens a fresh session at the given passage and unlocks the circle. */
export async function startSession(actor: CircleActor, circleId: string, title: string, at: CircleFocus): Promise<string> {
  const session = doc(sessionsCol(circleId));
  await runTransaction(getDb(), async tx => {
    const snap = await tx.get(circleRef(circleId));
    if (!snap.exists()) throw new Error('Circle not found');
    const number = (snap.data().sessionCount ?? 0) + 1;
    tx.set(session, {
      number,
      title: title.trim() || `Session ${number}`,
      status: 'open',
      startedAt: serverTimestamp(),
      startedBy: actor.alias,
      startedByUid: actor.uid,
      passages: [pointerFromFocus(at)],
      summary: '',
      takeaways: [],
      reflectionCount: 0,
    });
    tx.set(doc(reflectionsCol(circleId, session.id)), sysEntry(`${actor.alias} started ${title.trim() || `session ${number}`} on ${at.label}.`));
    tx.update(circleRef(circleId), clean({
      status: 'active',
      currentSessionId: session.id,
      sessionCount: number,
      endedAt: deleteField(),
      endedBy: deleteField(),
      tradition: at.tradition,
      targetBook: at.book,
      targetChapter: at.chapter,
      targetVerses: at.verses ?? [],
      targetLabel: at.label,
      updatedAt: serverTimestamp(),
    }));
  });
  return session.id;
}

/** Any member can improve what a past session recorded. */
export async function updateSessionWrapUp(circleId: string, sessionId: string, wrapUp: { title?: string; summary: string; takeaways: string[] }): Promise<void> {
  await updateDoc(sessionRef(circleId, sessionId), clean({ title: wrapUp.title, summary: wrapUp.summary, takeaways: wrapUp.takeaways }));
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addNote(actor: CircleActor, circleId: string, note: { title: string; body: string; ref?: PassagePointer }): Promise<string> {
  const ref = await addDoc(notesCol(circleId), clean({
    authorUid: actor.uid,
    author: actor.alias,
    title: note.title,
    body: note.body,
    ref: note.ref ? clean(note.ref as unknown as Record<string, unknown>) : undefined,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return ref.id;
}

export async function updateNote(circleId: string, noteId: string, note: { title: string; body: string }): Promise<void> {
  await updateDoc(doc(notesCol(circleId), noteId), { title: note.title, body: note.body, updatedAt: serverTimestamp() });
}

export async function deleteNote(circleId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(notesCol(circleId), noteId));
}

// ---------------------------------------------------------------------------
// Study packs
// ---------------------------------------------------------------------------

export type StudyPackInput = Pick<StudyPack, 'title' | 'description' | 'passages' | 'questions' | 'notes'>;

export async function createPack(actor: CircleActor, circleId: string, pack: StudyPackInput): Promise<string> {
  const ref = await addDoc(packsCol(circleId), {
    ...pack,
    passages: pack.passages.map(p => clean(p as unknown as Record<string, unknown>)),
    createdByUid: actor.uid,
    createdBy: actor.alias,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePack(circleId: string, packId: string, pack: StudyPackInput): Promise<void> {
  await updateDoc(doc(packsCol(circleId), packId), {
    ...pack,
    passages: pack.passages.map(p => clean(p as unknown as Record<string, unknown>)),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePack(circleId: string, packId: string): Promise<void> {
  await deleteDoc(doc(packsCol(circleId), packId));
}

/** Everything a circle has learnt, flattened for export or display. */
export async function loadCircleHistory(circleId: string): Promise<Array<StudySession & { reflections: ReflectionEntry[] }>> {
  const sessions = await getDocs(query(sessionsCol(circleId), orderBy('number', 'desc')));
  return Promise.all(sessions.docs.map(async s => ({ ...sessionFromDoc(s), reflections: await loadReflections(circleId, s.id) })));
}

/** Builds a one-file, human-readable record of a session for sharing or printing. */
export function sessionToMarkdown(circleName: string, session: StudySession, reflections: ReflectionEntry[]): string {
  const lines: string[] = [];
  lines.push(`# ${circleName} · ${session.title}`);
  lines.push(`Started ${new Date(session.startedAt).toLocaleString()}${session.endedAt ? ` · Ended ${new Date(session.endedAt).toLocaleString()}` : ''}`);
  if (session.passages.length) lines.push('', '## Passages', ...session.passages.map(p => `- ${p.label}`));
  if (session.summary.trim()) lines.push('', '## Summary', session.summary.trim());
  if (session.takeaways.length) lines.push('', '## What we learnt', ...session.takeaways.map(t => `- ${t}`));
  const said = reflections.filter(r => r.author !== 'System');
  if (said.length) lines.push('', '## Reflections', ...said.map(r => `- **${r.author}**${r.ref ? ` (${r.ref.label})` : ''}: ${r.text}`));
  return lines.join('\n');
}
