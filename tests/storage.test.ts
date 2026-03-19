import { describe, it, expect, beforeEach, vi } from 'vitest';

// Replicate safeRead logic for unit testing (same implementation as App.tsx)
function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Replicate safeWrite logic for unit testing (same implementation as App.tsx)
function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[storage] write failed for key "${key}"`, err);
  }
}

// In-memory localStorage mock (avoids jsdom opaque-origin restriction)
function makeLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
}

describe('safeRead (localStorage safety)', () => {
  const mockStorage = makeLocalStorageMock();

  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage);
    mockStorage.clear();
  });

  it('returns fallback when key is missing', () => {
    expect(safeRead('nonexistent', 'default')).toBe('default');
  });

  it('returns fallback when JSON is corrupt', () => {
    localStorage.setItem('corrupt', '{invalid json!!!');
    expect(safeRead('corrupt', { safe: true })).toEqual({ safe: true });
  });

  it('returns parsed value for valid JSON', () => {
    localStorage.setItem('valid', JSON.stringify({ count: 42 }));
    expect(safeRead<{ count: number }>('valid', { count: 0 })).toEqual({ count: 42 });
  });

  it('returns fallback for empty string value', () => {
    localStorage.setItem('empty', '');
    expect(safeRead('empty', 'fallback')).toBe('fallback');
  });

  it('handles array values correctly', () => {
    localStorage.setItem('arr', JSON.stringify([1, 2, 3]));
    expect(safeRead<number[]>('arr', [])).toEqual([1, 2, 3]);
  });

  it('returns null fallback when key missing and fallback is null', () => {
    expect(safeRead<null>('missing', null)).toBeNull();
  });

  it('handles boolean values', () => {
    localStorage.setItem('flag', JSON.stringify(true));
    expect(safeRead<boolean>('flag', false)).toBe(true);
  });
});

describe('safeWrite (localStorage safety)', () => {
  const mockStorage = makeLocalStorageMock();

  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage);
    mockStorage.clear();
  });

  it('stores object as JSON string', () => {
    safeWrite('obj', { name: 'test', count: 5 });
    const raw = localStorage.getItem('obj');
    expect(raw).toBe(JSON.stringify({ name: 'test', count: 5 }));
  });

  it('stores arrays correctly', () => {
    safeWrite('arr', [1, 2, 3]);
    const raw = localStorage.getItem('arr');
    expect(JSON.parse(raw!)).toEqual([1, 2, 3]);
  });

  it('round-trips data through safeRead after safeWrite', () => {
    const data = { streak: 7, xp: 350, tier: 'FREE' };
    safeWrite('stats', data);
    const result = safeRead<typeof data>('stats', { streak: 0, xp: 0, tier: 'FREE' });
    expect(result).toEqual(data);
  });
});
