import { describe, it, expect } from 'vitest';
import { encodeInvite, decodeInvite, inviteUrl, generateCircleCode } from '../services/circles';
import { StudyGroup } from '../types';

const group: StudyGroup = {
  id: 'group-1',
  name: 'Tuesday group — Génesis & friends',
  focus: 'Understanding Genesis',
  code: 'AB3K9Z',
  members: ['Pilgrim'],
  createdAt: new Date().toISOString(),
  tradition: 'protestant',
  targetBook: 'Genesis',
  targetChapter: 12,
  reflections: [],
};

describe('circle invites', () => {
  it('round-trips name, focus, canon and the shared chapter', () => {
    const invite = encodeInvite(group);
    expect(invite.startsWith('SC1.')).toBe(true);
    const back = decodeInvite(invite);
    expect(back).toEqual({ code: 'AB3K9Z', name: group.name, focus: group.focus, tradition: 'protestant', targetBook: 'Genesis', targetChapter: 12 });
  });

  it('accepts a full invite link', () => {
    const url = inviteUrl(group);
    expect(url).toContain('?circle=SC1.');
    expect(decodeInvite(url)?.code).toBe('AB3K9Z');
  });

  it('refuses things that are not invites', () => {
    expect(decodeInvite('')).toBeNull();
    expect(decodeInvite('GSAE')).toBeNull();
    expect(decodeInvite('SC1.not-base64!!')).toBeNull();
    expect(decodeInvite('https://example.com/?circle=SC1.e30')).toBeNull(); // {} has no code/name
  });

  it('omits the chapter when none is set', () => {
    const back = decodeInvite(encodeInvite({ ...group, targetBook: undefined, targetChapter: undefined }));
    expect(back?.targetBook).toBeUndefined();
    expect(back?.targetChapter).toBeUndefined();
  });

  it('generates readable six-character codes', () => {
    const code = generateCircleCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe('member colours', () => {
  it('gives the same name the same colour and readable initials', async () => {
    const { memberColor, memberInitials } = await import('../services/circles');
    expect(memberColor('Thandi')).toEqual(memberColor('thandi '));
    expect(memberColor('Thandi').hex).toMatch(/^#/);
    expect(memberInitials('Thandi Ngcobo')).toBe('TN');
    expect(memberInitials('shaun')).toBe('S');
    expect(memberInitials('')).toBe('?');
  });
});
