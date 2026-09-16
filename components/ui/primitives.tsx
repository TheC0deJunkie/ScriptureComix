/**
 * ui/primitives — the small set of controls every screen is built from.
 *
 * Comic-book styling (thick black borders, hard offset shadows, one accent
 * yellow) but the behaviour of a proper design system: keyboard navigation,
 * Escape closes the top-most layer, focus returns where it came from, body
 * scroll locks under modals, and no native <select>, alert() or confirm().
 */
import React, {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X, Search, Lock, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ */
/* Layer management: Escape closes only the top-most open layer         */
/* ------------------------------------------------------------------ */
const escapeStack: (() => void)[] = [];

export function useEscape(active: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const handler = () => ref.current();
    escapeStack.push(handler);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (escapeStack[escapeStack.length - 1] !== handler) return;
      e.stopPropagation();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      const i = escapeStack.lastIndexOf(handler);
      if (i >= 0) escapeStack.splice(i, 1);
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);
}

let bodyLocks = 0;
let savedOverflow = '';
export function useLockBody(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (bodyLocks === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    bodyLocks++;
    return () => {
      bodyLocks--;
      if (bodyLocks === 0) document.body.style.overflow = savedOverflow;
    };
  }, [active]);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(active: boolean, ref: React.RefObject<HTMLElement | null>, initialFocus?: 'first' | 'panel') {
  useEffect(() => {
    if (!active || !ref.current) return;
    const node = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = (): HTMLElement[] => (Array.from(node.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter(el => el.offsetParent !== null || el === node);
    const target = initialFocus === 'panel' ? node : (node.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? node);
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (!els.length) { e.preventDefault(); return; }
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [active]);
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */
type Variant = 'primary' | 'accent' | 'dark' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-yellow-300 text-black hover:bg-yellow-200 border-black shadow-[3px_3px_0_0_#000]',
  accent: 'bg-purple-600 text-white hover:bg-purple-500 border-black shadow-[3px_3px_0_0_#000]',
  dark: 'bg-black text-yellow-300 hover:bg-slate-800 border-black shadow-[3px_3px_0_0_#000]',
  secondary: 'bg-white text-slate-900 hover:bg-slate-50 border-black shadow-[3px_3px_0_0_#000]',
  success: 'bg-green-400 text-black hover:bg-green-300 border-black shadow-[3px_3px_0_0_#000]',
  danger: 'bg-red-600 text-white hover:bg-red-500 border-black shadow-[3px_3px_0_0_#000]',
  ghost: 'bg-transparent text-slate-800 hover:bg-black/5 border-transparent shadow-none normal-case tracking-normal',
};
const SIZE: Record<Size, string> = {
  xs: 'text-[11px] px-2.5 py-1 gap-1',
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-xs md:text-sm px-4 py-2 gap-2',
  lg: 'text-base px-6 py-3 gap-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  square?: boolean;
  block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', square = false, block = false, className, type = 'button', children, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex items-center justify-center font-black uppercase tracking-wider border-[3px] select-none',
        square ? 'rounded-xl' : 'rounded-full',
        'transition-[transform,box-shadow,background-color] active:translate-y-[2px] active:shadow-none',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
        VARIANT[variant], SIZE[size], block && 'w-full', className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;               // accessible name — always required
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = 'secondary', size = 'md', className, type = 'button', children, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center rounded-full border-[3px] select-none transition-[transform,box-shadow,background-color] active:translate-y-[2px] active:shadow-none',
        'disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
        size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10',
        VARIANT[variant], className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = 'IconButton';

/* ------------------------------------------------------------------ */
/* Segmented control                                                    */
/* ------------------------------------------------------------------ */
export interface SegmentItem<T extends string> { value: T; label: React.ReactNode; icon?: React.ReactNode; title?: string; hideLabelBelow?: 'md' | 'lg' }
export function Segmented<T extends string>({ value, onChange, items, size = 'md', className, ariaLabel }: {
  value: T; onChange: (v: T) => void; items: SegmentItem<T>[]; size?: 'sm' | 'md'; className?: string; ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('inline-flex border-[3px] border-black rounded-full bg-white overflow-hidden shadow-[3px_3px_0_0_#000]', className)}>
      {items.map(it => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={it.title}
            onClick={() => onChange(it.value)}
            className={cx(
              'flex items-center font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:bg-purple-100',
              size === 'sm' ? 'px-3 py-1.5 text-[11px] gap-1' : 'px-3 md:px-4 py-2 text-xs gap-1.5',
              active ? 'bg-yellow-300 text-black' : 'bg-white text-slate-600 hover:bg-slate-100',
            )}
          >
            {it.icon}
            <span className={cx(it.hideLabelBelow === 'md' && 'hidden md:inline', it.hideLabelBelow === 'lg' && 'hidden lg:inline')}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Popover — anchored, portaled, flips to stay on screen                */
/* ------------------------------------------------------------------ */
export function Popover({ open, onClose, anchorRef, align = 'start', width, children, className, role = 'dialog', label }: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: 'start' | 'end';
  width?: number;
  children: React.ReactNode;
  className?: string;
  role?: 'dialog' | 'menu' | 'listbox';
  label?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number; width?: number } | null>(null);
  const focusedOnce = useRef(false);
  useEscape(open, onClose);

  // Once the panel is on screen, move focus into it; when it closes, hand focus back to the anchor.
  useEffect(() => {
    if (!open) { focusedOnce.current = false; return; }
    if (!pos || focusedOnce.current) return;
    focusedOnce.current = true;
    const el = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    el?.focus({ preventScroll: true });
  }, [open, pos]);
  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    return () => {
      const active = document.activeElement;
      if (!active || active === document.body || !document.contains(active)) {
        const target = anchor?.matches?.(FOCUSABLE) ? anchor : anchor?.querySelector<HTMLElement>(FOCUSABLE);
        target?.focus?.({ preventScroll: true });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const update = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const p = panelRef.current;
      if (!a || !p) return;
      const margin = 8, gap = 6;
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(width ?? p.offsetWidth, vw - margin * 2);
      const ph = p.offsetHeight;
      let left = align === 'end' ? a.right - w : a.left;
      left = Math.max(margin, Math.min(left, vw - w - margin));
      const below = vh - a.bottom - gap - margin;
      const above = a.top - gap - margin;
      let top: number, maxH: number;
      if (ph <= below || below >= above) { top = a.bottom + gap; maxH = below; }
      else { top = Math.max(margin, a.top - gap - Math.min(ph, above)); maxH = above; }
      setPos({ top, left, maxH: Math.max(140, maxH), width: width ? w : undefined });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, align, width]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[120]" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role={role}
        aria-label={label}
        style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxHeight: pos?.maxH, width: pos?.width ?? width, visibility: pos ? 'visible' : 'hidden' }}
        className={cx('z-[121] bg-white border-[3px] border-black rounded-2xl shadow-[6px_6px_0_0_#000] overflow-auto overscroll-contain animate-pop', className)}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

/** Menu item for use inside a Popover with role="menu". */
export const MenuItem: React.FC<{ onClick: () => void; icon?: React.ReactNode; title: React.ReactNode; hint?: React.ReactNode; tone?: 'default' | 'accent'; className?: string }> = ({ onClick, icon, title, hint, tone = 'default', className }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={cx(
      'w-full text-left rounded-xl p-3 flex items-start gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200',
      tone === 'accent' ? 'bg-blue-50 hover:bg-blue-100 border-2 border-blue-200' : 'hover:bg-slate-100',
      className,
    )}
  >
    {icon && <span className="mt-0.5 shrink-0 text-slate-700">{icon}</span>}
    <span className="min-w-0">
      <span className="block font-black text-sm leading-tight">{title}</span>
      {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
    </span>
  </button>
);

/* ------------------------------------------------------------------ */
/* Select — a real listbox with keyboard + type-ahead                    */
/* ------------------------------------------------------------------ */
export interface SelectOption<T extends string> {
  value: T;
  label: React.ReactNode;
  hint?: React.ReactNode;
  group?: string;
  locked?: boolean;    // shown, but picking it is refused (caller decides what happens)
  disabled?: boolean;
  searchText?: string; // plain text for type-ahead when label is a node
}

export function Select<T extends string>({
  value, onChange, options, placeholder = 'Choose…', ariaLabel, className, buttonClassName, size = 'md', searchable = false, icon, align = 'start', width = 260, renderValue,
}: {
  value: T | null;
  onChange: (v: T, opt: SelectOption<T>) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  size?: 'sm' | 'md';
  searchable?: boolean;
  icon?: React.ReactNode;
  align?: 'start' | 'end';
  width?: number;
  renderValue?: (opt: SelectOption<T> | undefined) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const current = options.find(o => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => (o.searchText ?? (typeof o.label === 'string' ? o.label : String(o.value))).toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const i = Math.max(0, filtered.findIndex(o => o.value === value));
    setActive(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (opt: SelectOption<T>) => {
    if (opt.disabled) return;
    onChange(opt.value, opt);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(filtered.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = filtered[active]; if (o) pick(o); }
    else if (!searchable && e.key.length === 1 && /\S/.test(e.key)) {
      const q = e.key.toLowerCase();
      const start = active + 1;
      const idx = [...filtered.keys()].map(i => (i + start) % filtered.length).find(i => {
        const t = filtered[i].searchText ?? (typeof filtered[i].label === 'string' ? (filtered[i].label as string) : String(filtered[i].value));
        return t.toLowerCase().startsWith(q);
      });
      if (idx != null) setActive(idx);
    }
  };

  // group rows preserving order
  const rows: { group?: string; items: { opt: SelectOption<T>; index: number }[] }[] = [];
  filtered.forEach((opt, index) => {
    const last = rows[rows.length - 1];
    if (last && last.group === opt.group) last.items.push({ opt, index });
    else rows.push({ group: opt.group, items: [{ opt, index }] });
  });

  return (
    <div className={cx('inline-block', className)}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); } }}
        className={cx(
          'inline-flex items-center gap-2 bg-white border-[3px] border-black font-bold text-left transition-colors hover:bg-yellow-50',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
          size === 'sm' ? 'rounded-lg px-2.5 py-1 text-xs' : 'rounded-xl px-3 py-2 text-sm',
          buttonClassName,
        )}
      >
        {icon && <span className="shrink-0 text-slate-600">{icon}</span>}
        <span className="min-w-0 truncate flex-1">
          {renderValue ? renderValue(current) : current ? current.label : <span className="text-slate-400 font-medium">{placeholder}</span>}
        </span>
        <ChevronDown size={size === 'sm' ? 14 : 16} className={cx('shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} align={align} width={width} role="dialog" label={ariaLabel} className="p-1.5">
        <div onKeyDown={onKey}>
          {searchable && (
            <div className="sticky top-0 bg-white pb-1.5 z-10">
              <div className="flex items-center gap-2 border-2 border-black rounded-lg px-2 py-1.5 bg-white">
                <Search size={14} className="text-slate-500 shrink-0" />
                <input
                  data-autofocus
                  autoFocus
                  value={query}
                  onChange={e => { setQuery(e.target.value); setActive(0); }}
                  placeholder="Type to filter…"
                  aria-label="Filter options"
                  className="w-full bg-transparent outline-none text-sm font-bold placeholder:font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
          )}
          <div ref={listRef} id={id} role="listbox" aria-label={ariaLabel} tabIndex={searchable ? -1 : 0} className="outline-none focus-visible:ring-2 focus-visible:ring-purple-300 rounded-lg" data-autofocus={searchable ? undefined : true}>
            {filtered.length === 0 && <p className="text-xs text-slate-500 p-3">Nothing matches.</p>}
            {rows.map((r, ri) => (
              <div key={ri}>
                {r.group && <p className="px-2 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{r.group}</p>}
                {r.items.map(({ opt, index }) => {
                  const selected = opt.value === value;
                  const isActive = index === active;
                  return (
                    <div
                      key={String(opt.value)}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={opt.disabled || undefined}
                      data-index={index}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(opt)}
                      className={cx(
                        'flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer text-sm',
                        isActive && 'bg-yellow-100',
                        selected && 'font-black',
                        opt.disabled && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      <span className="w-4 shrink-0 flex justify-center">{selected ? <Check size={14} /> : opt.locked ? <Lock size={12} className="text-slate-400" /> : null}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{opt.label}</span>
                        {opt.hint && <span className="block text-[11px] text-slate-500 font-medium truncate">{opt.hint}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Popover>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */
export const inputClass = (extra?: string) => cx(
  'w-full bg-white border-[3px] border-black rounded-xl px-3 py-2 font-bold text-slate-900',
  'placeholder:font-medium placeholder:text-slate-400',
  'focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-50',
  extra,
);

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => (
  <input ref={ref} className={inputClass(className)} {...rest} />
));
TextInput.displayName = 'TextInput';

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={inputClass(cx('min-h-[88px] resize-y leading-relaxed', className))} {...rest} />
));
TextArea.displayName = 'TextArea';

export const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string }> = ({ label, hint, htmlFor, children, className }) => (
  <label htmlFor={htmlFor} className={cx('block', className)}>
    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
  </label>
);

/* ------------------------------------------------------------------ */
/* Dialog and Drawer                                                    */
/* ------------------------------------------------------------------ */
const DIALOG_WIDTH = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' } as const;

export const Dialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  size?: keyof typeof DIALOG_WIDTH;
  tone?: 'light' | 'dark' | 'purple';
  children: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  labelledBy?: string;
}> = ({ open, onClose, title, eyebrow, icon, size = 'md', tone = 'light', children, footer, bodyClassName, labelledBy }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEscape(open, onClose);
  useLockBody(open);
  useFocusTrap(open, ref);
  if (!open) return null;
  const head = tone === 'dark' ? 'bg-slate-900 text-white' : tone === 'purple' ? 'bg-purple-600 text-white' : 'bg-white text-slate-900';
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
        tabIndex={-1}
        className={cx(
          'relative w-full bg-white border-4 border-black shadow-[10px_10px_0_0_#000] flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden outline-none animate-slide-up',
          'rounded-t-3xl sm:rounded-3xl', DIALOG_WIDTH[size],
        )}
      >
        {(title || eyebrow) && (
          <div className={cx('flex items-start justify-between gap-4 px-5 py-4 border-b-4 border-black shrink-0', head)}>
            <div className="flex items-center gap-3 min-w-0">
              {icon && <span className="shrink-0">{icon}</span>}
              <div className="min-w-0">
                {eyebrow && <p className="text-[10px] uppercase tracking-[0.25em] font-black opacity-70">{eyebrow}</p>}
                {title && <h2 id={titleId} className="comic-font text-2xl md:text-3xl leading-none truncate">{title}</h2>}
              </div>
            </div>
            <IconButton label="Close" size="sm" onClick={onClose} variant={tone === 'light' ? 'secondary' : 'primary'}><X size={16} /></IconButton>
          </div>
        )}
        {!title && !eyebrow && (
          <div className="absolute top-3 right-3 z-10"><IconButton label="Close" size="sm" onClick={onClose}><X size={16} /></IconButton></div>
        )}
        <div className={cx('overflow-y-auto overscroll-contain flex-1', bodyClassName ?? 'p-5 md:p-6')}>{children}</div>
        {footer && <div className="border-t-4 border-black px-5 py-3 bg-slate-50 shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  header?: React.ReactNode;   // rendered left of the close button
  children: React.ReactNode;
  width?: 'md' | 'lg';
  label: string;
}> = ({ open, onClose, header, children, width = 'lg', label }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useLockBody(open);
  useFocusTrap(open, ref, 'panel');
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cx('relative h-full w-full bg-[#fffdf6] border-l-4 border-black shadow-2xl flex flex-col outline-none animate-slide-in-right', width === 'lg' ? 'max-w-3xl' : 'max-w-xl')}
      >
        <div className="sticky top-0 z-10 bg-white border-b-4 border-black px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">{header}</div>
          <IconButton label="Close" size="sm" onClick={onClose}><X size={16} /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

/** Wrap a self-contained overlay so Escape closes it and the page behind stops scrolling. */
export const EscapeLayer: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  useEscape(true, onClose);
  useLockBody(true);
  return <>{children}</>;
};

/* ------------------------------------------------------------------ */
/* Toasts + Confirm (one provider)                                      */
/* ------------------------------------------------------------------ */
type Tone = 'success' | 'info' | 'warning' | 'error';
interface ToastInput { title: string; description?: string; tone?: Tone; action?: { label: string; onClick: () => void }; duration?: number }
interface ToastItem extends ToastInput { id: number }
interface ConfirmInput { title: string; description?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: 'danger' | 'default' }

interface UiContextValue {
  toast: (t: ToastInput | string) => void;
  confirm: (c: ConfirmInput) => Promise<boolean>;
}
const UiContext = createContext<UiContextValue>({ toast: () => {}, confirm: async () => false });
export const useToast = () => useContext(UiContext).toast;
export const useConfirm = () => useContext(UiContext).confirm;

const TONE_ICON: Record<Tone, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-green-600" />,
  info: <Info size={18} className="text-blue-600" />,
  warning: <AlertTriangle size={18} className="text-amber-600" />,
  error: <XCircle size={18} className="text-red-600" />,
};
const TONE_BAR: Record<Tone, string> = { success: 'bg-green-400', info: 'bg-blue-400', warning: 'bg-amber-400', error: 'bg-red-500' };

export const UiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmInput & { resolve: (v: boolean) => void }) | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  const toast = useCallback((input: ToastInput | string) => {
    const t: ToastInput = typeof input === 'string' ? { title: input } : input;
    const id = ++counter.current;
    setToasts(list => [...list.slice(-3), { ...t, id }]);
    window.setTimeout(() => dismiss(id), t.duration ?? 4500);
  }, [dismiss]);
  const confirm = useCallback((c: ConfirmInput) => new Promise<boolean>(resolve => setConfirmState({ ...c, resolve })), []);
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const settle = (v: boolean) => { confirmState?.resolve(v); setConfirmState(null); };

  return (
    <UiContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[130] flex flex-col gap-2 w-[min(92vw,26rem)] pointer-events-none print:hidden" aria-live="polite" role="status">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto relative bg-white border-[3px] border-black rounded-2xl shadow-[5px_5px_0_0_#000] pl-4 pr-3 py-3 flex items-start gap-3 overflow-hidden animate-slide-up">
              <span className={cx('absolute left-0 top-0 bottom-0 w-1.5', TONE_BAR[t.tone ?? 'success'])} />
              <span className="shrink-0 mt-0.5">{TONE_ICON[t.tone ?? 'success']}</span>
              <div className="min-w-0 flex-1">
                <p className="font-black text-sm leading-tight">{t.title}</p>
                {t.description && <p className="text-xs text-slate-600 mt-0.5">{t.description}</p>}
                {t.action && (
                  <button type="button" onClick={() => { t.action?.onClick(); dismiss(t.id); }} className="mt-1.5 text-xs font-black uppercase tracking-wider text-purple-700 hover:underline">{t.action.label}</button>
                )}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 p-1 rounded hover:bg-black/5"><X size={14} /></button>
            </div>
          ))}
        </div>,
        document.body,
      )}
      <Dialog open={!!confirmState} onClose={() => settle(false)} size="sm" title={confirmState?.title} icon={confirmState?.tone === 'danger' ? <AlertTriangle className="text-red-600" /> : <Info className="text-blue-600" />}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => settle(false)}>{confirmState?.cancelLabel ?? 'Cancel'}</Button>
            <Button variant={confirmState?.tone === 'danger' ? 'danger' : 'primary'} size="sm" onClick={() => settle(true)} data-autofocus>{confirmState?.confirmLabel ?? 'Confirm'}</Button>
          </div>
        }
      >
        {confirmState?.description && <div className="text-sm text-slate-700 leading-relaxed">{confirmState.description}</div>}
      </Dialog>
    </UiContext.Provider>
  );
};

/* ------------------------------------------------------------------ */
/* Small bits                                                           */
/* ------------------------------------------------------------------ */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { tone?: 'white' | 'dark' | 'cream' | 'blue' }> = ({ tone = 'white', className, children, ...rest }) => (
  <div
    className={cx(
      'border-[3px] border-black rounded-2xl shadow-[4px_4px_0_0_#000] p-4',
      tone === 'white' && 'bg-white', tone === 'cream' && 'bg-amber-50', tone === 'dark' && 'bg-slate-900 text-white', tone === 'blue' && 'bg-blue-600 text-white',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string; icon?: React.ReactNode }> = ({ children, className, icon }) => (
  <p className={cx('text-[10px] font-black uppercase tracking-widest flex items-center gap-1', className ?? 'text-slate-500')}>{icon}{children}</p>
);

export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ icon, title, body, action, className }) => (
  <div className={cx('text-center py-10 px-4 max-w-md mx-auto', className)}>
    <div className="mx-auto w-16 h-16 rounded-full bg-white border-[3px] border-dashed border-slate-300 flex items-center justify-center text-slate-400 mb-3">{icon}</div>
    <p className="font-black text-lg">{title}</p>
    {body && <p className="text-sm text-slate-600 mt-1">{body}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const Pill: React.FC<{ children: React.ReactNode; tone?: 'yellow' | 'green' | 'blue' | 'purple' | 'slate' | 'amber' | 'red'; className?: string; title?: string }> = ({ children, tone = 'slate', className, title }) => {
  const t = {
    yellow: 'bg-yellow-200 border-yellow-500 text-yellow-900', green: 'bg-green-100 border-green-500 text-green-900', blue: 'bg-blue-100 border-blue-400 text-blue-900',
    purple: 'bg-purple-100 border-purple-400 text-purple-900', slate: 'bg-slate-100 border-slate-300 text-slate-700', amber: 'bg-amber-100 border-amber-400 text-amber-900', red: 'bg-red-100 border-red-400 text-red-900',
  }[tone];
  return <span title={title} className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold', t, className)}>{children}</span>;
};
