import React, { useEffect, useState } from 'react';
import { Heart, Sparkles, BookOpen, Gift, Check, Lock, ExternalLink } from 'lucide-react';
import { Dialog, Button, TextInput, Field, cx } from './ui/primitives';
import { PRODUCTS, GIFT_MIN, GIFT_MAX, GIFT_PRESETS, SPONSOR_NAME_MAX, SPONSOR_MESSAGE_MAX, formatRand, type ChapterRef, type Sku } from '../shared/products';
import { startCheckout } from '../services/paymentsClient';

/**
 * SupportModal — the one place money is asked for.
 *
 * Reading stays free. Three ways to help: a Supporter pass (the generated
 * extras), sponsoring the chapter on screen (your name stays on it), or a
 * once-off gift. Every button goes through /api/checkout, which sets the
 * price, and on to Yoco's hosted page; nothing is unlocked until Yoco's
 * signed webhook says the money arrived.
 */
export interface SupportModalProps {
  open: boolean;
  onClose: () => void;
  /** The chapter on screen, offered for sponsorship. */
  chapter: ChapterRef | null;
  supporterUntil: string | null;
  displayName: string;
  /** Preselects the gift card with this amount (cents), e.g. from the banner. */
  initialGift?: number | null;
  signedIn: boolean;
  /** Called when a signed-out reader tries to pay; the caller opens sign-in and reopens this afterwards. */
  onNeedSignIn: () => void;
}

type Panel = 'pass' | 'sponsor' | 'gift';

const PERKS = [
  'Every art style for generated comics',
  'Offline packs and PDF downloads',
  'A supporter badge in your circles',
  'Your money funds chapters everyone reads free',
];

export const SupportModal: React.FC<SupportModalProps> = ({ open, onClose, chapter, supporterUntil, displayName, initialGift, signedIn, onNeedSignIn }) => {
  const [panel, setPanel] = useState<Panel>('pass');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState('');
  const [message, setMessage] = useState('');
  const [gift, setGift] = useState<number>(GIFT_PRESETS[1]);
  const [customGift, setCustomGift] = useState('');

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(null);
    setPanel(initialGift ? 'gift' : 'pass');
    if (initialGift) { setGift(initialGift); setCustomGift(''); }
    setSponsorName((prev) => prev || displayName.trim());
  }, [open, initialGift, displayName]);

  const active = supporterUntil && Date.parse(supporterUntil) > Date.now();
  const until = active ? new Date(supporterUntil!).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const pay = async (sku: Sku, extra: { amount?: number; sponsorName?: string; message?: string } = {}) => {
    if (!signedIn) { onNeedSignIn(); return; }
    setError(null);
    setBusy(sku);
    try {
      await startCheckout({ sku, chapter: sku === 'sponsor-chapter' ? chapter ?? undefined : undefined, ...extra });
      // startCheckout navigates away on success; if we are still here, keep the spinner briefly.
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const giftCents = customGift.trim() ? Math.round(Number(customGift) * 100) : gift;
  const giftOk = Number.isFinite(giftCents) && giftCents >= GIFT_MIN && giftCents <= GIFT_MAX;

  const tabs: { id: Panel; label: string; icon: React.ReactNode }[] = [
    { id: 'pass', label: 'Supporter', icon: <Sparkles size={14} /> },
    { id: 'sponsor', label: 'Sponsor a chapter', icon: <BookOpen size={14} /> },
    { id: 'gift', label: 'Gift', icon: <Gift size={14} /> },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Keep it free for everyone" eyebrow="Support ScriptureComix" icon={<Heart size={22} className="fill-current" />} size="lg" tone="dark">
      <div className="space-y-5">
        <p className="text-sm text-slate-700 leading-relaxed">
          Reading, every translation and every language stay free. The pictures, notes and quizzes cost real money to make once, and readers cover that.
          {until && <span className="block mt-1 font-bold text-green-800">You are a Supporter until {until}. Thank you.</span>}
        </p>

        <div role="tablist" aria-label="Ways to support" className="inline-flex border-[3px] border-black rounded-full bg-white overflow-hidden shadow-[3px_3px_0_0_#000]">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={panel === t.id}
              type="button"
              onClick={() => { setPanel(t.id); setError(null); }}
              className={cx('flex items-center gap-1.5 px-3 md:px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:bg-purple-100', panel === t.id ? 'bg-yellow-300 text-black' : 'bg-white text-slate-600 hover:bg-slate-100')}
            >
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </div>

        {panel === 'pass' && (
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="rounded-2xl border-[3px] border-black bg-amber-50 p-4 shadow-[4px_4px_0_0_#000]">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">What a Supporter gets</p>
              <ul className="mt-2 space-y-1.5">
                {PERKS.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm font-semibold text-slate-900"><Check size={16} className="mt-0.5 shrink-0 text-green-700" strokeWidth={3} />{p}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-600">No auto-renew. A pass is a once-off payment for a fixed time, and buying another one adds to the end of it.</p>
            </div>
            <div className="flex flex-col gap-3 md:w-56">
              <PriceButton label="1 month" price={formatRand(PRODUCTS['pass-month'].amount!)} busy={busy === 'pass-month'} disabled={!!busy} onClick={() => pay('pass-month')} />
              <PriceButton label="1 year" price={formatRand(PRODUCTS['pass-year'].amount!)} note="two months free" busy={busy === 'pass-year'} disabled={!!busy} onClick={() => pay('pass-year')} variant="primary" />
            </div>
          </div>
        )}

        {panel === 'sponsor' && (
          <div className="space-y-4">
            <div className="rounded-2xl border-[3px] border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">This chapter</p>
              <p className="comic-font text-2xl leading-none mt-1">{chapter ? `${chapter.bookName} ${chapter.chapter}` : 'Open a chapter first'}</p>
              <p className="mt-2 text-sm text-slate-700">{PRODUCTS['sponsor-chapter'].blurb} Everyone who opens it sees <span className="font-bold">“made possible by {sponsorName.trim() || 'you'}”</span>. It also gives you a month of Supporter.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name on the chapter" hint={`${sponsorName.length}/${SPONSOR_NAME_MAX}`}>
                <TextInput value={sponsorName} maxLength={SPONSOR_NAME_MAX} onChange={(e) => setSponsorName(e.target.value)} placeholder="e.g. The Zondi family" />
              </Field>
              <Field label="A line to go with it (optional)" hint={`${message.length}/${SPONSOR_MESSAGE_MAX}`}>
                <TextInput value={message} maxLength={SPONSOR_MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} placeholder="In memory of Gogo, who read to us" />
              </Field>
            </div>
            <PriceButton
              label={`Sponsor ${chapter ? `${chapter.bookName} ${chapter.chapter}` : 'this chapter'}`}
              price={formatRand(PRODUCTS['sponsor-chapter'].amount!)}
              busy={busy === 'sponsor-chapter'}
              disabled={!!busy || !chapter || sponsorName.trim().length < 2}
              onClick={() => pay('sponsor-chapter', { sponsorName: sponsorName.trim(), message: message.trim() })}
              variant="primary"
              block
            />
          </div>
        )}

        {panel === 'gift' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">{PRODUCTS.gift.blurb}</p>
            <div className="flex flex-wrap items-center gap-2">
              {GIFT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setGift(c); setCustomGift(''); }}
                  className={cx('rounded-full border-[3px] border-black px-4 py-2 font-black shadow-[3px_3px_0_0_#000] transition-colors', !customGift && gift === c ? 'bg-yellow-300' : 'bg-white hover:bg-slate-100')}
                >
                  {formatRand(c)}
                </button>
              ))}
              <div className="flex items-center gap-1 font-black">
                <span>R</span>
                <TextInput value={customGift} inputMode="decimal" placeholder="other" className="w-24" onChange={(e) => setCustomGift(e.target.value.replace(/[^\d.]/g, ''))} />
              </div>
            </div>
            <PriceButton label="Give" price={giftOk ? formatRand(giftCents) : '—'} busy={busy === 'gift'} disabled={!!busy || !giftOk} onClick={() => pay('gift', { amount: giftCents })} variant="primary" block />
            {!giftOk && customGift && <p className="text-xs font-bold text-red-700">Between {formatRand(GIFT_MIN)} and {formatRand(GIFT_MAX)}.</p>}
          </div>
        )}

        {error && <p role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{error}</p>}

        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          {signedIn ? <Lock size={12} /> : <Lock size={12} />}
          {signedIn ? 'Card payments by Yoco. You go to Yoco’s secure page and come straight back.' : 'You will be asked to sign in first, so what you unlock follows you to every device.'}
          <ExternalLink size={11} />
        </p>
      </div>
    </Dialog>
  );
};

const PriceButton: React.FC<{
  label: string; price: string; note?: string; busy: boolean; disabled: boolean; onClick: () => void; variant?: 'primary' | 'secondary'; block?: boolean;
}> = ({ label, price, note, busy, disabled, onClick, variant = 'secondary', block }) => (
  <Button variant={variant} size="md" block={block} disabled={disabled} onClick={onClick} className={cx('justify-between gap-3 normal-case tracking-normal', !block && 'w-full md:w-auto')}>
    <span className="flex flex-col items-start leading-tight">
      <span className="font-black uppercase tracking-wider text-xs">{busy ? 'Opening Yoco…' : label}</span>
      {note && <span className="text-[10px] opacity-80">{note}</span>}
    </span>
    <span className="comic-font text-xl">{price}</span>
  </Button>
);
