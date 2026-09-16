import { describe, it, expect } from 'vitest';
import { PRODUCTS, passDaysFor, formatRand, sponsorshipKey, GIFT_MIN, GIFT_MAX } from '../shared/products';

describe('product catalogue', () => {
  it('prices are whole cents and the passes are ordered', () => {
    expect(PRODUCTS['pass-month'].amount).toBe(2900);
    expect(PRODUCTS['pass-year'].amount).toBe(29000);
    expect(PRODUCTS['sponsor-chapter'].amount).toBe(7500);
    expect(PRODUCTS.gift.amount).toBeNull();
    expect(GIFT_MIN).toBeLessThan(GIFT_MAX);
  });

  it('grants Supporter days by what was actually paid', () => {
    expect(passDaysFor('pass-month', 2900)).toBe(31);
    expect(passDaysFor('pass-year', 29000)).toBe(366);
    expect(passDaysFor('sponsor-chapter', 7500)).toBe(31);
    expect(passDaysFor('gift', 2000)).toBe(0);
    expect(passDaysFor('gift', 2900)).toBe(31);
    expect(passDaysFor('gift', 50000)).toBe(366);
  });

  it('formats rand the way the page says it', () => {
    expect(formatRand(2900)).toBe('R29');
    expect(formatRand(750)).toBe('R7.50');
    expect(formatRand(29000)).toBe('R290');
  });

  it('keys a sponsorship by tradition, book and chapter', () => {
    expect(sponsorshipKey({ tradition: 'protestant', bookSlug: 'genesis', bookName: 'Genesis', chapter: 3 })).toBe('protestant__genesis__3');
  });
});
