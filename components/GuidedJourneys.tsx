import React from 'react';
import { Compass, Flag, Map, Play, Target, Award, XCircle } from 'lucide-react';
import { GuidedJourney, JourneyProgress } from '../types';

interface GuidedJourneysBoardProps {
  journeys: GuidedJourney[];
  progressMap: Record<string, JourneyProgress>;
  activeJourneyId: string | null;
  onStart: (journeyId: string) => void;
  onResume: (journeyId: string) => void;
  onJumpToChapter: (journeyId: string, chapterIndex: number) => void;
  onAbandon: (journeyId: string) => void;
}

const getPercentComplete = (
  journeyId: string,
  progressMap: Record<string, JourneyProgress>,
  total: number
) => {
  const progress = progressMap[journeyId];
  if (!progress) return 0;
  return Math.round((progress.completed.length / total) * 100);
};

export const GuidedJourneysBoard: React.FC<GuidedJourneysBoardProps> = ({
  journeys,
  progressMap,
  activeJourneyId,
  onStart,
  onResume,
  onJumpToChapter,
  onAbandon,
}) => {
  return (
    <div className="bg-blue-900 text-white rounded-3xl border-4 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="bg-yellow-300 border-2 border-black rounded-full p-3 text-blue-900">
          <Compass />
        </div>
        <div>
          <h3 className="comic-font text-3xl uppercase tracking-wider">Guided Journeys</h3>
          <p className="text-sm text-blue-100">Pick a curated path with themed rewards and badges.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {journeys.map((journey) => {
          const progress = progressMap[journey.id];
          const percent = getPercentComplete(
            journey.id,
            progressMap,
            journey.chapters.length
          );
          const isActive = activeJourneyId === journey.id;

          return (
            <div
              key={journey.id}
              className={`rounded-2xl border-2 border-white/30 bg-white/10 backdrop-blur p-4 flex flex-col gap-3 ${
                isActive ? 'ring-4 ring-yellow-300' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-blue-200 flex items-center gap-1">
                    <Map size={12} /> {journey.duration}
                  </p>
                  <h4 className="font-black text-xl">{journey.title}</h4>
                </div>
                <span className="text-[10px] font-black bg-white text-blue-900 px-2 py-1 rounded-full border border-blue-200">
                  {journey.badge}
                </span>
              </div>
              <p className="text-sm text-blue-100 flex-1">{journey.description}</p>
              <div className="bg-blue-800/60 rounded-xl p-3 border border-white/10">
                <p className="text-xs uppercase text-blue-200 mb-1 flex items-center gap-1">
                  <Flag size={12} /> Milestones
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-blue-950 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-yellow-300 h-full transition-all"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-black">{percent}%</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {journey.chapters.slice(0, 3).map((chapter, idx) => (
                  <span
                    key={`${journey.id}-preview-${idx}`}
                    className="px-2 py-1 bg-white/20 rounded-full text-[10px] font-black"
                  >
                    {chapter.book} {chapter.chapter}
                  </span>
                ))}
                {journey.chapters.length > 3 && (
                  <span className="text-[10px] uppercase tracking-widest text-blue-200">
                    +{journey.chapters.length - 3} more
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {!progress && (
                  <button
                    onClick={() => onStart(journey.id)}
                    className="flex-1 bg-yellow-300 text-blue-900 font-black py-2 rounded-full border-2 border-black uppercase text-xs tracking-widest flex items-center justify-center gap-1"
                  >
                    <Play size={14} /> Start
                  </button>
                )}
                {progress && (
                  <>
                    <button
                      onClick={() => onResume(journey.id)}
                      className="flex-1 bg-green-400 text-black font-black py-2 rounded-full border-2 border-black uppercase text-xs tracking-widest flex items-center justify-center gap-1"
                    >
                      <Target size={14} /> Continue
                    </button>
                    <button
                      onClick={() => onAbandon(journey.id)}
                      className="px-3 py-2 text-xs font-black border-2 border-white/40 rounded-full text-white/70 hover:text-white hover:border-white flex items-center gap-1"
                    >
                      <XCircle size={14} /> Reset
                    </button>
                  </>
                )}
              </div>
              {progress && (
                <div className="bg-white/10 rounded-xl p-3 space-y-2">
                  <p className="text-xs uppercase text-blue-200 flex items-center gap-1">
                    <Award size={12} /> Earned Chapters
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {journey.chapters.map((chapter, idx) => {
                      const done = progress.completed.includes(idx);
                      return (
                        <button
                          key={`${journey.id}-chapter-${idx}`}
                          onClick={() => onJumpToChapter(journey.id, idx)}
                          className={`px-2 py-1 rounded-full text-[10px] font-black border ${
                            done
                              ? 'bg-yellow-300 text-blue-900 border-black'
                              : 'bg-white/10 text-white border-white/30'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

