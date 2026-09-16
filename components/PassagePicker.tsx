import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Search, Check, Lock, Languages } from 'lucide-react';
import { Tradition, TRADITIONS, TRADITION_LABELS, NAV_LABELS, CanonManifest, ManifestBook, TranslationMeta, translationLanguage, languageName } from '../services/types';
import { loadManifest } from '../services/manifestService';
import { Popover, IconButton, cx } from './ui/primitives';

const SHORT_TRADITION: Record<Tradition, string> = {
  protestant: 'Protestant', catholic: 'Catholic', ethiopian: 'Ethiopian', quran: 'Quran',
};

interface PassagePickerProps {
  tradition: Tradition;
  onTraditionChange: (t: Tradition) => void;
  selectedBook: string | null;           // slug
  selectedBookName: string;              // display name (fallback label while manifest loads)
  selectedChapter: number;
  selectedTranslation: string | null;
  onBookChange: (slug: string, displayName: string) => void;
  onChapterChange: (chapter: number) => void;
  onTranslationChange: (translationId: string) => void;
  /** A second translation shown in small print under every verse; null for none. */
  companionTranslation?: string | null;
  onCompanionChange?: (translationId: string | null) => void;
  /** Return false to refuse a book (feature lock); the caller shows the upsell. */
  canOpenBook?: (displayName: string) => boolean;
  chapterCount: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

type Tab = 'book' | 'chapter' | 'version';

/**
 * One control for "what am I reading": ‹ Genesis 1 · KJV ›.
 * Opens a panel with tradition tabs, a searchable book grid, a chapter grid
 * and the translation list — no native dropdowns, works with a keyboard.
 */
export const PassagePicker: React.FC<PassagePickerProps> = ({
  tradition, onTraditionChange, selectedBook, selectedBookName, selectedChapter, selectedTranslation,
  onBookChange, onChapterChange, onTranslationChange, companionTranslation = null, onCompanionChange, canOpenBook, chapterCount, canPrev, canNext, onPrev, onNext,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('book');
  const [query, setQuery] = useState('');
  const [manifest, setManifest] = useState<CanonManifest | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadManifest(tradition).then(m => { if (!cancelled) setManifest(m); }).catch(() => { if (!cancelled) setManifest(null); });
    return () => { cancelled = true; };
  }, [tradition]);

  useEffect(() => {
    if (open) { setTab('book'); setQuery(''); }
  }, [open]);

  const isQuran = tradition === 'quran';
  const labels = NAV_LABELS[tradition];
  const book = manifest?.books.find(b => b.slug === selectedBook) ?? null;
  const translation = manifest?.translations.find(t => t.id === selectedTranslation) ?? manifest?.translations[0];
  const bookName = book?.displayName || selectedBookName || labels.book;
  const shortId = (t: TranslationMeta) => (t.id.length <= 6 ? t.id.toUpperCase() : t.displayName);
  const companion = companionTranslation ? manifest?.translations.find(t => t.id === companionTranslation) ?? null : null;
  const shortVersion = translation ? `${shortId(translation)}${companion && companion.id !== translation.id ? ` + ${shortId(companion)}` : ''}` : '';
  // Group the version list by language once there is more than one
  const byLanguage = useMemo(() => {
    const map = new Map<string, TranslationMeta[]>();
    for (const t of manifest?.translations ?? []) {
      const lang = translationLanguage(t);
      if (!map.has(lang)) map.set(lang, []);
      map.get(lang)!.push(t);
    }
    return Array.from(map.entries());
  }, [manifest]);
  const multilingual = byLanguage.length > 1;
  // Language chips above the version list, so a second language is one tap away instead of below the fold
  const [langFilter, setLangFilter] = useState<string>('all');
  const shownLanguages = langFilter === 'all' ? byLanguage : byLanguage.filter(([lang]) => lang === langFilter);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, ManifestBook[]>();
    for (const b of manifest?.books ?? []) {
      if (q && !b.displayName.toLowerCase().includes(q) && !b.slug.includes(q)) continue;
      const sec = b.section || 'Books';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(b);
    }
    return Array.from(map.entries());
  }, [manifest, query]);

  const firstMatch = sections[0]?.[1]?.[0];

  const pickBook = (b: ManifestBook) => {
    if (canOpenBook && !canOpenBook(b.displayName)) { setOpen(false); return; }
    onBookChange(b.slug, b.displayName);
    onChapterChange(1);
    if (isQuran || b.chapters.length <= 1) setOpen(false);
    else setTab('chapter');
  };

  const pickChapter = (c: number) => { onChapterChange(c); setOpen(false); };

  const TabButton: React.FC<{ id: Tab; title: string; value: string; hidden?: boolean }> = ({ id, title, value, hidden }) =>
    hidden ? null : (
      <button
        type="button"
        role="tab"
        aria-selected={tab === id}
        onClick={() => setTab(id)}
        className={cx(
          'flex-1 min-w-0 text-left rounded-xl px-3 py-2 border-[3px] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
          tab === id ? 'bg-yellow-300 border-black' : 'bg-white border-transparent hover:bg-slate-100',
        )}
      >
        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</span>
        <span className="block font-black text-sm truncate">{value}</span>
      </button>
    );

  return (
    <div ref={anchorRef} className="flex items-center gap-1 min-w-0">
      <IconButton label={`Previous ${labels.chapter.toLowerCase()}`} size="sm" onClick={onPrev} disabled={!canPrev} className="hidden sm:inline-flex shrink-0"><ChevronLeft size={16} /></IconButton>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        title="Change book, chapter or translation"
        className={cx(
          'group flex items-center gap-2 min-w-0 border-[3px] border-black rounded-full bg-white pl-3 pr-2 py-1.5 shadow-[3px_3px_0_0_#000] transition-colors hover:bg-yellow-50',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300', open && 'bg-yellow-100',
        )}
      >
        <BookOpen size={16} className="shrink-0 text-slate-700" />
        <span className="min-w-0 flex items-baseline gap-1.5">
          <span className="font-black text-sm md:text-base truncate">{bookName}{!isQuran && chapterCount > 0 ? ` ${selectedChapter}` : ''}</span>
          {shortVersion && <span className="hidden sm:inline text-[11px] font-black uppercase tracking-wider text-slate-500 border-l-2 border-slate-200 pl-1.5 truncate max-w-[9rem]">{shortVersion}</span>}
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      <IconButton label={`Next ${labels.chapter.toLowerCase()}`} size="sm" onClick={onNext} disabled={!canNext} className="hidden sm:inline-flex shrink-0"><ChevronRight size={16} /></IconButton>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} width={520} label="Choose what to read" className="p-3">
        {/* Tradition */}
        <div role="radiogroup" aria-label="Tradition" className="grid grid-cols-4 gap-1 mb-3 p-1 bg-slate-100 rounded-xl">
          {TRADITIONS.map(t => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tradition === t}
              title={TRADITION_LABELS[t]}
              onClick={() => { if (t !== tradition) { onTraditionChange(t); setTab('book'); setQuery(''); } }}
              className={cx(
                'rounded-lg px-2 py-1.5 text-[11px] md:text-xs font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                tradition === t ? 'bg-black text-yellow-300' : 'text-slate-600 hover:bg-white',
              )}
            >
              {SHORT_TRADITION[t]}
            </button>
          ))}
        </div>

        {/* Where am I */}
        <div role="tablist" className="flex gap-1 mb-3">
          <TabButton id="book" title={labels.book} value={bookName} />
          <TabButton id="chapter" title={labels.chapter} value={String(selectedChapter)} hidden={isQuran || !book || book.chapters.length <= 1} />
          <TabButton id="version" title="Version" value={translation ? `${translation.displayName}${companion && companion.id !== translation.id ? ` + ${companion.displayName}` : ''}` : '—'} hidden={!manifest || manifest.translations.length === 0} />
        </div>

        {!manifest && <p className="text-sm text-slate-500 p-4 text-center">Loading {TRADITION_LABELS[tradition]}…</p>}

        {manifest && tab === 'book' && (
          <div>
            <div className="flex items-center gap-2 border-[3px] border-black rounded-xl px-3 py-2 bg-white mb-3 focus-within:ring-4 focus-within:ring-yellow-200">
              <Search size={16} className="text-slate-500 shrink-0" />
              <input
                ref={searchRef}
                data-autofocus
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && firstMatch) { e.preventDefault(); pickBook(firstMatch); } }}
                placeholder={`Find a ${labels.book.toLowerCase()}…`}
                aria-label={`Find a ${labels.book.toLowerCase()}`}
                className="w-full bg-transparent outline-none font-bold placeholder:font-medium placeholder:text-slate-400"
              />
              {query && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Enter opens first</span>}
            </div>
            {sections.length === 0 && <p className="text-sm text-slate-500 p-4 text-center">No {labels.book.toLowerCase()} called “{query}”.</p>}
            <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-3">
              {sections.map(([section, books]) => (
                <div key={section}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 px-0.5">{section}</p>
                  <div className={cx('grid gap-1', isQuran ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
                    {books.map(b => {
                      const active = b.slug === selectedBook;
                      const locked = canOpenBook ? !canOpenBook(b.displayName) : false;
                      return (
                        <button
                          key={b.slug}
                          type="button"
                          onClick={() => pickBook(b)}
                          aria-current={active ? 'true' : undefined}
                          className={cx(
                            'flex items-center gap-1.5 text-left rounded-lg px-2.5 py-1.5 text-sm font-bold border-2 transition-colors truncate',
                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                            active ? 'bg-yellow-300 border-black' : 'bg-white border-transparent hover:bg-yellow-100 hover:border-yellow-400',
                          )}
                        >
                          {active && <Check size={14} className="shrink-0" />}
                          {locked && <Lock size={12} className="shrink-0 text-slate-400" />}
                          <span className="truncate">{b.displayName}</span>
                          {isQuran && <span className="ml-auto text-[10px] text-slate-400 font-black shrink-0">{b.chapters[0] ?? ''}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {manifest && tab === 'chapter' && book && (
          <div>
            <p className="text-xs text-slate-500 mb-2 px-0.5"><b className="text-slate-800">{book.displayName}</b> has {book.chapters.length} {labels.chapter.toLowerCase()}s. Pick one.</p>
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-[50vh] overflow-y-auto pr-1">
              {book.chapters.map((verseCount, i) => {
                const c = i + 1;
                const active = c === selectedChapter;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => pickChapter(c)}
                    data-autofocus={active || undefined}
                    aria-current={active ? 'true' : undefined}
                    title={verseCount ? `${labels.chapter} ${c} · ${verseCount} ${labels.verse.toLowerCase()}s` : `${labels.chapter} ${c}`}
                    className={cx(
                      'aspect-square rounded-lg text-sm font-black border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                      active ? 'bg-black text-yellow-300 border-black' : 'bg-white border-slate-200 hover:bg-yellow-100 hover:border-yellow-400',
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {manifest && tab === 'version' && (
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            {multilingual && (
              <div className="flex flex-wrap items-center gap-1.5 sticky top-0 bg-white pb-2 z-10" role="group" aria-label="Filter by language">
                <Languages size={14} className="text-slate-500" />
                {[['all', 'All'] as const, ...byLanguage.map(([lang]) => [lang, languageName(lang)] as const)].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={langFilter === value}
                    onClick={() => setLangFilter(value)}
                    className={cx(
                      'rounded-full border-2 px-2.5 py-1 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                      langFilter === value ? 'bg-black text-yellow-300 border-black' : 'bg-white border-slate-300 hover:border-black',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <ul className="space-y-1" role="listbox" aria-label="Translation">
              {shownLanguages.map(([lang, list]) => (
                <React.Fragment key={lang}>
                  {multilingual && <li className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-0.5 pt-2 first:pt-0" role="presentation">{languageName(lang)}</li>}
                  {list.map(t => {
                    const active = t.id === (selectedTranslation || manifest.translations[0]?.id);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => { onTranslationChange(t.id); setOpen(false); }}
                          className={cx(
                            'w-full text-left rounded-xl px-3 py-2 border-2 flex items-start gap-3 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                            active ? 'bg-yellow-300 border-black' : 'bg-white border-transparent hover:bg-yellow-100 hover:border-yellow-400',
                          )}
                        >
                          <span className="w-4 shrink-0 mt-0.5">{active && <Check size={16} />}</span>
                          <span className="min-w-0">
                            <span className="block font-black text-sm">{t.displayName}</span>
                            <span className="block text-[11px] text-slate-500">{t.copyright ? t.copyright : t.isPublicDomain ? 'Public domain' : ''}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </React.Fragment>
              ))}
            </ul>

            {onCompanionChange && manifest.translations.length > 1 && (
              <div className="border-t-2 border-dashed border-slate-200 pt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-0.5 flex items-center gap-1"><Languages size={12} /> Also show underneath</p>
                <p className="text-[11px] text-slate-500 px-0.5 mt-0.5 mb-2">A second translation in small print under every {labels.verse.toLowerCase()}. Read in one language and glance at the other.</p>
                <ul className="space-y-1" role="listbox" aria-label="Second translation shown underneath">
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={!companion}
                      onClick={() => { onCompanionChange(null); setOpen(false); }}
                      className={cx(
                        'w-full text-left rounded-xl px-3 py-1.5 border-2 flex items-center gap-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                        !companion ? 'bg-slate-900 text-white border-black' : 'bg-white border-transparent hover:bg-slate-100',
                      )}
                    >
                      <span className="w-4 shrink-0">{!companion && <Check size={16} />}</span>
                      One language only
                    </button>
                  </li>
                  {manifest.translations.filter(t => t.id !== (selectedTranslation || manifest.translations[0]?.id)).map(t => {
                    const active = companion?.id === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => { onCompanionChange(t.id); setOpen(false); }}
                          className={cx(
                            'w-full text-left rounded-xl px-3 py-1.5 border-2 flex items-center gap-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                            active ? 'bg-slate-900 text-white border-black' : 'bg-white border-transparent hover:bg-slate-100',
                          )}
                        >
                          <span className="w-4 shrink-0">{active && <Check size={16} />}</span>
                          <span className="min-w-0 font-bold">{t.displayName}{multilingual ? <span className={cx('ml-1.5 text-[10px] font-black uppercase tracking-wider', active ? 'text-slate-300' : 'text-slate-400')}>{languageName(translationLanguage(t))}</span> : null}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
};
