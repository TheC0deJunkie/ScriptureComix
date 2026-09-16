import React, { useState } from 'react';
import { Palette, Star, Trash2, UserPlus, Sparkles, Check } from 'lucide-react';
import { ArtStyle, CustomHero } from '../types';
import { Button, TextInput, TextArea, Field, Select, Eyebrow, EmptyState, cx, useConfirm } from './ui/primitives';

interface CharacterBuilderProps {
  heroes: CustomHero[];
  activeHeroIds: string[];
  heroLimit: number;
  onCreate: (hero: Omit<CustomHero, 'id'>) => void;
  onToggle: (heroId: string) => void;
  onDelete: (heroId: string) => void;
}

const ARCHETYPES = ['Guardian', 'Messenger', 'Strategist', 'Healer', 'Reformer', 'Artist'] as const;
type Archetype = typeof ARCHETYPES[number];

const AURAS = ['#f97316', '#eab308', '#22c55e', '#0ea5e9', '#8b5cf6', '#ec4899', '#ef4444', '#0f172a'];

export const CharacterBuilder: React.FC<CharacterBuilderProps> = ({ heroes, activeHeroIds, heroLimit, onCreate, onToggle, onDelete }) => {
  const confirm = useConfirm();
  const [form, setForm] = useState({
    name: '', archetype: 'Guardian' as Archetype, mission: '', traits: '', catchphrase: '', artStyle: ArtStyle.COMIC_MODERN, palette: AURAS[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mission.trim()) return;
    onCreate({
      name: form.name.trim(),
      archetype: form.archetype,
      mission: form.mission.trim(),
      traits: form.traits.split(',').map(t => t.trim()).filter(Boolean),
      catchphrase: form.catchphrase.trim(),
      artStyle: form.artStyle,
      palette: form.palette,
    });
    setForm(prev => ({ ...prev, name: '', mission: '', traits: '', catchphrase: '' }));
  };

  const remove = async (hero: CustomHero) => {
    if (await confirm({ title: `Remove ${hero.name}?`, description: 'They will no longer appear in your comics. This cannot be undone.', confirmLabel: 'Remove', tone: 'danger' })) onDelete(hero.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="bg-purple-200 border-[3px] border-black rounded-full p-3 shrink-0"><UserPlus className="text-purple-800" /></span>
        <div>
          <h3 className="comic-font text-3xl leading-none">Your cast</h3>
          <p className="text-sm text-slate-600 mt-1">Characters you invent can appear in the comics you generate. Up to {heroLimit} at a time.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border-[3px] border-black rounded-2xl p-4 shadow-[4px_4px_0_0_#000] grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Name"><TextInput placeholder="e.g. Miriam the Scribe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="Role">
          <Select<Archetype>
            ariaLabel="Role"
            value={form.archetype}
            onChange={v => setForm({ ...form, archetype: v })}
            options={ARCHETYPES.map(a => ({ value: a, label: a }))}
            buttonClassName="w-full"
            className="w-full"
          />
        </Field>
        <Field label="What do they do in the story?" className="md:col-span-2">
          <TextArea placeholder="e.g. Asks the questions a first-time reader would ask." value={form.mission} onChange={e => setForm({ ...form, mission: e.target.value })} required />
        </Field>
        <Field label="Traits" hint="Comma separated"><TextInput placeholder="brave, curious, kind" value={form.traits} onChange={e => setForm({ ...form, traits: e.target.value })} /></Field>
        <Field label="Catchphrase" hint="Optional"><TextInput placeholder="“Tell me more.”" value={form.catchphrase} onChange={e => setForm({ ...form, catchphrase: e.target.value })} /></Field>
        <Field label="Drawn in">
          <Select<ArtStyle>
            ariaLabel="Art style"
            value={form.artStyle}
            onChange={v => setForm({ ...form, artStyle: v })}
            options={Object.values(ArtStyle).map(s => ({ value: s, label: s }))}
            icon={<Palette size={14} className="text-purple-600" />}
            buttonClassName="w-full"
            className="w-full"
          />
        </Field>
        <Field label="Aura colour">
          <div role="radiogroup" aria-label="Aura colour" className="flex flex-wrap gap-2 py-1">
            {AURAS.map(c => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.palette === c}
                aria-label={c}
                onClick={() => setForm({ ...form, palette: c })}
                style={{ backgroundColor: c }}
                className={cx('w-8 h-8 rounded-full border-[3px] flex items-center justify-center transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300', form.palette === c ? 'border-black scale-110' : 'border-white shadow')}
              >
                {form.palette === c && <Check size={14} className="text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </Field>
        <Button type="submit" variant="accent" block className="md:col-span-2" disabled={!form.name.trim() || !form.mission.trim()}>
          <Sparkles size={18} /> Add to cast
        </Button>
      </form>

      <div>
        <Eyebrow className="text-slate-500 mb-2">Cast · {activeHeroIds.length}/{heroLimit} active</Eyebrow>
        {heroes.length === 0 ? (
          <EmptyState icon={<UserPlus size={24} />} title="No characters yet" body="Add one above. Active characters get written into the comics you generate." className="py-6" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {heroes.map(hero => {
              const active = activeHeroIds.includes(hero.id);
              return (
                <div
                  key={hero.id}
                  className="border-[3px] border-black rounded-2xl p-3 bg-white flex flex-col gap-2"
                  style={{ boxShadow: active ? `4px 4px 0 0 ${hero.palette || '#10b981'}` : '4px 4px 0 0 #e2e8f0' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 h-8 rounded-full border-2 border-black shrink-0" style={{ backgroundColor: hero.palette || '#10b981' }} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-black text-lg leading-tight truncate">{hero.name}</p>
                        <p className="text-xs font-bold text-slate-500">{hero.archetype}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => remove(hero)} aria-label={`Remove ${hero.name}`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                  </div>
                  <p className="text-sm text-slate-700">{hero.mission}</p>
                  {hero.traits.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {hero.traits.map(trait => <span key={trait} className="text-[10px] uppercase bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-full font-bold tracking-wider">{trait}</span>)}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button size="xs" variant={active ? 'success' : 'secondary'} onClick={() => onToggle(hero.id)} aria-pressed={active}>
                      <Star size={12} className={active ? 'fill-current' : ''} /> {active ? 'In the cast' : 'Add to cast'}
                    </Button>
                    {hero.catchphrase && <p className="text-[11px] italic text-slate-500 text-right truncate">“{hero.catchphrase}”</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
