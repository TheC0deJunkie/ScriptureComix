import React, { useState, useEffect } from 'react';
import { Tradition, NAV_LABELS, CanonManifest, ManifestBook, TranslationMeta } from '../services/types';
import { loadManifest } from '../services/manifestService';

interface BookSelectorProps {
  tradition: Tradition;
  selectedBook: string | null;       // book slug
  selectedChapter: number | null;
  selectedTranslation: string | null; // translation id
  onBookChange: (slug: string, displayName: string) => void;
  onChapterChange: (chapter: number) => void;
  onTranslationChange: (translationId: string) => void;
  /**
   * Header "sentence" layout: book › chapter · translation, borderless, no
   * verse count. Copyright attribution still appears when a translation needs it.
   */
  compact?: boolean;
}

export function BookSelector({
  tradition,
  selectedBook,
  selectedChapter,
  selectedTranslation,
  onBookChange,
  onChapterChange,
  onTranslationChange,
  compact = false,
}: BookSelectorProps) {
  const [manifest, setManifest] = useState<CanonManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const labels = NAV_LABELS[tradition];

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadManifest(tradition)
      .then(setManifest)
      .catch(() => setError(`Failed to load ${tradition} data`))
      .finally(() => setLoading(false));
  }, [tradition]);

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (error || !manifest) return <div className="text-sm text-red-500">{error || 'No data available'}</div>;

  const currentBook = manifest.books.find(b => b.slug === selectedBook) ?? null;
  const selectedTranslationMeta: TranslationMeta | undefined = manifest.translations.find(t => t.id === selectedTranslation);

  // Group books by section
  const sections = new Map<string, ManifestBook[]>();
  for (const book of manifest.books) {
    const sec = book.section || 'Books';
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(book);
  }

  const isQuran = tradition === 'quran';

  if (compact) {
    const sel = 'font-bold bg-transparent outline-none text-sm cursor-pointer px-1 py-1.5 rounded hover:bg-yellow-100';
    return (
      <div className="book-selector flex items-center gap-0.5">
        <label htmlFor="book-select" className="sr-only">{labels.book}</label>
        <select
          id="book-select"
          value={selectedBook || ''}
          onChange={(e) => {
            const book = manifest.books.find(b => b.slug === e.target.value);
            if (book) {
              onBookChange(book.slug, book.displayName);
              onChapterChange(1);
            }
          }}
          className={sel + ' w-[9.5rem]'}
        >
          <option value="">{labels.book}…</option>
          {Array.from(sections.entries()).map(([section, books]) => (
            <optgroup key={section} label={section}>
              {books.map(b => <option key={b.slug} value={b.slug}>{b.displayName}</option>)}
            </optgroup>
          ))}
        </select>
        {currentBook && !isQuran && currentBook.chapters.length > 1 && (
          <>
            <span className="text-slate-300 font-black select-none">›</span>
            <label htmlFor="chapter-select" className="sr-only">{labels.chapter}</label>
            <select id="chapter-select" value={selectedChapter || ''} onChange={(e) => onChapterChange(Number(e.target.value))} className={sel + ' w-14'} title={labels.chapter}>
              {currentBook.chapters.map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </>
        )}
        {manifest.translations.length > 0 && (
          <>
            <span className="text-slate-300 select-none">·</span>
            <label htmlFor="translation-select" className="sr-only">Translation</label>
            <select
              id="translation-select"
              value={selectedTranslation || manifest.translations[0]?.id || ''}
              onChange={(e) => onTranslationChange(e.target.value)}
              className={`${sel} text-slate-500 font-semibold w-[10rem]`}
              title={selectedTranslationMeta?.copyright || 'Translation'}
            >
              {manifest.translations.map(t => (
                <option key={t.id} value={t.id}>{t.displayName}{t.copyright ? ' ©' : ''}</option>
              ))}
            </select>
          </>
        )}
        {selectedTranslationMeta?.copyright && (
          <span className="text-[10px] text-slate-400 italic max-w-[10rem] truncate" title={selectedTranslationMeta.copyright}>{selectedTranslationMeta.copyright}</span>
        )}
      </div>
    );
  }

  return (
    <div className="book-selector flex flex-wrap items-start gap-2">
      {/* Translation selector with copyright attribution (DATA-04) */}
      {manifest.translations.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <label htmlFor="translation-select" className="sr-only">Translation</label>
          <select
            id="translation-select"
            value={selectedTranslation || manifest.translations[0]?.id || ''}
            onChange={(e) => onTranslationChange(e.target.value)}
            className="px-2 py-2 border-2 border-black font-bold focus:bg-yellow-100 rounded bg-gray-50 text-sm max-w-[260px]"
          >
            {manifest.translations.map(t => (
              <option key={t.id} value={t.id}>
                {t.displayName}{t.copyright ? ' *' : ''}
              </option>
            ))}
          </select>
          {/* Copyright attribution — shown before user confirms selection (DATA-04 locked decision) */}
          {selectedTranslationMeta?.copyright && (
            <p className="text-xs text-gray-400 mt-1 italic max-w-[260px]">
              {selectedTranslationMeta.copyright}
            </p>
          )}
          {selectedTranslationMeta && !selectedTranslationMeta.copyright && selectedTranslationMeta.isPublicDomain && (
            <p className="text-xs text-gray-400 mt-1 italic">Public Domain</p>
          )}
          {/* For traditions with only 1 translation, still show copyright if present */}
          {manifest.translations.length === 1 && !selectedTranslationMeta && manifest.translations[0].copyright && (
            <p className="text-xs text-gray-400 mt-1 italic max-w-[260px]">
              {manifest.translations[0].copyright}
            </p>
          )}
        </div>
      )}

      {/* Book / Surah selector */}
      <div className="flex flex-col gap-0.5">
        <label htmlFor="book-select" className="sr-only">{labels.book}</label>
        <select
          id="book-select"
          value={selectedBook || ''}
          onChange={(e) => {
            const book = manifest.books.find(b => b.slug === e.target.value);
            if (book) {
              onBookChange(book.slug, book.displayName);
              onChapterChange(1);
            }
          }}
          className="px-2 py-2 border-2 border-black font-bold focus:bg-yellow-100 rounded bg-gray-50 max-w-[200px]"
        >
          <option value="">Select {labels.book}...</option>
          {Array.from(sections.entries()).map(([section, books]) => (
            <optgroup key={section} label={section}>
              {books.map(b => (
                <option key={b.slug} value={b.slug}>{b.displayName}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Chapter selector — hidden for Quran (each surah = 1 chapter) */}
      {currentBook && !isQuran && currentBook.chapters.length > 1 && (
        <div className="flex flex-col gap-0.5">
          <label htmlFor="chapter-select" className="sr-only">{labels.chapter}</label>
          <select
            id="chapter-select"
            value={selectedChapter || ''}
            onChange={(e) => onChapterChange(Number(e.target.value))}
            className="px-2 py-2 border-2 border-black font-bold focus:bg-yellow-100 rounded bg-gray-50"
          >
            {currentBook.chapters.map((_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>
      )}

      {/* Verse/Ayah count display */}
      {currentBook && selectedChapter && (
        <div className="verse-count text-xs text-gray-500 self-center">
          {currentBook.chapters[selectedChapter - 1]
            ? `${currentBook.chapters[selectedChapter - 1]} ${labels.verse.toLowerCase()}s`
            : `${labels.verse.toLowerCase()} count learned on first read`}
        </div>
      )}
    </div>
  );
}
