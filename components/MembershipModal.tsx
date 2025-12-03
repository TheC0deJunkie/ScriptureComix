
import React from 'react';
import { X, CheckCircle, Lock, Crown, Star, Sparkles, BookOpen, Download, Globe, Palette, Shield, Compass } from 'lucide-react';
import { UserTier } from '../types';

interface Props {
  currentTier: UserTier;
  onClose: () => void;
  onUpgrade: (tier: UserTier) => void;
}

export const MembershipModal: React.FC<Props> = ({ currentTier, onClose, onUpgrade }) => {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-7xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-slide-up font-sans">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center relative border-b-4 border-yellow-500 shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24}/></button>
          <div className="inline-block bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-3">Upgrade Your Journey</div>
          <h2 className="text-3xl md:text-5xl font-black italic tracking-wider text-white mb-2">CHOOSE YOUR PATH</h2>
          <p className="text-slate-300 max-w-2xl mx-auto text-lg">
            From curious beginner to serious scholar, we have a plan for you.
          </p>
        </div>

        {/* Tiers Grid */}
        <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-slate-50">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              
              {/* PLAN 1: FREE */}
              <div className="bg-white border-2 border-slate-200 rounded-xl p-6 flex flex-col relative hover:shadow-lg transition-shadow">
                  <div className="mb-4">
                     <h3 className="font-bold text-xl text-slate-500 uppercase tracking-widest">Free Plan</h3>
                     <div className="text-4xl font-black text-slate-900">$0</div>
                     <p className="text-sm text-slate-400 mt-1">For beginners & students</p>
                  </div>
                  
                  <div className="space-y-4 mb-8 flex-grow">
                     <div className="text-sm font-bold text-slate-900 border-b pb-1">Includes:</div>
                     <ul className="space-y-2">
                       <li className="flex gap-2 text-sm text-slate-600"><CheckCircle size={16} className="text-green-500 shrink-0"/> NIV, KJV, The Message</li>
                       <li className="flex gap-2 text-sm text-slate-600"><CheckCircle size={16} className="text-green-500 shrink-0"/> 20 AI Explanations / Day</li>
                       <li className="flex gap-2 text-sm text-slate-600"><CheckCircle size={16} className="text-green-500 shrink-0"/> 1 Art Style (Modern Comic)</li>
                       <li className="flex gap-2 text-sm text-slate-600"><CheckCircle size={16} className="text-green-500 shrink-0"/> <span className="font-bold">Specific Lost Books:</span></li>
                       <li className="text-xs text-slate-500 ml-6">Enoch, Jubilees, Jasher, Quran, Mormon (Basic)</li>
                     </ul>
                  </div>
                  <button onClick={onClose} className="w-full py-3 border-2 border-slate-300 text-slate-500 font-bold rounded-lg hover:bg-slate-50 transition-colors">
                    Current Plan
                  </button>
              </div>

              {/* PLAN 2: EXPLORER */}
              <div className="bg-white border-2 border-blue-500 rounded-xl p-6 shadow-xl flex flex-col relative z-10 transform lg:-translate-y-2 ring-1 ring-blue-500/20">
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">MOST POPULAR</div>
                  <div className="mb-4">
                     <h3 className="font-bold text-xl text-blue-700 flex items-center gap-2"><Compass size={22}/> Explorer Plan</h3>
                     <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black text-slate-900">$5</span>
                        <span className="text-sm font-normal text-slate-500">/mo</span>
                     </div>
                     <p className="text-sm text-blue-600 mt-1 font-medium">For curious minds</p>
                  </div>
                  
                  <div className="space-y-4 mb-8 flex-grow">
                     <div className="text-sm font-bold text-slate-900 border-b pb-1">Everything in Free, plus:</div>
                     <ul className="space-y-2">
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-blue-500 shrink-0"/> <span><strong className="text-slate-900">50</strong> AI Explanations / Day</span></li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-blue-500 shrink-0"/> <span>Unlock <strong className="text-slate-900">+5 Major Translations</strong></span></li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-blue-500 shrink-0"/> <span>Unlock <strong className="text-slate-900">3 Art Styles</strong></span></li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-blue-500 shrink-0"/> <span className="font-bold">Unlock ALL Canons:</span></li>
                       <li className="text-xs text-slate-500 ml-6">Jewish, Catholic, Orthodox, LDS, Apocrypha</li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-blue-500 shrink-0"/> <span>Explorer Badge</span></li>
                     </ul>
                  </div>
                  <button onClick={() => onUpgrade(UserTier.EXPLORER)} className="w-full py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-blue-200/50 transition-all transform hover:scale-[1.02]">
                    Start Exploring
                  </button>
              </div>

              {/* PLAN 3: SCHOLAR */}
              <div className="bg-white border-2 border-yellow-500 rounded-xl p-6 shadow-2xl flex flex-col relative z-20 transform lg:-translate-y-4 ring-4 ring-yellow-500/10">
                  <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 rounded-t-xl"></div>
                  <div className="mb-4">
                     <h3 className="font-bold text-xl text-yellow-700 flex items-center gap-2"><Crown size={22} className="fill-yellow-500"/> Scholar Plan</h3>
                     <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black text-slate-900">$15</span>
                        <span className="text-sm font-normal text-slate-500">/mo</span>
                     </div>
                     <p className="text-sm text-yellow-600 mt-1 font-medium">The ultimate experience</p>
                  </div>
                  
                  <div className="space-y-4 mb-8 flex-grow">
                     <div className="text-sm font-bold text-slate-900 border-b pb-1">Everything in Explorer, plus:</div>
                     <ul className="space-y-2">
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-yellow-600 shrink-0"/> <span><strong className="text-slate-900">Unlimited</strong> AI Tutor</span></li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-yellow-600 shrink-0"/> <span>Unlock <strong className="text-slate-900">ALL Translations</strong></span></li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-yellow-600 shrink-0"/> <span>Unlock <strong className="text-slate-900">ALL Languages</strong></span></li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-yellow-600 shrink-0"/> <span>Unlock <strong className="text-slate-900">ALL Art Styles</strong></span></li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-yellow-600 shrink-0"/> <span>Offline PDF Downloads</span></li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-yellow-600 shrink-0"/> <span>Advanced Study Tools</span></li>
                       <li className="flex gap-2 text-sm text-slate-700"><CheckCircle size={16} className="text-yellow-600 shrink-0"/> <span>Scholar Badge</span></li>
                     </ul>
                  </div>
                  <button onClick={() => onUpgrade(UserTier.SCHOLAR)} className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-lg hover:from-yellow-600 hover:to-orange-600 shadow-xl hover:shadow-yellow-200/50 transition-all transform hover:scale-[1.02]">
                    Become a Scholar
                  </button>
              </div>

           </div>
        </div>
      </div>
    </div>
  );
};
