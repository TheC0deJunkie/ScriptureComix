/**
 * paymentsClient — the browser side of paying. Opens a Yoco checkout through
 * our own /api/checkout (which sets the price) and sends the reader to Yoco's
 * hosted page. On return, `readPaymentReturn` + `waitForSettlement` tell the
 * app whether the webhook has landed.
 */
import type { ChapterRef, Sku } from '../shared/products';
import { getFirebaseAuth, isFirebaseConfigured } from './firebase';

export interface CheckoutInput {
  sku: Sku;
  /** Cents; only for gifts. */
  amount?: number;
  chapter?: ChapterRef;
  sponsorName?: string;
  message?: string;
}

/** Starts a checkout and navigates away. Throws with a readable message if it cannot. */
export async function startCheckout(input: CheckoutInput): Promise<void> {
  if (!isFirebaseConfigured) throw new Error('Payments need an account, and sign-in is not set up on this build.');
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Sign in first.');
  const token = await user.getIdToken();
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as { redirectUrl?: string; error?: string };
  if (!res.ok || !body.redirectUrl) throw new Error(body.error || `Could not start the payment (${res.status}).`);
  window.location.assign(body.redirectUrl);
}

export type PaymentOutcome = 'ok' | 'cancel' | 'fail';
export interface PaymentReturn { outcome: PaymentOutcome; reference: string }

/** The `?pay=…&ref=…` Yoco sent the reader back with, removed from the URL once read. */
export function readPaymentReturn(): PaymentReturn | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const outcome = params.get('pay');
  const reference = params.get('ref') || '';
  if (outcome !== 'ok' && outcome !== 'cancel' && outcome !== 'fail') return null;
  params.delete('pay');
  params.delete('ref');
  const rest = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  return { outcome, reference };
}

export interface SettlementStatus { status: 'pending' | 'paid' | 'failed' | 'unknown'; settled: boolean; sku?: string | null }

export async function checkoutStatus(reference: string): Promise<SettlementStatus> {
  const res = await fetch(`/api/checkout-status?ref=${encodeURIComponent(reference)}`);
  if (!res.ok) return { status: 'pending', settled: false };
  return (await res.json()) as SettlementStatus;
}

/** Polls until the webhook settles the purchase, or gives up after `timeoutMs`. */
export async function waitForSettlement(reference: string, timeoutMs = 45000, everyMs = 2000): Promise<SettlementStatus> {
  const deadline = Date.now() + timeoutMs;
  let last: SettlementStatus = { status: 'pending', settled: false };
  while (Date.now() < deadline) {
    last = await checkoutStatus(reference).catch(() => last);
    if (last.settled) return last;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  return last;
}
