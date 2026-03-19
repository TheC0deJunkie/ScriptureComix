import { describe, it, expect } from 'vitest';
import { findBookSlug } from '../services/manifestService';
import type { CanonManifest } from '../services/types';

describe('findBookSlug', () => {
  const mockManifest: CanonManifest = {
    tradition: 'protestant',
    displayName: 'Protestant',
    books: [
      { slug: 'genesis', displayName: 'Genesis', section: 'Old Testament', chapters: [31, 25] },
      { slug: 'exodus', displayName: 'Exodus', section: 'Old Testament', chapters: [22, 25] },
      { slug: 'psalms', displayName: 'Psalms', section: 'Wisdom Literature', chapters: [150] },
    ],
    translations: [{ id: 'kjv', displayName: 'King James Version', isPublicDomain: true }],
  };

  it('returns slug for matching display name', () => {
    expect(findBookSlug(mockManifest, 'Genesis')).toBe('genesis');
  });

  it('returns slug for another valid book', () => {
    expect(findBookSlug(mockManifest, 'Exodus')).toBe('exodus');
  });

  it('returns undefined for non-existent book', () => {
    expect(findBookSlug(mockManifest, 'Nonexistent')).toBeUndefined();
  });

  it('is case-sensitive (display name must match exactly)', () => {
    expect(findBookSlug(mockManifest, 'genesis')).toBeUndefined();
  });
});

describe('manifest schema', () => {
  it('manifest includes book names and chapter counts', () => {
    const fs = require('fs');
    if (fs.existsSync('public/data/protestant/manifest.json')) {
      const manifest = JSON.parse(fs.readFileSync('public/data/protestant/manifest.json', 'utf-8'));
      expect(manifest.tradition).toBe('protestant');
      expect(manifest.books.length).toBe(66);
      expect(manifest.books[0]).toHaveProperty('slug');
      expect(manifest.books[0]).toHaveProperty('displayName');
      expect(manifest.books[0]).toHaveProperty('chapters');
      expect(Array.isArray(manifest.books[0].chapters)).toBe(true);
    }
  });

  it('manifestService exports required functions', async () => {
    const { loadManifest, loadAllManifests, findBookSlug: fbs } = await import('../services/manifestService');
    expect(typeof loadManifest).toBe('function');
    expect(typeof loadAllManifests).toBe('function');
    expect(typeof fbs).toBe('function');
  });
});
