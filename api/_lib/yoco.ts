/**
 * Yoco — the one place that talks to the payment processor. Server-only.
 *
 * The buyer is sent to Yoco's hosted checkout page, so no card detail ever
 * touches this origin. Yoco publishes no "verify a payment" endpoint; the
 * signed webhook body is the only proof a payment happened, which makes
 * `verifyEvent` load-bearing for the amount as well as for authenticity.
 *
 * Payments are configuration-gated: with YOCO_SECRET_KEY unset nothing can
 * be bought and nothing can be granted.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { CURRENCY } from '../../shared/products';

const API = 'https://payments.yoco.com/api';

const secret = () => process.env.YOCO_SECRET_KEY?.trim() || '';
const webhookSecret = () => process.env.YOCO_WEBHOOK_SECRET?.trim() || '';

export const paymentsLive = (): boolean => secret().length > 0;
/** Read off the key itself; Yoco stamps every event with `mode` and we refuse a mismatch. */
export const testMode = (): boolean => secret().startsWith('sk_test');

/** Our reference: `sc-{uid fragment}-{20 hex}`. Travels in URLs; unguessable. */
export function newReference(uid: string): string {
  const who = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'anon';
  return `sc-${who}-${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}
export const REFERENCE_RE = /^sc-[A-Za-z0-9]{1,8}-[a-f0-9]{20}$/;

async function call(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${secret()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(body.message || body.description || `Yoco ${path} failed (${r.status})`));
  return body;
}

export interface Checkout { id: string; redirectUrl: string }

export async function createCheckout(o: {
  reference: string;
  amount: number;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  metadata: Record<string, string>;
}): Promise<Checkout> {
  const body = await call('/checkouts', {
    method: 'POST',
    // Retried POSTs (dropped response, double submit) reuse the same checkout.
    headers: { 'Idempotency-Key': o.reference },
    body: JSON.stringify({
      amount: o.amount,
      currency: CURRENCY,
      successUrl: o.successUrl,
      cancelUrl: o.cancelUrl,
      failureUrl: o.failureUrl,
      externalId: o.reference,
      metadata: { reference: o.reference, ...o.metadata },
    }),
  });
  const { id, redirectUrl } = body;
  if (typeof id !== 'string' || typeof redirectUrl !== 'string') throw new Error('Yoco returned no checkout id or redirect URL');
  return { id, redirectUrl };
}

/* ── Webhook verification (Standard Webhooks scheme) ─────────────────────────
   Headers: webhook-id, webhook-timestamp (unix seconds), webhook-signature
   ("v1,<base64> ..."). Signed content is `{id}.{timestamp}.{raw body}`, MAC is
   HMAC-SHA256 base64. The key is NOT the secret string: strip `whsec_` and
   base64-decode the remainder. Always verify the raw bytes, never re-serialised JSON. */

const SIGNED_TOLERANCE_MS = 3 * 60 * 1000;

function keyBytes(): Buffer | null {
  const s = webhookSecret();
  if (!s) return null;
  const b64 = s.startsWith('whsec_') ? s.slice('whsec_'.length) : s;
  try {
    const k = Buffer.from(b64, 'base64');
    return k.length ? k : null;
  } catch {
    return null;
  }
}

function sigMatches(expected: string, header: string): boolean {
  let ok = false;
  for (const part of header.trim().split(/\s+/)) {
    const comma = part.indexOf(',');
    if (comma < 0 || part.slice(0, comma) !== 'v1') continue;
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(part.slice(comma + 1), 'utf8');
    if (a.length === b.length && timingSafeEqual(a, b)) ok = true;
  }
  return ok;
}

export interface PaymentEvent {
  id: string;
  type: string;
  paid: boolean;
  checkoutId: string | null;
  paymentId: string | null;
  reference: string | null;
  amount: number;
  currency: string;
  paidAt: string | null;
}

/** Null on anything that is not a provably-Yoco, in-mode, fresh event. */
export function verifyEvent(rawBody: string, h: Headers, now: number = Date.now()): PaymentEvent | null {
  const key = keyBytes();
  if (!key || !paymentsLive()) return null;
  const id = h.get('webhook-id');
  const ts = h.get('webhook-timestamp');
  const sig = h.get('webhook-signature');
  if (!id || !ts || !sig) return null;
  const when = Number(ts) * 1000;
  if (!Number.isFinite(when) || Math.abs(now - when) > SIGNED_TOLERANCE_MS) return null;
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`, 'utf8').digest('base64');
  if (!sigMatches(expected, sig)) return null;

  let ev: { type?: string; createdDate?: string; payload?: Record<string, unknown> };
  try {
    ev = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const p = (ev.payload ?? {}) as Record<string, unknown>;
  const meta = (p.metadata && typeof p.metadata === 'object' ? p.metadata : {}) as Record<string, unknown>;
  const mode = typeof p.mode === 'string' ? p.mode : '';
  if (mode && mode !== (testMode() ? 'test' : 'live')) return null;
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  return {
    id,
    type: ev.type ?? '',
    paid: ev.type === 'payment.succeeded' && p.status === 'succeeded',
    checkoutId: str(meta.checkoutId),
    paymentId: str(p.id),
    reference: str(meta.reference),
    amount: Number(p.amount ?? 0),
    currency: String(p.currency ?? ''),
    paidAt: str(p.createdDate) ?? str(ev.createdDate),
  };
}

export function coversAmount(ev: PaymentEvent, expected: number): boolean {
  return ev.currency === CURRENCY && ev.amount >= expected;
}
