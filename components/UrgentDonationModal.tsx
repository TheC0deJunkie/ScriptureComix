import React, { useState } from 'react';
import { Heart, X, Users, Lock, Coffee } from 'lucide-react';

interface Props {
  onClose: () => void;
  onDonate: (amount: number, isMonthly: boolean) => void;
}

export const UrgentDonationModal: React.FC<Props> = ({ onClose, onDonate }) => {
  const [amount, setAmount] = useState(5);
  const [isMonthly, setIsMonthly] = useState(true);
  const [customAmount, setCustomAmount] = useState('');

  const handleDonate = () => {
    const finalAmount = customAmount ? parseFloat(customAmount) : amount;
    if (finalAmount > 0) {
      onDonate(finalAmount, isMonthly);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <div className="relative bg-amber-50 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-slide-up border-t-8 border-yellow-500 font-sans">
        
        <button onClick={onClose} className="absolute top-2 right-2 text-amber-800/50 hover:text-amber-900 p-2">
          <X size={20} />
        </button>

        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-yellow-200 p-2 rounded-full text-yellow-800">
              <Heart size={24} fill="currentColor" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-slate-900 italic">An urgent message...</h2>
          </div>

          {/* Social Proof Badge */}
          <div className="flex items-center gap-2 text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full w-fit mb-4">
            <Users size={12} /> 672 readers supported this week
          </div>

          {/* Core Copy */}
          <div className="prose prose-slate mb-6 text-slate-800 leading-relaxed text-sm md:text-base">
            <p className="font-bold">
              We want the Bible to remain free, visual, and interactive for everyone.
            </p>
            <p>
              But AI isn't free. Each image and explanation costs us real money in server fees.
            </p>
            <p>
              If you enjoy ScriptureComix, will you help us keep it alive? <span className="underline decoration-yellow-500 decoration-2">Even $1 makes a difference.</span>
            </p>
            
            {/* Psychological Trigger Box */}
            <div className="bg-white border-l-4 border-red-500 p-3 my-4 shadow-sm text-sm">
              <p className="italic text-slate-600 mb-0">
                ⚠️ <span className="font-bold text-red-600">Most people close this message.</span> If you donate today, you’ll be one of the few supporting millions of future readers.
              </p>
            </div>

            <p className="text-sm">
              Without community support, we may eventually have to limit features. Your support helps keep the Word accessible to everyone.
            </p>
          </div>

          {/* Controls */}
          <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm mb-6">
            <div className="flex justify-center gap-1 bg-amber-100 p-1 rounded-lg mb-4 w-fit mx-auto">
              <button 
                onClick={() => setIsMonthly(false)}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${!isMonthly ? 'bg-white shadow text-amber-900' : 'text-amber-700 hover:text-amber-900'}`}
              >
                One-time
              </button>
              <button 
                onClick={() => setIsMonthly(true)}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${isMonthly ? 'bg-white shadow text-amber-900' : 'text-amber-700 hover:text-amber-900'}`}
              >
                Monthly
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <button
                onClick={() => { setAmount(5); setCustomAmount(''); }}
                className={`py-3 rounded border-2 font-bold transition-all flex flex-col items-center justify-center ${amount === 5 && !customAmount ? 'border-yellow-500 bg-yellow-50 text-yellow-900' : 'border-gray-200 bg-slate-50 hover:border-gray-300'}`}
              >
                <span className="text-lg">$5</span>
                <span className="text-[10px] uppercase font-normal text-slate-500">Most Selected</span>
              </button>
              <button
                onClick={() => { setAmount(12); setCustomAmount(''); }}
                className={`py-3 rounded border-2 font-bold transition-all flex flex-col items-center justify-center ${amount === 12 && !customAmount ? 'border-yellow-500 bg-yellow-50 text-yellow-900' : 'border-gray-200 bg-slate-50 hover:border-gray-300'}`}
              >
                <span className="text-lg">$12</span>
                <span className="text-[10px] uppercase font-normal text-slate-500">AI Supporter</span>
              </button>
               <input 
                type="number" 
                placeholder="Custom"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="p-2 border-2 border-gray-200 rounded text-center focus:outline-none focus:border-yellow-500 font-bold bg-slate-50"
              />
            </div>

            <button 
              onClick={handleDonate}
              className="w-full bg-yellow-500 text-black font-black py-3 rounded-lg shadow-md hover:bg-yellow-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
            >
              <Heart size={20} fill="black" />
              Donate {customAmount ? `$${customAmount}` : `$${amount}`} {isMonthly ? '/ month' : ''}
            </button>
            
            <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-400">
               <Lock size={10} /> Secure payment via Stripe
            </div>
          </div>
        </div>
        
        <div className="bg-amber-100/50 p-3 text-center border-t border-amber-200">
            <button onClick={onClose} className="text-amber-800/60 text-sm font-medium hover:text-amber-800 underline decoration-amber-300 decoration-dotted">
                No thanks, I'll risk it
            </button>
        </div>
      </div>
    </div>
  );
};