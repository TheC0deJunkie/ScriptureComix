import React, { useState } from 'react';
import { Users, PlusCircle, Share2, MessageSquare, Target, BookOpen, Send, Crown, LogOut } from 'lucide-react';
import { StudyGroup } from '../types';

interface CollaborativeHubProps {
  groups: StudyGroup[];
  selectedGroupId: string | null;
  displayName: string;
  onCreate: (name: string, focus: string) => void;
  onJoin: (code: string) => void;
  onSelect: (groupId: string) => void;
  onSetTarget: (groupId: string, book: string, chapter: number) => void;
  onAddReflection: (groupId: string, text: string) => void;
  onLeave: (groupId: string) => void;
  onDisplayNameChange: (name: string) => void;
}

export const CollaborativeHub: React.FC<CollaborativeHubProps> = ({
  groups,
  selectedGroupId,
  displayName,
  onCreate,
  onJoin,
  onSelect,
  onSetTarget,
  onAddReflection,
  onLeave,
  onDisplayNameChange
}) => {
  const [createForm, setCreateForm] = useState({ name: '', focus: '' });
  const [joinCode, setJoinCode] = useState('');
  const [reflection, setReflection] = useState('');

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    onCreate(createForm.name.trim(), createForm.focus.trim());
    setCreateForm({ name: '', focus: '' });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoin(joinCode.trim().toUpperCase());
    setJoinCode('');
  };

  const handleReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflection.trim() || !selectedGroup) return;
    onAddReflection(selectedGroup.id, reflection.trim());
    setReflection('');
  };

  return (
    <div className="bg-white border-4 border-black rounded-3xl shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-yellow-200 border-2 border-black rounded-full p-3">
          <Users className="text-slate-900" />
        </div>
        <div>
          <h3 className="comic-font text-2xl uppercase">Collaborative Study HQ</h3>
          <p className="text-sm text-gray-500">Form squads, track a shared plan, and log reflections.</p>
        </div>
      </div>

      <div className="border-2 border-dashed border-black rounded-2xl p-4 bg-slate-50 flex flex-col gap-2">
        <label className="text-xs uppercase font-black text-gray-500 tracking-widest">
          Display name
        </label>
        <input
          className="border-2 border-black rounded px-3 py-2 font-bold"
          placeholder="How should your group see you?"
          value={displayName}
          onChange={e => onDisplayNameChange(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          Shown whenever you join a circle or leave a reflection.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <form onSubmit={handleCreate} className="border-2 border-black rounded-2xl p-4 bg-slate-50 space-y-3">
          <div className="flex items-center gap-2 text-sm font-black uppercase">
            <PlusCircle size={16} /> Start a group
          </div>
          <input
            className="w-full border-2 border-black rounded px-3 py-2 font-bold"
            placeholder="Group name (e.g. Youth Leaders)"
            value={createForm.name}
            onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
          />
          <input
            className="w-full border-2 border-dashed border-black rounded px-3 py-2 text-sm"
            placeholder="Focus (e.g. Justice, Advent prep)"
            value={createForm.focus}
            onChange={e => setCreateForm({ ...createForm, focus: e.target.value })}
          />
          <button className="w-full bg-slate-900 text-white font-black py-2 rounded-full border-2 border-black hover:bg-slate-800 flex items-center justify-center gap-2">
            <Share2 size={16} /> Create
          </button>
        </form>

        <form onSubmit={handleJoin} className="border-2 border-black rounded-2xl p-4 bg-amber-50 space-y-3">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-amber-900">
            <Crown size={16} /> Join with code
          </div>
          <input
            className="w-full border-2 border-black rounded px-3 py-2 font-mono text-lg tracking-[0.3em] uppercase text-center"
            placeholder="CODE"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button className="w-full bg-amber-500 text-black font-black py-2 rounded-full border-2 border-black hover:bg-amber-400 flex items-center justify-center gap-2">
            <Share2 size={16} /> Join
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {groups.length === 0 ? (
          <p className="text-sm text-gray-500 col-span-full">No squads yet. Spin one up or join with a code.</p>
        ) : (
          groups.map(group => (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              className={`border-2 border-black rounded-2xl p-4 text-left transition-all ${group.id === selectedGroupId ? 'bg-slate-900 text-white' : 'bg-slate-50 hover:-translate-y-1'}`}
            >
              <p className="text-xs uppercase tracking-widest text-gray-500">Code: {group.code}</p>
              <h4 className="font-black text-xl">{group.name}</h4>
              <p className="text-sm text-gray-600">{group.focus || 'Open topic'}</p>
              <p className="text-xs text-gray-400 mt-2">{group.members.length} members</p>
            </button>
          ))
        )}
      </div>

      {selectedGroup && (
        <div className="border-4 border-slate-900 rounded-3xl p-5 bg-slate-900 text-white space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-300">Squad focus</p>
              <h4 className="font-black text-2xl">{selectedGroup.name}</h4>
              <p className="text-sm text-slate-100">{selectedGroup.focus || 'General study'}</p>
            </div>
            <button
              onClick={() => onLeave(selectedGroup.id)}
              className="text-xs uppercase font-black tracking-widest px-3 py-1 rounded-full border-2 border-white text-white hover:bg-white hover:text-slate-900 flex items-center gap-1"
            >
              <LogOut size={14} /> Leave
            </button>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-2xl p-4 space-y-3">
            <p className="text-xs uppercase tracking-widest text-slate-200 flex items-center gap-1">
              <Target size={14} /> Reading Plan
            </p>
            <form
              onSubmit={e => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget as HTMLFormElement);
                const book = formData.get('book') as string;
                const chapter = Number(formData.get('chapter'));
                if (book && chapter) onSetTarget(selectedGroup.id, book, chapter);
              }}
              className="flex flex-wrap gap-2"
            >
              <input
                name="book"
                placeholder="Book"
                defaultValue={selectedGroup.targetBook || ''}
                className="flex-1 min-w-[140px] border border-white/30 rounded px-3 py-2 bg-transparent placeholder:text-white/40"
              />
              <input
                name="chapter"
                type="number"
                min={1}
                placeholder="Chapter"
                defaultValue={selectedGroup.targetChapter || ''}
                className="w-24 border border-white/30 rounded px-3 py-2 bg-transparent placeholder:text-white/40"
              />
              <button className="px-4 py-2 bg-white text-slate-900 font-black rounded-full border-2 border-black flex items-center gap-1">
                <BookOpen size={14} /> Sync
              </button>
            </form>
            {selectedGroup.targetBook && (
              <p className="text-sm text-slate-100">Members are studying {selectedGroup.targetBook} {selectedGroup.targetChapter}</p>
            )}
          </div>

          <div className="bg-white rounded-3xl p-4 text-slate-900 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-purple-600" />
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400">Reflection wall</p>
                <p className="font-black text-lg">Share insights</p>
              </div>
            </div>
            <form onSubmit={handleReflection} className="space-y-2">
              <textarea
                className="w-full border-2 border-black rounded-2xl px-4 py-3 min-h-[80px]"
                placeholder={`What stood out to you${displayName ? `, ${displayName}` : ''}?`}
                value={reflection}
                onChange={e => setReflection(e.target.value)}
              />
              <button className="w-full bg-purple-600 text-white font-black py-2 rounded-full border-2 border-black flex items-center justify-center gap-2">
                <Send size={16} /> Share as {displayName || 'You'}
              </button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {selectedGroup.reflections.length === 0 ? (
                <p className="text-sm text-gray-500">No reflections yet.</p>
              ) : (
                selectedGroup.reflections
                  .slice()
                  .reverse()
                  .map(entry => (
                    <div key={entry.id} className="border-2 border-gray-200 rounded-2xl p-3">
                      <p className="text-sm">{entry.text}</p>
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-2">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

