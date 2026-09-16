import React, { useEffect, useRef, useState } from 'react';
import { Mail, Phone, LogIn, UserPlus, KeyRound, MessageSquare, ArrowLeft } from 'lucide-react';
import { Dialog, Button, TextInput, Field, Segmented, useToast, cx } from './ui/primitives';
import {
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  signInWithGoogle,
  createPhoneRecaptcha,
  startPhoneSignIn,
  confirmPhoneCode,
  normalizePhoneNumber,
  describeAuthError,
  type ConfirmationResult,
  type RecaptchaVerifier,
} from '../services/authService';

type Method = 'email' | 'phone';
type EmailMode = 'signin' | 'signup' | 'reset';

const GoogleMark: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.1z" />
    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

const Divider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
    <span className="h-[2px] flex-1 bg-slate-200" />
    {children}
    <span className="h-[2px] flex-1 bg-slate-200" />
  </div>
);

/** Why the dialog opened, when a locked feature opened it: shown as the heading and a short line under it. */
export interface AuthReason { title: string; hint: string }

export const AuthModal: React.FC<{ open: boolean; onClose: () => void; reason?: AuthReason | null }> = ({ open, onClose, reason }) => {
  const toast = useToast();
  const [method, setMethod] = useState<Method>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Phone
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaHost = useRef<HTMLDivElement>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  // Reset transient state whenever the dialog opens or the method changes.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setCode('');
    setConfirmation(null);
  }, [open, method]);

  // The invisible reCAPTCHA lives only while the phone form is on screen.
  useEffect(() => {
    if (!open || method !== 'phone') return;
    return () => {
      verifier.current?.clear();
      verifier.current = null;
    };
  }, [open, method]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const finish = (title: string) => {
    toast({ title, description: 'Your streak, points and bookmarks now follow you across devices.' });
    onClose();
  };

  const handleGoogle = () =>
    run(async () => {
      const cred = await signInWithGoogle();
      if (cred) finish(`Welcome, ${cred.user.displayName || 'friend'}`);
      // null means a redirect started; the page is about to reload.
    });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (emailMode === 'reset') {
        await sendPasswordReset(email);
        toast({ title: 'Reset email sent', description: `Check ${email.trim()} for a link to choose a new password.` });
        setEmailMode('signin');
        return;
      }
      if (emailMode === 'signup') {
        const cred = await signUpWithEmail(email, password, name);
        finish(`Welcome, ${cred.user.displayName || 'friend'}`);
        return;
      }
      const cred = await signInWithEmail(email, password);
      finish(`Welcome back, ${cred.user.displayName || 'friend'}`);
    });
  };

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const normalized = normalizePhoneNumber(phone);
      if (!normalized) {
        setError('Enter the number with its country code, like +27821234567.');
        return;
      }
      if (!verifier.current && recaptchaHost.current) {
        verifier.current = createPhoneRecaptcha(recaptchaHost.current);
      }
      if (!verifier.current) throw new Error('reCAPTCHA could not start. Reload and try again.');
      try {
        const result = await startPhoneSignIn(normalized, verifier.current);
        setConfirmation(result);
        setPhone(normalized);
        toast({ title: 'Code sent', description: `We texted a 6-digit code to ${normalized}.` });
      } catch (err) {
        // A failed attempt leaves the widget in a bad state; rebuild it next time.
        verifier.current?.clear();
        verifier.current = null;
        throw err;
      }
    });
  };

  const handleConfirmCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!confirmation) return;
      const cred = await confirmPhoneCode(confirmation, code);
      finish(`Welcome, ${cred.user.displayName || cred.user.phoneNumber || 'friend'}`);
    });
  };

  const emailTitle = emailMode === 'signup' ? 'Create your account' : emailMode === 'reset' ? 'Reset your password' : 'Sign in with email';

  return (
    <Dialog open={open} onClose={onClose} title={reason?.title ?? 'Sign in'} eyebrow={reason ? 'Free account · takes a minute' : 'Keep your progress everywhere'} icon={<LogIn size={22} />} size="sm" tone="purple">
      <div className="space-y-4">
        {reason && (
          <p className="rounded-xl border-2 border-black bg-amber-100 px-3 py-2 text-sm font-semibold text-slate-900 shadow-[2px_2px_0_0_#000]">{reason.hint}</p>
        )}
        <Button variant="secondary" block onClick={handleGoogle} disabled={busy} className="normal-case tracking-normal">
          <GoogleMark /> Continue with Google
        </Button>

        <Divider>or</Divider>

        <Segmented<Method>
          ariaLabel="Sign-in method"
          value={method}
          onChange={setMethod}
          items={[
            { value: 'email', label: 'Email', icon: <Mail size={14} /> },
            { value: 'phone', label: 'Phone', icon: <Phone size={14} /> },
          ]}
        />

        {method === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <p className="text-sm font-bold">{emailTitle}</p>
            {emailMode === 'signup' && (
              <Field label="Your name" htmlFor="auth-name" hint="How circles see you">
                <TextInput id="auth-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Pilgrim" />
              </Field>
            )}
            <Field label="Email" htmlFor="auth-email">
              <TextInput id="auth-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" data-autofocus />
            </Field>
            {emailMode !== 'reset' && (
              <Field label="Password" htmlFor="auth-password" hint={emailMode === 'signup' ? 'At least 6 characters' : undefined}>
                <TextInput
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                />
              </Field>
            )}
            {error && <p role="alert" className="text-xs font-bold text-red-700 bg-red-50 border-2 border-red-300 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" variant="dark" block disabled={busy}>
              {emailMode === 'signup' ? <><UserPlus size={16} /> Create account</> : emailMode === 'reset' ? <><KeyRound size={16} /> Send reset link</> : <><LogIn size={16} /> Sign in</>}
            </Button>
            <div className="flex flex-wrap justify-between gap-2 text-xs font-bold text-slate-600">
              {emailMode === 'signin' && (
                <>
                  <button type="button" className="underline underline-offset-2 hover:text-black" onClick={() => { setEmailMode('signup'); setError(null); }}>New here? Create an account</button>
                  <button type="button" className="underline underline-offset-2 hover:text-black" onClick={() => { setEmailMode('reset'); setError(null); }}>Forgot password?</button>
                </>
              )}
              {emailMode !== 'signin' && (
                <button type="button" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-black" onClick={() => { setEmailMode('signin'); setError(null); }}>
                  <ArrowLeft size={12} /> Back to sign in
                </button>
              )}
            </div>
          </form>
        )}

        {method === 'phone' && !confirmation && (
          <form onSubmit={handleSendCode} className="space-y-3">
            <p className="text-sm font-bold">Sign in with a text message</p>
            <Field label="Phone number" htmlFor="auth-phone" hint="Include the country code, e.g. +27 82 123 4567">
              <TextInput id="auth-phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="+27821234567" data-autofocus />
            </Field>
            {error && <p role="alert" className="text-xs font-bold text-red-700 bg-red-50 border-2 border-red-300 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" variant="dark" block disabled={busy}><MessageSquare size={16} /> Text me a code</Button>
            <p className="text-[11px] text-slate-500">Standard SMS rates may apply. Protected by reCAPTCHA.</p>
          </form>
        )}

        {method === 'phone' && confirmation && (
          <form onSubmit={handleConfirmCode} className="space-y-3">
            <p className="text-sm font-bold">Enter the code we sent to {phone}</p>
            <Field label="6-digit code" htmlFor="auth-code">
              <TextInput
                id="auth-code"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value)}
                autoComplete="one-time-code"
                placeholder="123456"
                className={cx('tracking-[0.4em] text-center text-lg')}
                data-autofocus
              />
            </Field>
            {error && <p role="alert" className="text-xs font-bold text-red-700 bg-red-50 border-2 border-red-300 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" variant="dark" block disabled={busy || code.replace(/\D/g, '').length < 6}><LogIn size={16} /> Verify and sign in</Button>
            <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 underline underline-offset-2 hover:text-black" onClick={() => { setConfirmation(null); setCode(''); setError(null); }}>
              <ArrowLeft size={12} /> Use a different number
            </button>
          </form>
        )}

        {/* reCAPTCHA renders into this element; invisible mode keeps it out of the layout. */}
        <div ref={recaptchaHost} id="auth-recaptcha" />
      </div>
    </Dialog>
  );
};
