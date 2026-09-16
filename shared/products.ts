/**
 * The catalogue — shared by the browser (to show prices) and the Vercel
 * functions (to charge them). Amounts are in cents, ZAR only: Yoco is a South
 * African acquirer and settles in rand.
 *
 * Reading, every translation and every language stay free. What is sold is
 * the generated extras and the community layer, and a way to fund a chapter.
 */
export type Sku = 'pass-month' | 'pass-year' | 'sponsor-chapter' | 'gift';

export interface Product {
  sku: Sku;
  title: string;
  blurb: string;
  /** Cents. `null` means the buyer chooses (gift). */
  amount: number | null;
  /** Days of Supporter granted on payment. */
  passDays: number;
}

export const CURRENCY = 'ZAR';

export const PRODUCTS: Record<Sku, Product> = {
  'pass-month': {
    sku: 'pass-month',
    title: 'Supporter · 1 month',
    blurb: 'All art styles, offline packs and PDF downloads, and a supporter badge in circles.',
    amount: 2900,
    passDays: 31,
  },
  'pass-year': {
    sku: 'pass-year',
    title: 'Supporter · 1 year',
    blurb: 'The same, for a year. Two months free.',
    amount: 29000,
    passDays: 366,
  },
  'sponsor-chapter': {
    sku: 'sponsor-chapter',
    title: 'Sponsor a chapter',
    blurb: 'Fund the pictures, notes and quiz for one chapter. Your name stays on it for everyone who reads it.',
    amount: 7500,
    passDays: 31,
  },
  gift: {
    sku: 'gift',
    title: 'Gift',
    blurb: 'Once-off, any amount. R29 or more also gives you a month of Supporter.',
    amount: null,
    passDays: 0,
  },
};

/** Gift bounds, in cents. */
export const GIFT_MIN = 1000;
export const GIFT_MAX = 500000;
export const GIFT_PRESETS = [2000, 5000, 10000];

/** Days of Supporter a paid purchase grants. Generous on purpose: a gift the size of a pass is a pass. */
export function passDaysFor(sku: Sku, amountCents: number): number {
  if (amountCents >= PRODUCTS['pass-year'].amount!) return PRODUCTS['pass-year'].passDays;
  if (amountCents >= PRODUCTS['pass-month'].amount!) return PRODUCTS['pass-month'].passDays;
  return PRODUCTS[sku].passDays;
}

/** "R29", "R7.50" */
export function formatRand(cents: number): string {
  const major = cents / 100;
  return `R${major % 1 === 0 ? major : major.toFixed(2)}`;
}

/** A chapter a sponsorship attaches to. */
export interface ChapterRef {
  tradition: string;
  bookSlug: string;
  bookName: string;
  chapter: number;
}

/** Firestore id of a chapter's sponsorship document. */
export const sponsorshipKey = (c: ChapterRef): string => `${c.tradition}__${c.bookSlug}__${c.chapter}`;

export const SPONSOR_NAME_MAX = 60;
export const SPONSOR_MESSAGE_MAX = 120;
