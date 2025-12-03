import React from 'react';
import { X, Heart, User, Sparkles } from 'lucide-react';

interface Props {
  onClose: () => void;
  onDonate: () => void;
}

export const FounderStoryModal: React.FC<Props> = ({ onClose, onDonate }) => {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        
        {/* Hero Header */}
        <div className="bg-slate-900 text-white p-6 relative shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden border-2 border-white/20 shrink-0 flex items-center justify-center">
                <User size={40} className="text-slate-400" />
             </div>
             <div>
                <h2 className="font-serif text-2xl font-bold text-white mb-1">About the Founder</h2>
                <p className="text-slate-400 text-sm">A message from Khulekani Shaun</p>
             </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 overflow-y-auto leading-relaxed text-slate-800">
          <h3 className="font-bold text-xl mb-4 text-slate-900">Why This Project Exists</h3>
          
          <div className="space-y-4 text-base md:text-lg font-serif">
            <p>
              My name is <span className="font-bold text-blue-600">Khulekani Shaun</span>, and I created ScriptureComix after realizing something simple but painful:
            </p>
            <p className="font-bold italic border-l-4 border-yellow-400 pl-4 py-1 my-4 bg-yellow-50">
              People don’t actually understand the Bible.
            </p>
            <p>
              Whenever I explained Scripture to friends, they were amazed — not because I’m special, but because the Bible is deep, visual, layered, and full of meaning that many people simply never get to see.
            </p>
            <p>
              As a developer, an AI enthusiast, and a Bible lover, I combined my skills to build something I wish existed when I first started reading: <span className="font-bold">a visual, interactive, explainable Bible.</span>
            </p>

            <hr className="border-slate-100 my-6"/>

            <p>
              I’m currently unemployed and bootstrapping this project alone. 
              Cloud hosting costs money. AI models cost money. Image generation costs money.
            </p>
            <p className="font-bold text-red-600">
              And I refuse to fill this project with ads — because even I hate ads.
            </p>
            <p>
              So I'm asking those whom God leads: help me keep this project alive. 
              <span className="bg-yellow-100 px-1 font-bold">Even $1 makes a difference.</span>
            </p>
            <p>
              I want to make Bible study accessible to everyone — kids, adults, beginners, and believers from all backgrounds.
            </p>
            <p>
              This project is my calling. And with your help, it can continue.
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
           <button 
              onClick={() => { onClose(); onDonate(); }}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black transition-transform active:scale-[0.99] flex items-center justify-center gap-3 text-lg"
           >
              <Heart size={20} className="text-red-500 fill-red-500" />
              Support the Vision
           </button>
        </div>

      </div>
    </div>
  );
};