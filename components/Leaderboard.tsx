import React from 'react';
import { Flame, Sparkles, Trophy, Crown, Heart } from 'lucide-react';
import { ReaderProfile, UserStats, UserTier } from '../types';

interface LeaderboardProps {
  profile: ReaderProfile;
  stats: UserStats;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ profile, stats }) => {
  const rows = [
    {
      name: profile.displayName || 'You',
      streak: stats.streak,
      xp: stats.xp,
      tier: stats.tier,
      donor: stats.tier !== UserTier.FREE,
      isSelf: true,
    },
    {
      name: 'Genesis Squad',
      streak: 12,
      xp: 1800,
      tier: UserTier.EXPLORER,
      donor: true,
      isSelf: false,
    },
    {
      name: 'Quiet Monk',
      streak: 30,
      xp: 2600,
      tier: UserTier.SCHOLAR,
      donor: true,
      isSelf: false,
    },
  ]
    .sort((a, b) => b.streak - a.streak || b.xp - a.xp)
    .slice(0, 5);

  return (
    <div className="bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-300 border-2 border-black rounded-full p-2">
            <Trophy className="text-slate-900" size={16} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Engagement</p>
            <h3 className="comic-font text-xl">Streak Leaderboard</h3>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        {rows.map((row, index) => (
          <div
            key={row.name}
            className={`flex items-center justify-between px-3 py-2 rounded-2xl border-2 border-black ${
              row.isSelf ? 'bg-yellow-100' : 'bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 text-xs font-black text-gray-500">#{index + 1}</span>
              <span className="font-black text-sm">{row.name}</span>
              {row.donor && (
                <span className="flex items-center gap-1 text-[10px] uppercase text-pink-600">
                  <Heart size={10} /> Patron
                </span>
              )}
              {row.tier === UserTier.SCHOLAR && (
                <Crown size={12} className="text-yellow-500" />
              )}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <Flame className="text-orange-500" size={14} /> {row.streak}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="text-purple-500" size={14} /> {row.xp}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};



