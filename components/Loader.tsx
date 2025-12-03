import React from 'react';

export const Loader: React.FC<{ text?: string }> = ({ text = "Generating..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-black bg-yellow-400 animate-spin transform rotate-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-black bg-red-500 animate-ping opacity-20"></div>
      </div>
      <p className="mt-4 font-bold text-xl comic-font uppercase tracking-widest">{text}</p>
    </div>
  );
};
