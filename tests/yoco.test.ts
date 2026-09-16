import { createHmac, randomBytes } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// The webhook verifier is the only thing standing between a forged POST and a
// granted entitlement, so it gets its own tests: right signature passes; a
// stale, tampered, cross-mode or unsigned event is refused.

const KEY = randomBytes(32);
const SECRET = `whsec_${KEY.toString('base64')}`;

function sign(id: string, ts: string, body: string): string {
  return `v1,${createHmac('sha256', KEY).update(`${id}.${ts}.${body}`, 'utf8').digest('base64')}`;
}

const event = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'payment.succeeded',
    createdDate: '2026-09-16T20:00:00Z',
    payload: {
      id: 'p_123',
      status: 'succeeded',
      amount: 2900,
      currency: 'ZAR',
      mode: 'test',
      metadata: { checkoutId: 'ch_abc', reference: 'sc-user1234-0123456789abcdef0123', uid: 'user1234', sku: 'pass-month' },
      ...over,
    },
  });

async function loadYoco() {
  // Fresh module per test so env changes are seen.
  const mod = await import('../api/_lib/yoco');
  return mod;
}

describe('Yoco webhook verification', () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env, YOCO_SECRET_KEY: 'sk_test_abc', YOCO_WEBHOOK_SECRET: SECRET };
  });
  afterEach(() => {
    process.env = env;
  });

  it('accepts a correctly signed, fresh, in-mode event and reads the numbers from it', async () => {
    const { verifyEvent } = await loadYoco();
    const body = event();
    const now = Date.now();
    const ts = String(Math.floor(now / 1000));
    const h = new Headers({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': sign('msg_1', ts, body) });
    const ev = verifyEvent(body, h, now);
    expect(ev).not.toBeNull();
    expect(ev!.paid).toBe(true);
    expect(ev!.amount).toBe(2900);
    expect(ev!.currency).toBe('ZAR');
    expect(ev!.checkoutId).toBe('ch_abc');
    expect(ev!.reference).toBe('sc-user1234-0123456789abcdef0123');
    expect(ev!.paymentId).toBe('p_123');
  });

  it('refuses a tampered body', async () => {
    const { verifyEvent } = await loadYoco();
    const body = event();
    const now = Date.now();
    const ts = String(Math.floor(now / 1000));
    const h = new Headers({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': sign('msg_1', ts, body) });
    expect(verifyEvent(body.replace('2900', '290000'), h, now)).toBeNull();
  });

  it('refuses a stale timestamp (replay)', async () => {
    const { verifyEvent } = await loadYoco();
    const body = event();
    const now = Date.now();
    const ts = String(Math.floor(now / 1000) - 10 * 60);
    const h = new Headers({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': sign('msg_1', ts, body) });
    expect(verifyEvent(body, h, now)).toBeNull();
  });

  it('refuses an event from the other mode even when the signature is right', async () => {
    const { verifyEvent } = await loadYoco();
    const body = event({ mode: 'live' });
    const now = Date.now();
    const ts = String(Math.floor(now / 1000));
    const h = new Headers({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': sign('msg_1', ts, body) });
    expect(verifyEvent(body, h, now)).toBeNull();
  });

  it('refuses when headers are missing or the webhook secret is unset', async () => {
    const { verifyEvent } = await loadYoco();
    const body = event();
    const now = Date.now();
    expect(verifyEvent(body, new Headers(), now)).toBeNull();
    process.env.YOCO_WEBHOOK_SECRET = '';
    const ts = String(Math.floor(now / 1000));
    const h = new Headers({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': sign('msg_1', ts, body) });
    expect(verifyEvent(body, h, now)).toBeNull();
  });

  it('coversAmount needs ZAR and at least the record amount', async () => {
    const { coversAmount } = await loadYoco();
    const base = { id: 'x', type: 'payment.succeeded', paid: true, checkoutId: null, paymentId: null, reference: null, paidAt: null };
    expect(coversAmount({ ...base, amount: 2900, currency: 'ZAR' }, 2900)).toBe(true);
    expect(coversAmount({ ...base, amount: 2899, currency: 'ZAR' }, 2900)).toBe(false);
    expect(coversAmount({ ...base, amount: 2900, currency: 'USD' }, 2900)).toBe(false);
  });

  it('mints references the status endpoint will accept', async () => {
    const { newReference, REFERENCE_RE } = await loadYoco();
    expect(newReference('Abc-123_xyz789')).toMatch(REFERENCE_RE);
    expect('sc-evil-../../x').not.toMatch(REFERENCE_RE);
  });
});
