import { describe, it, expect } from 'vitest';
import { circleFromDoc, sessionToMarkdown } from '../services/circleStore';
import type { StudySession, ReflectionEntry } from '../types';

describe('circleFromDoc', () => {
  it('maps a Firestore circle into the StudyGroup shape the app renders', () => {
    const group = circleFromDoc({
      id: 'c1',
      data: () => ({
        name: 'Tuesday group',
        focus: 'Exodus',
        code: 'ABC234',
        ownerUid: 'u1',
        memberUids: ['u1', 'u2'],
        members: { u1: { name: 'Thandi' }, u2: { name: 'Sipho' } },
        tradition: 'protestant',
        targetBook: 'Exodus',
        targetChapter: 4,
        targetVerses: [1, 2, 3],
        targetLabel: 'Exodus 4:1-3',
        status: 'ended',
        currentSessionId: 's2',
        sessionCount: 2,
        createdAt: '2026-09-01T00:00:00.000Z',
      }),
    });
    expect(group.cloud).toBe(true);
    expect(group.members).toEqual(['Thandi', 'Sipho']);
    expect(group.memberUids).toEqual(['u1', 'u2']);
    expect(group.ownerUid).toBe('u1');
    expect(group.status).toBe('ended');
    expect(group.currentSessionId).toBe('s2');
    expect(group.targetLabel).toBe('Exodus 4:1-3');
    expect(group.reflections).toEqual([]);
  });

  it('defaults sensibly when fields are missing', () => {
    const group = circleFromDoc({ id: 'c2', data: () => ({ name: 'Bare' }) });
    expect(group.status).toBe('active');
    expect(group.members).toEqual([]);
    expect(group.sessionCount).toBe(0);
    expect(group.currentSessionId).toBeNull();
  });
});

describe('sessionToMarkdown', () => {
  const session: StudySession = {
    id: 's1',
    number: 1,
    title: 'Session 1',
    status: 'closed',
    startedAt: '2026-09-10T18:00:00.000Z',
    startedBy: 'Thandi',
    endedAt: '2026-09-10T19:00:00.000Z',
    endedBy: 'Thandi',
    passages: [{ book: 'Exodus', chapter: 4, verses: [], label: 'Exodus 4' }],
    summary: 'We read the call of Moses.',
    takeaways: ['Doubt is answered with signs', 'Aaron speaks for Moses'],
    reflectionCount: 2,
  };
  const reflections: ReflectionEntry[] = [
    { id: 'r0', author: 'System', text: 'Thandi started this circle on Exodus 4.', createdAt: '2026-09-10T18:00:00.000Z' },
    { id: 'r1', author: 'Sipho', text: 'The staff becoming a snake stood out.', createdAt: '2026-09-10T18:10:00.000Z', ref: { book: 'Exodus', chapter: 4, verses: [3], label: 'Exodus 4:3' } },
  ];

  it('keeps passages, summary, takeaways and member reflections, but not system lines', () => {
    const md = sessionToMarkdown('Tuesday group', session, reflections);
    expect(md).toContain('# Tuesday group · Session 1');
    expect(md).toContain('- Exodus 4');
    expect(md).toContain('We read the call of Moses.');
    expect(md).toContain('- Doubt is answered with signs');
    expect(md).toContain('**Sipho** (Exodus 4:3): The staff becoming a snake stood out.');
    expect(md).not.toContain('started this circle');
  });
});
