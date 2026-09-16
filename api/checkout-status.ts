/**
 * GET /api/checkout-status?ref=sc-… — "has the webhook landed yet?"
 *
 * Yoco's success redirect proves nothing, so the page polls this after
 * returning. The reference is unguessable and this returns nothing about the
 * buyer, only whether the record has settled.
 */
import { adminReady, db } from './_lib/firebaseAdmin';
import { REFERENCE_RE } from './_lib/yoco';

export async function GET(req: Request): Promise<Response> {
  const ref = new URL(req.url).searchParams.get('ref') || '';
  if (!REFERENCE_RE.test(ref)) return Response.json({ error: 'Not a reference.' }, { status: 400 });
  if (!adminReady()) return Response.json({ status: 'pending', settled: false });
  try {
    const snap = await db().collection('purchases').doc(ref).get();
    if (!snap.exists) return Response.json({ status: 'unknown', settled: true });
    const d = snap.data() as { status?: string; sku?: string };
    const status = d.status ?? 'pending';
    return Response.json({ status, settled: status !== 'pending', sku: d.sku ?? null });
  } catch (e) {
    console.warn('checkout-status: read failed', (e as Error).message);
    return Response.json({ status: 'pending', settled: false });
  }
}
