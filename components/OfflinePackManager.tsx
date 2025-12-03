import React from 'react';
import { Download, Trash2, Archive, CloudOff, BookMarked, Play } from 'lucide-react';
import { OfflinePack } from '../types';

interface OfflinePackManagerProps {
  packs: OfflinePack[];
  onClose: () => void;
  onLoad: (packId: string) => void;
  onDelete: (packId: string) => void;
  onExport: (packId: string) => void;
}

export const OfflinePackManager: React.FC<OfflinePackManagerProps> = ({
  packs,
  onClose,
  onLoad,
  onDelete,
  onExport
}) => {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-4xl bg-slate-900 text-white rounded-3xl border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-300 text-slate-900 rounded-full p-3 border-2 border-black">
              <CloudOff />
            </div>
            <div>
              <h3 className="comic-font text-3xl uppercase">Scholar Offline Vault</h3>
              <p className="text-sm text-slate-200">Preload comics for flights, retreats, or low-bandwidth days.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-sm uppercase font-black border-2 border-white px-4 py-2 rounded-full hover:bg-white hover:text-slate-900">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {packs.length === 0 ? (
            <div className="border-2 border-dashed border-white/30 rounded-3xl p-8 text-center">
              <Archive size={48} className="mx-auto text-white/40 mb-4" />
              <p className="text-lg font-black">No offline packs yet</p>
              <p className="text-sm text-slate-300">Generate a comic as a Scholar and tap “Save Offline Pack”.</p>
            </div>
          ) : (
            packs.map(pack => (
              <div key={pack.id} className="bg-white/10 rounded-2xl p-4 border border-white/20 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-200">{pack.book} {pack.chapter}</p>
                    <h4 className="font-black text-2xl">{pack.title}</h4>
                    <p className="text-sm text-slate-200">{pack.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onLoad(pack.id)}
                      className="px-3 py-2 bg-yellow-300 text-slate-900 font-black rounded-full border-2 border-black flex items-center gap-1"
                    >
                      <Play size={16} /> Open
                    </button>
                    <button
                      onClick={() => onExport(pack.id)}
                      className="px-3 py-2 bg-white text-slate-900 font-black rounded-full border-2 border-black flex items-center gap-1"
                    >
                      <Download size={16} /> Export
                    </button>
                    <button
                      onClick={() => onDelete(pack.id)}
                      className="px-3 py-2 border-2 border-white/40 rounded-full text-white/70 hover:text-red-300 hover:border-red-300 flex items-center gap-1"
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-widest">
                  <span className="px-2 py-1 bg-black/50 rounded-full border border-white/20">Panels: {pack.panels.length}</span>
                  <span className="px-2 py-1 bg-black/50 rounded-full border border-white/20">{pack.language}</span>
                  <span className="px-2 py-1 bg-black/50 rounded-full border border-white/20">{pack.version}</span>
                  <span className="px-2 py-1 bg-black/50 rounded-full border border-white/20">{new Date(pack.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10 text-center text-sm text-slate-300 flex items-center justify-center gap-2">
          <BookMarked size={16} /> Offline packs live only on this device. Export JSON to share across devices.
        </div>
      </div>
    </div>
  );
};

