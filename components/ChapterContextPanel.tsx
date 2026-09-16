import React, { useState } from 'react';
import { Scale, ChevronDown, ChevronUp, MapPin, ListOrdered, Users, BookA, Quote, Landmark } from 'lucide-react';
import { ChapterContext } from '../types';
import { ContextSource, ContextStatus } from '../services/contextBank';

interface ChapterContextPanelProps {
  label: string;
  context: ChapterContext | null;
  source: ContextSource | null;
  status: ContextStatus | 'loading';
}

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="bg-white border-2 border-black rounded-lg p-4">
    <h4 className="font-black uppercase tracking-wider text-xs text-slate-600 flex items-center gap-2 mb-2">
      {icon} {title}
    </h4>
    {children}
  </section>
);

/**
 * "What happened here" — the neutral study context for the current chapter.
 * Descriptive, never devotional; traditions are described, none endorsed.
 */
export const ChapterContextPanel: React.FC<ChapterContextPanelProps> = ({ label, context, source, status }) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-8 border-4 border-black rounded-xl bg-amber-50 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] print:hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span className="bg-amber-300 border-2 border-black rounded-full p-2"><Scale size={18} /></span>
          <span>
            <span className="comic-font text-2xl block leading-none">What happened in {label}</span>
            <span className="text-xs text-slate-600 font-bold">
              Just the text and the history. No tradition favoured.
            </span>
          </span>
        </span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {status === 'loading' && (
            <p className="text-sm font-bold text-slate-600 animate-pulse">Preparing the study context…</p>
          )}
          {status === 'unavailable' && (
            <p className="text-sm text-slate-700">
              No study context has been prepared for this chapter yet. Contexts are generated once and shipped with the
              app, so this will appear in a future update.
            </p>
          )}
          {status === 'ready' && context && (
            <>
              <p className="text-base leading-relaxed">{context.summary}</p>

              {context.setting && (
                <Section icon={<MapPin size={14} />} title="Setting">
                  <p className="text-sm leading-relaxed">{context.setting}</p>
                </Section>
              )}

              {context.events.length > 0 && (
                <Section icon={<ListOrdered size={14} />} title="What led to what">
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    {context.events.map((e, i) => (
                      <li key={i}>
                        <span className="font-bold text-slate-700">{e.ref}</span> — {e.what}
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {context.people.length > 0 && (
                  <Section icon={<Users size={14} />} title="Who is in it">
                    <ul className="space-y-1 text-sm">
                      {context.people.map((p, i) => (
                        <li key={i}><span className="font-bold">{p.name}</span> — {p.role}</li>
                      ))}
                    </ul>
                  </Section>
                )}
                {context.terms.length > 0 && (
                  <Section icon={<BookA size={14} />} title="Words worth knowing">
                    <ul className="space-y-1 text-sm">
                      {context.terms.map((t, i) => (
                        <li key={i}><span className="font-bold">{t.term}</span> — {t.meaning}</li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>

              {context.readings.length > 0 && (
                <Section icon={<Landmark size={14} />} title="How different traditions read it">
                  <ul className="space-y-1 text-sm">
                    {context.readings.map((r, i) => (
                      <li key={i}><span className="font-bold">{r.tradition}:</span> {r.view}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500 mt-2 italic">Described, not ranked. None of these is endorsed by this app.</p>
                </Section>
              )}

              {context.oftenQuoted.length > 0 && (
                <Section icon={<Quote size={14} />} title="Often quoted on its own">
                  <ul className="space-y-1 text-sm">
                    {context.oftenQuoted.map((q, i) => (
                      <li key={i}><span className="font-bold">{q.ref}</span> — {q.caution}</li>
                    ))}
                  </ul>
                </Section>
              )}

              <p className="text-[11px] text-slate-500">
                {source === 'bundled' ? 'Shipped with the app' : 'Generated once and stored'} · descriptive study aid, not a
                religious authority. Check claims against the text.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
