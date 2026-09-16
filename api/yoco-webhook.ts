/**
 * POST /api/yoco-webhook — the ONLY path from "a card cleared" to an entitlement.
 *
 * Register it with `node scripts/registerYocoWebhook.mjs register <url>`.
 * The signature is checked over the raw bytes before anything is read; the
 * amount is trusted only because the body is signed; a stale timestamp or a
 * mode mismatch is refused. Everything below is idempotent: Yoco retries any
 * non-2xx and may redeliver a success.
 */
import { passDaysFor, sponsorshipKey, type ChapterRef, type Sku } from '../shared/products';
import { adminReady, db, FieldValue } from './_lib/firebaseAdmin';
import { coversAmount, paymentsLive, verifyEvent } from './_lib/yoco';

interface Purchase {
  reference: string;
  uid: string;
  sku: Sku;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  chapter: ChapterRef | null;
  sponsorName: string | null;
  message: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request): Promise<Response> {
  if (!paymentsLive() || !adminReady()) return Response.json({ ok: true, note: 'payments not configured' });

  const raw = await req.text();
  const ev = verifyEvent(raw, req.headers);
  if (!ev) return new Response('Bad signature', { status: 401 });
  if (!ev.paid) return Response.json({ ok: true, ignored: ev.type || 'unknown' });

  // Find our record: the reverse index first, the echoed metadata as a cross-check.
  let reference: string | null = null;
  if (ev.checkoutId) {
    const idx = await db().collection('checkoutIndex').doc(ev.checkoutId).get();
    reference = (idx.data()?.reference as string | undefined) ?? null;
  }
  if (!reference && ev.reference) reference = ev.reference;
  else if (reference && ev.reference && ev.reference !== reference) {
    console.error(`webhook: checkout ${ev.checkoutId} indexes ${reference} but metadata says ${ev.reference}`);
    return new Response('Ambiguous reference', { status: 400 });
  }
  if (!reference) {
    console.error(`webhook: payment.succeeded for checkout ${ev.checkoutId} with no reference we know`);
    return Response.json({ ok: true, granted: false, note: 'unknown checkout' });
  }

  const purchaseRef = db().collection('purchases').doc(reference);
  const outcome = await db().runTransaction(async (tx) => {
    const snap = await tx.get(purchaseRef);
    if (!snap.exists) return 'no record';
    const p = snap.data() as Purchase;
    if (p.status === 'paid') return 'already';
    if (!coversAmount(ev, p.amount)) {
      tx.update(purchaseRef, { status: 'failed', failedAt: FieldValue.serverTimestamp(), error: `paid ${ev.amount} ${ev.currency}, needed ${p.amount} ZAR` });
      return 'underpaid';
    }

    const now = Date.now();
    const days = passDaysFor(p.sku, ev.amount);
    const entRef = db().collection('entitlements').doc(p.uid);
    const ent = (await tx.get(entRef)).data() as { supporterUntil?: string | null } | undefined;
    const current = ent?.supporterUntil ? Date.parse(ent.supporterUntil) : 0;
    const base = Number.isFinite(current) && current > now ? current : now;
    const supporterUntil = days > 0 ? new Date(base + days * DAY_MS).toISOString() : (ent?.supporterUntil ?? null);

    const entUpdate: Record<string, unknown> = {
      supporterUntil,
      lifetimeCents: FieldValue.increment(ev.amount),
      purchases: FieldValue.increment(1),
      lastPurchaseAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (p.sku === 'sponsor-chapter' && p.chapter && p.sponsorName) {
      const key = sponsorshipKey(p.chapter);
      entUpdate.sponsoredChapters = FieldValue.arrayUnion(key);
      tx.set(
        db().collection('sponsorships').doc(key),
        {
          ...p.chapter,
          names: FieldValue.arrayUnion(p.sponsorName),
          entries: FieldValue.arrayUnion({ name: p.sponsorName, message: p.message ?? '', uid: p.uid, reference, paidAt: new Date(now).toISOString() }),
          count: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    tx.set(entRef, entUpdate, { merge: true });
    tx.update(purchaseRef, {
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
      paidAmount: ev.amount,
      paymentId: ev.paymentId,
      eventId: ev.id,
      grantedDays: days,
    });
    return 'granted';
  });

  if (outcome === 'no record') console.error(`webhook: ${reference} has no purchase record`);
  return Response.json({ ok: true, granted: outcome === 'granted' || outcome === 'already', note: outcome });
}
