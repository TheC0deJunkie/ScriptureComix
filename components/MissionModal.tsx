
import React from 'react';
import { Globe, X, Heart } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const MissionModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-slide-up border-t-8 border-blue-600 max-h-[90vh] flex flex-col">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>

        <div className="p-8 overflow-y-auto">
          <div className="text-center mb-6">
            <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <Globe size={32} className="text-blue-600" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-slate-900">Our Mission</h2>
          </div>
          
          <div className="text-slate-700 leading-relaxed space-y-4 text-center">
            <p className="font-bold text-lg text-slate-900">
              Make the Word of God easy for anyone to understand — visually, contextually, and accurately.
            </p>
            <p>
              Most people know the Bible, but very few truly understand it. We want to change that.
            </p>
            
            <div className="bg-slate-50 p-4 rounded-lg text-sm text-left mx-auto max-w-xs border border-slate-200">
              <p className="font-bold mb-2 text-slate-900">We offer:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Multiple Bible canons</li>
                <li>Lost books & Gnostic texts</li>
                <li>Visual storytelling</li>
                <li>AI explanations</li>
                <li>Translations from different traditions</li>
              </ul>
            </div>

            <p className="font-serif text-xl font-bold text-blue-800 italic my-6">
              "We don't choose the books for you. We give you everything so YOU can decide."
            </p>

            <p>
              We do not decide what is inspired or authoritative. We present the full spectrum of texts — from widely accepted canon to historical writings — allowing you to explore, learn, and grow.
            </p>

            <p>
              We believe everyone deserves access, clarity, and understanding, <span className="font-bold text-red-600">free from ads, distractions, and commercial interruptions.</span>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
            <button 
              onClick={onClose}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-sm"
            >
              <Heart size={14} fill="currentColor" className="text-red-400"/> Created with love
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
