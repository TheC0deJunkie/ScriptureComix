import React, { useState } from 'react';
import { Heart, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  onDonate: () => void;
}

export const DonationBanner: React.FC<Props> = ({ onDonate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 border-b border-red-200 shadow-sm print:hidden">
      <div className="container mx-auto max-w-5xl p-3">
        {isExpanded ? (
          <div className="animate-fade-in">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="hidden md:block bg-red-100 p-3 rounded-full text-red-600 animate-pulse mt-1">
                  <Heart size={24} fill="currentColor" />
                </div>
                <div>
                  <h3 className="font-bold text-red-800 text-lg mb-1 font-serif italic">
                    A humble request from the creators...
                  </h3>
                  <p className="text-slate-800 text-sm md:text-base leading-relaxed max-w-3xl">
                    This project is kept alive by readers like you. We refuse to put ads on God’s Word. 
                    We’re using AI models we can barely afford, and honestly... we might not make it through this month without help. 
                    <span className="font-bold block mt-2">If this project has blessed you, even $1 makes a real difference.</span>
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <button onClick={onDonate} className="bg-red-600 text-white px-6 py-2 rounded-full font-bold shadow hover:bg-red-700 transition-transform active:scale-95 flex items-center gap-2">
                      <Heart size={16} fill="white" /> Support with $1
                    </button>
                    <button onClick={onDonate} className="bg-white text-red-700 border border-red-200 px-4 py-2 rounded-full font-medium hover:bg-red-50 transition-colors">
                      $3
                    </button>
                    <button onClick={onDonate} className="bg-white text-red-700 border border-red-200 px-4 py-2 rounded-full font-medium hover:bg-red-50 transition-colors">
                      $5
                    </button>
                    <span className="text-xs text-slate-500 italic ml-2">If you can’t donate right now, we still love you ❤️</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                 <button onClick={() => setIsVisible(false)} className="text-slate-400 hover:text-slate-600 p-1" title="Dismiss">
                   <X size={20} />
                 </button>
                 <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-slate-600 p-1 mt-auto" title="Collapse">
                   <ChevronUp size={20} />
                 </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(true)}>
             <div className="flex items-center gap-2 text-sm font-medium text-red-800">
               <Heart size={16} fill="currentColor" className="text-red-600" />
               <span>Please help keep ScriptureComix online...</span>
             </div>
             <ChevronDown size={16} className="text-red-400" />
          </div>
        )}
      </div>
    </div>
  );
};