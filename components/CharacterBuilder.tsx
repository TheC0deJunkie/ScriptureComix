import React, { useState } from 'react';
import { Palette, Star, Trash2, UserPlus, Sparkles } from 'lucide-react';
import { ArtStyle, CustomHero } from '../types';

interface CharacterBuilderProps {
  heroes: CustomHero[];
  activeHeroIds: string[];
  onCreate: (hero: Omit<CustomHero, 'id'>) => void;
  onToggle: (heroId: string) => void;
  onDelete: (heroId: string) => void;
}

const archetypes = [
  "Guardian",
  "Messenger",
  "Strategist",
  "Healer",
  "Reformer",
  "Artist"
];

export const CharacterBuilder: React.FC<CharacterBuilderProps> = ({
  heroes,
  activeHeroIds,
  onCreate,
  onToggle,
  onDelete
}) => {
  const [form, setForm] = useState({
    name: '',
    archetype: archetypes[0],
    mission: '',
    traits: '',
    catchphrase: '',
    artStyle: ArtStyle.COMIC_MODERN,
    palette: '#f97316'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mission.trim()) return;

    const traitsList = form.traits
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    onCreate({
      name: form.name.trim(),
      archetype: form.archetype,
      mission: form.mission.trim(),
      traits: traitsList,
      catchphrase: form.catchphrase.trim(),
      artStyle: form.artStyle,
      palette: form.palette
    });

    setForm(prev => ({
      ...prev,
      name: '',
      mission: '',
      traits: '',
      catchphrase: ''
    }));
  };

  return (
    <div className="bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-purple-100 border-2 border-black rounded-full p-3">
          <UserPlus className="text-purple-600" />
        </div>
        <div>
          <h3 className="comic-font text-2xl uppercase">Character Forge</h3>
          <p className="text-sm text-gray-500">Create heroes that cameo in every comic.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          className="border-2 border-black rounded px-3 py-2 font-bold"
          placeholder="Hero name"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
        <select
          className="border-2 border-black rounded px-3 py-2 font-bold bg-gray-50"
          value={form.archetype}
          onChange={e => setForm({ ...form, archetype: e.target.value })}
        >
          {archetypes.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <textarea
          className="border-2 border-black rounded px-3 py-2 md:col-span-2 min-h-[80px]"
          placeholder="Mission statement (how does this hero serve readers?)"
          value={form.mission}
          onChange={e => setForm({ ...form, mission: e.target.value })}
        />
        <input
          className="border-2 border-black rounded px-3 py-2"
          placeholder="Signature traits (comma separated)"
          value={form.traits}
          onChange={e => setForm({ ...form, traits: e.target.value })}
        />
        <input
          className="border-2 border-black rounded px-3 py-2"
          placeholder="Catchphrase / highlight quote"
          value={form.catchphrase}
          onChange={e => setForm({ ...form, catchphrase: e.target.value })}
        />
        <div className="flex items-center gap-2 border-2 border-black rounded px-3 py-2">
          <Palette size={16} className="text-purple-600" />
          <select
            className="flex-1 bg-transparent font-bold"
            value={form.artStyle}
            onChange={e => setForm({ ...form, artStyle: e.target.value as ArtStyle })}
          >
            {Object.values(ArtStyle).map(style => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 border-2 border-black rounded px-3 py-2">
          <span className="text-xs uppercase text-gray-500 font-bold">Aura</span>
          <input
            type="color"
            value={form.palette}
            onChange={e => setForm({ ...form, palette: e.target.value })}
            className="w-10 h-10 border rounded-full cursor-pointer"
          />
        </div>
        <button
          type="submit"
          className="md:col-span-2 bg-purple-600 text-white font-black py-3 border-2 border-black rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-purple-500 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles size={18} /> Forge Hero
        </button>
      </form>

      <div>
        <h4 className="uppercase text-xs font-bold text-gray-500 mb-2 tracking-widest">Your Cast</h4>
        {heroes.length === 0 ? (
          <p className="text-sm text-gray-500">No custom heroes yet. Create one to personalize each chapter.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {heroes.map(hero => (
              <div
                key={hero.id}
                className="border-2 border-black rounded-xl p-3 bg-gradient-to-br from-white to-gray-50 flex flex-col gap-2"
                style={{ boxShadow: activeHeroIds.includes(hero.id) ? `0 0 0 3px ${hero.palette || '#10b981'}` : undefined }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-lg">{hero.name}</p>
                    <span className="text-xs font-bold text-gray-500">{hero.archetype}</span>
                  </div>
                  <button onClick={() => onDelete(hero.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="text-sm text-gray-600">{hero.mission}</p>
                {hero.traits.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {hero.traits.map(trait => (
                      <span key={trait} className="text-[10px] uppercase bg-gray-200 px-2 py-0.5 rounded-full font-bold tracking-widest">
                        {trait}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => onToggle(hero.id)}
                    className={`text-xs font-black px-3 py-1 rounded-full border-2 border-black flex items-center gap-1 ${activeHeroIds.includes(hero.id) ? 'bg-green-400' : 'bg-white'}`}
                  >
                    <Star size={14} /> {activeHeroIds.includes(hero.id) ? 'Active' : 'Activate'}
                  </button>
                  {hero.catchphrase && (
                    <p className="text-[11px] italic text-gray-500 text-right">"{hero.catchphrase}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

