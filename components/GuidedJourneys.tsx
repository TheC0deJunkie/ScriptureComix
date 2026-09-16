import React from 'react';
import { Compass, Map, Play, Target, Award, RotateCcw, Check } from 'lucide-react';
import { GuidedJourney, JourneyProgress } from '../types';
import { Button, Eyebrow, Pill, cx, useConfirm } from './ui/primitives';

interface GuidedJourneysBoardProps {
  journeys: GuidedJourney[];
  progressMap: Record<string, JourneyProgress>;
  activeJourneyId: string | null;
  onStart: (journeyId: string) => void;
  onResume: (journeyId: string) => void;
  onJumpToChapter: (journeyId: string, chapterIndex: number) => void;
  onAbandon: (journeyId: string) => void;
}

const percentOf = (journeyId: string, progressMap: Record<string, JourneyProgress>, total: number) => {
  const p = progressMap[journeyId];
  return p ? Math.round((p.completed.length / total) * 100) : 0;
};

/** Reading paths: a handful of chapters in an order that builds understanding. */
export const GuidedJourneysBoard: React.FC<GuidedJourneysBoardProps> = ({ journeys, progressMap, activeJourneyId, onStart, onResume, onJumpToChapter, onAbandon }) => {
  const confirm = useConfirm();
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="bg-blue-200 border-[3px] border-black rounded-full p-3 shrink-0"><Compass className="text-blue-900" /></span>
        <div>
          <h3 className="comic-font text-3xl leading-none">Reading paths</h3>
          <p className="text-sm text-slate-600 mt-1">A few chapters in an order that makes sense. Finish one and you have actually read something whole.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {journeys.map(journey => {
          const progress = progressMap[journey.id];
          const percent = percentOf(journey.id, progressMap, journey.chapters.length);
          const isActive = activeJourneyId === journey.id;
          const nextIdx = progress ? journey.chapters.findIndex((_, i) => !progress.completed.includes(i)) : 0;
          const done = progress && nextIdx === -1;
          return (
            <div key={journey.id} className={cx('rounded-2xl border-[3px] border-black bg-white p-4 flex flex-col gap-3 shadow-[4px_4px_0_0_#000]', isActive && 'ring-4 ring-yellow-300')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Eyebrow icon={<Map size={12} />}>{journey.duration}{isActive ? ' · current path' : ''}</Eyebrow>
                  <h4 className="font-black text-xl leading-tight">{journey.title}</h4>
                </div>
                <Pill tone="blue" title="Badge you earn at the end"><Award size={12} /> {journey.badge}</Pill>
              </div>
              <p className="text-sm text-slate-600">{journey.description}</p>

              <ol className="space-y-1">
                {journey.chapters.map((ch, idx) => {
                  const isDone = !!progress?.completed.includes(idx);
                  const isNext = !!progress && idx === nextIdx;
                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => onJumpToChapter(journey.id, idx)}
                        className={cx(
                          'w-full text-left flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                          isNext ? 'bg-yellow-100 border-yellow-400' : 'border-transparent hover:bg-slate-100',
                        )}
                      >
                        <span className={cx('w-6 h-6 rounded-full border-2 border-black flex items-center justify-center text-[11px] font-black shrink-0', isDone ? 'bg-green-400' : 'bg-white')}>
                          {isDone ? <Check size={12} /> : idx + 1}
                        </span>
                        <span className="font-black">{ch.book} {ch.chapter}</span>
                        <span className="text-slate-500 truncate">· {ch.focus}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {progress && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden"><div className="bg-yellow-400 h-full transition-all" style={{ width: `${percent}%` }} /></div>
                  <span className="text-xs font-black">{percent}%</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-auto">
                {!progress && <Button variant="primary" size="sm" className="flex-1" onClick={() => onStart(journey.id)}><Play size={14} /> Start here</Button>}
                {progress && !done && <Button variant="success" size="sm" className="flex-1" onClick={() => onResume(journey.id)}><Target size={14} /> Continue · {journey.chapters[nextIdx].book} {journey.chapters[nextIdx].chapter}</Button>}
                {done && <Pill tone="green" className="py-1.5 px-3"><Award size={12} /> Finished · {journey.badge}</Pill>}
                {progress && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => { if (await confirm({ title: 'Start this path over?', description: 'Your progress on it will be cleared.', confirmLabel: 'Start over', tone: 'danger' })) onAbandon(journey.id); }}
                  >
                    <RotateCcw size={14} /> Start over
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
