import React, { useState } from 'react';
import { Database, AlertTriangle, BookCheck, Loader2, HardDrive, Info } from 'lucide-react';
import { ChapterProvenance, TextCatalogEntry } from '../types';
import { ScriptureStoreStats } from '../services/scriptureStore';
import { cx } from './ui/primitives';

interface ScriptureSourceBarProps {
  label: string;
  source: TextCatalogEntry | null;
  provenance: ChapterProvenance | null;
  verseCount: number;
  loading: boolean;
  error: string | null;
  stats: ScriptureStoreStats | null;
}

/**
 * Thin status strip under the toolbar: which translation the chapter text
 * came from, how many verses were borrowed or AI-reconstructed, and how much
 * scripture is stored on this device. The licence line is one tap away so
 * it does not eat a third of a phone screen.
 */
export const ScriptureSourceBar: React.FC<ScriptureSourceBarProps> = ({
  label,
  source,
  provenance,
  verseCount,
  loading,
  error,
  stats,
}) => {
  const [showLicence, setShowLicence] = useState(false);
  const borrowed = provenance?.borrowed.length ?? 0;
  const reconstructed = provenance?.reconstructed.length ?? 0;
  const unresolved = provenance?.unresolved.length ?? 0;
  const licence = source?.license?.trim() || '';
  const shortLicence = /^public domain$/i.test(licence);

  return (
    <div className="bg-slate-100 border-b-2 border-black print:hidden">
      <div className="container mx-auto max-w-6xl px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-slate-700">
        <span className="flex items-center gap-1 min-w-0">
          {loading ? (
            <Loader2 size={14} className="animate-spin text-slate-500 shrink-0" />
          ) : error ? (
            <AlertTriangle size={14} className="text-red-600 shrink-0" />
          ) : (
            <BookCheck size={14} className="text-green-700 shrink-0" />
          )}
          {loading ? (
            <span>Loading {label}…</span>
          ) : error ? (
            <span className="text-red-700">{error}</span>
          ) : source ? (
            <span className="truncate">
              <span className="hidden sm:inline">{label} · </span>{source.displayName} · {verseCount} verses
              {shortLicence && <span className="text-slate-500 font-normal"> · Public domain</span>}
            </span>
          ) : (
            <span className="text-slate-500">No chapter loaded</span>
          )}
          {!loading && !error && licence && !shortLicence && (
            <button
              type="button"
              onClick={() => setShowLicence(v => !v)}
              aria-expanded={showLicence}
              aria-label="Show copyright notice"
              title="Copyright notice"
              className={cx('shrink-0 rounded-full p-0.5 border transition-colors', showLicence ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-500 border-transparent hover:bg-slate-200')}
            >
              <Info size={13} />
            </button>
          )}
        </span>

        {!loading && borrowed > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
            {borrowed} verse{borrowed === 1 ? '' : 's'} filled from another public-domain translation
          </span>
        )}
        {!loading && reconstructed > 0 && (
          <span
            className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-400 flex items-center gap-1"
            title="These verses were reproduced by AI because no bundled translation had them. Verify against a printed edition before quoting."
          >
            <AlertTriangle size={12} /> {reconstructed} verse{reconstructed === 1 ? '' : 's'} AI-reconstructed
          </span>
        )}
        {!loading && unresolved > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300">
            {unresolved} verse{unresolved === 1 ? '' : 's'} still missing
          </span>
        )}

        {stats && (
          <span className="ml-auto hidden sm:flex items-center gap-1 text-slate-500 font-normal" title="Scripture stored permanently on this device. Books are downloaded once and never fetched again.">
            {stats.persistent ? <HardDrive size={14} /> : <Database size={14} />}
            {stats.books} book{stats.books === 1 ? '' : 's'} · {stats.verses.toLocaleString()} verses stored
            {stats.persistent ? ' offline' : ' (this session only)'}
          </span>
        )}
        {stats && (
          <span className="ml-auto sm:hidden flex items-center gap-1 text-slate-500 font-normal" title={`${stats.books} books · ${stats.verses.toLocaleString()} verses stored ${stats.persistent ? 'offline' : 'this session'}`}>
            {stats.persistent ? <HardDrive size={14} /> : <Database size={14} />}
            {stats.books} offline
          </span>
        )}

        {showLicence && licence && (
          <p className="basis-full text-[11px] font-normal text-slate-600 leading-snug">{licence}</p>
        )}
      </div>
    </div>
  );
};
