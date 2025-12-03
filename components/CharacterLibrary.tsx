
import React, { useState } from 'react';
import { Search, User, X, Sparkles, MessageCircle, Lock } from 'lucide-react';
import { CharacterProfile, UserTier } from '../types';
import { generateCharacterProfile } from '../services/geminiService';
import { Loader } from './Loader';

interface Props {
  onClose: () => void;
  tier: UserTier;
  onUpgrade: () => void;
  currentBook: string;
}

export const CharacterLibrary: React.FC<Props> = ({ onClose, tier, onUpgrade, currentBook }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // Preset popular characters from various canons
  const PRESETS = [
    "Adam", "Eve", "Noah", "Abraham", "Sarah", "Moses", "David", "Elijah", // Old Testament
    "Jesus", "Mary", "Peter", "Paul", "Mary Magdalene", // New Testament
    "Enoch", "Tobit", "Judith", "Maccabees", // Deuterocanonical/Apocrypha
    "Lilith", "Sophia (Gnostic)", "Moroni (LDS)", "Zarahemla" // Extended
  ];

  const handleSearch = async (name: string) => {
    setLoading(true);
    setProfile(null);
    try {
      const data = await generateCharacterProfile(name, currentBook, "English");
      setProfile(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up border-t-8 border-purple-600">
        
        {/* Header */}
        <div className="bg-purple-600 text-white p-6 shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-full"><User size={24} /></div>
             <div>
                <h2 className="font-serif text-2xl font-bold">Character Library</h2>
                <p className="text-purple-100 text-sm">Explore figures from all traditions & lost books</p>
             </div>
          </div>
          <button onClick={onClose} className="hover:bg-purple-500 p-2 rounded-full"><X size={24}/></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
           
           {/* Sidebar / Search */}
           <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-4 overflow-y-auto">
              <div className="relative">
                 <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                 <input 
                   type="text" 
                   placeholder="Search any character..." 
                   className="w-full pl-10 pr-4 py-2 border-2 border-slate-300 rounded-lg focus:border-purple-500 outline-none font-bold"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
                 />
              </div>

              <div className="flex-1">
                 <h3 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Popular Figures</h3>
                 <div className="flex flex-wrap gap-2">
                    {PRESETS.map(name => (
                       <button 
                         key={name}
                         onClick={() => handleSearch(name)}
                         className="px-3 py-1 bg-white border border-slate-200 rounded-full text-sm hover:border-purple-400 hover:text-purple-700 transition-colors"
                       >
                         {name}
                       </button>
                    ))}
                 </div>
              </div>
           </div>

           {/* Content Area */}
           <div className="flex-1 p-8 overflow-y-auto bg-white relative">
              {loading ? (
                 <div className="h-full flex items-center justify-center"><Loader text="Consulting the Archives..." /></div>
              ) : profile ? (
                 <div className="animate-fade-in max-w-2xl mx-auto">
                    <div className="flex items-center gap-4 mb-6">
                       <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center border-2 border-purple-500 text-purple-600 font-bold text-3xl">
                          {profile.name[0]}
                       </div>
                       <div>
                          <h1 className="text-4xl font-serif font-bold text-slate-900">{profile.name}</h1>
                          <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-bold">{profile.role}</span>
                       </div>
                    </div>

                    <div className="prose prose-lg text-slate-700 mb-8">
                       <p className="lead">{profile.description}</p>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                             <h4 className="font-bold text-yellow-800 text-sm uppercase mb-1">Key Verses</h4>
                             <p className="text-sm">{profile.key_verses || "Various texts"}</p>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                             <h4 className="font-bold text-blue-800 text-sm uppercase mb-1">Symbolism</h4>
                             <p className="text-sm">{profile.symbolism || "Historical Figure"}</p>
                          </div>
                       </div>
                    </div>

                    {/* Chat / AI Ask Section */}
                    <div className="border-t border-slate-100 pt-6">
                       <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                          <MessageCircle size={20}/> Ask about {profile.name}
                       </h3>
                       {tier === UserTier.FREE ? (
                          <div className="bg-slate-100 p-6 rounded-xl text-center border-2 border-dashed border-slate-300">
                             <Lock className="mx-auto text-slate-400 mb-2" size={24}/>
                             <p className="text-slate-600 font-medium mb-3">AI Character Chat is available for Supporters</p>
                             <button onClick={onUpgrade} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700">Unlock Chat</button>
                          </div>
                       ) : (
                          <div className="flex gap-2">
                             <input type="text" placeholder={`Ask a question about ${profile.name}...`} className="flex-1 p-3 border-2 border-slate-200 rounded-lg" />
                             <button className="bg-purple-600 text-white px-6 rounded-lg font-bold hover:bg-purple-700">Ask</button>
                          </div>
                       )}
                    </div>
                 </div>
              ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <User size={64} className="mb-4" />
                    <h3 className="text-2xl font-bold font-serif">Select a Character</h3>
                    <p>Search or choose a popular figure to view their profile.</p>
                 </div>
              )}
           </div>

        </div>
      </div>
    </div>
  );
};
