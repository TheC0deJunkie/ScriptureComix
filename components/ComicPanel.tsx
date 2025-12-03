import React, { useState } from 'react';
import { Search, Volume2, Move } from 'lucide-react';
import { ComicPanelData } from '../types';
import { Loader } from './Loader';
import { generateSpeech } from '../services/geminiService';

interface ComicPanelProps {
  data: ComicPanelData;
  index: number;
  onExplain: (text: string) => void;
}

export const ComicPanel: React.FC<ComicPanelProps> = ({ data, index, onExplain }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Audio Playback Handler
  const handlePlayAudio = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      // Combine narrative and dialogue for reading
      const textToRead = `${data.narrative}. ${data.speechBubbles.map(b => `${b.speaker} says: ${b.text}`).join('. ')}`;
      const audioBuffer = await generateSpeech(textToRead);
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = await ctx.decodeAudioData(audioBuffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      
      source.onended = () => setIsPlaying(false);
    } catch (e) {
      console.error("Audio failed", e);
      setIsPlaying(false);
    }
  };

  // Draggable logic
  const handleDragStart = (e: React.DragEvent, bubbleIndex: number) => {
    e.dataTransfer.setData("bubbleIndex", bubbleIndex.toString());
    e.dataTransfer.effectAllowed = "move";
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const [bubbleOffsets, setBubbleOffsets] = useState<{[key: number]: {x: number, y: number}}>({});

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const bubbleIndex = parseInt(e.dataTransfer.getData("bubbleIndex"));
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 50; // centering offset approx
    const y = e.clientY - rect.top - 20;
    
    setBubbleOffsets(prev => ({
      ...prev,
      [bubbleIndex]: { x, y }
    }));
  };

  return (
    <div className="flex flex-col h-full bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:scale-[1.01] transition-transform duration-200 print:shadow-none print:border-2 print:break-inside-avoid">
      
      {/* 1. NARRATIVE HEADER */}
      <div className="relative bg-yellow-100 border-b-4 border-black p-4 min-h-[100px] flex items-start group print:border-b-2">
        <div className="absolute -top-3 -left-3 bg-red-600 text-white border-2 border-black px-3 py-1 shadow-sm z-10 rotate-[-5deg] print:hidden">
          <span className="comic-font text-lg font-bold">#{index + 1}</span>
        </div>
        
        <p className="font-comic font-bold text-base md:text-lg leading-tight text-slate-900 w-full pl-2 pr-16">
          {data.narrative}
        </p>

        <div className="absolute top-2 right-2 flex gap-1 print:hidden">
           <button 
            onClick={handlePlayAudio}
            disabled={isPlaying}
            className={`p-1.5 rounded-full transition-colors ${isPlaying ? 'bg-green-200 text-green-800 animate-pulse' : 'text-slate-400 hover:text-green-600 hover:bg-green-100'}`}
            title="Read Aloud"
          >
            {isPlaying ? <Volume2 size={18} className="animate-bounce"/> : <Volume2 size={18} />}
          </button>
          <button 
            onClick={() => onExplain(data.narrative)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
            title="Explain"
          >
            <Search size={18} />
          </button>
        </div>
      </div>

      {/* 2. IMAGE AREA (Drop Zone for Bubbles) */}
      <div 
        className="relative w-full aspect-square bg-slate-200 flex items-center justify-center overflow-hidden border-b-4 border-black print:border-b-2 group"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {data.isLoadingImage ? (
          <Loader text="Drawing..." />
        ) : data.imageUrl ? (
          <>
            <img 
              src={data.imageUrl} 
              alt={data.visualPrompt}
              className="w-full h-full object-cover"
            />
            {/* Draggable Hint */}
            <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Tip: Drag bubbles here!
            </div>
          </>
        ) : (
          <div className="text-gray-400 p-4 text-center">Waiting...</div>
        )}

        {/* Floating Bubbles (Dropped) */}
        {data.speechBubbles.map((bubble, idx) => {
          const offset = bubbleOffsets[idx];
          if (!offset) return null; // Only render here if moved
          
          return (
             <div 
                key={`float-${idx}`}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                style={{ top: offset.y, left: offset.x }}
                className="absolute z-20 max-w-[150px] cursor-move"
             >
                <div className={`
                  relative border-2 border-black px-3 py-2 shadow-sm
                  ${idx % 2 === 0 ? 'bg-white rounded-xl rounded-bl-none' : 'bg-blue-50 rounded-xl rounded-br-none'}
                `}>
                  <div className="text-[9px] font-bold uppercase mb-0.5 text-gray-500">{bubble.speaker}</div>
                  <p className="font-comic text-xs leading-tight">{bubble.text}</p>
                </div>
             </div>
          );
        })}
      </div>

      {/* 3. DIALOGUE AREA (Default Location) */}
      <div className="p-4 bg-white flex-grow flex flex-col gap-4">
        {data.speechBubbles && data.speechBubbles.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.speechBubbles.map((bubble, idx) => {
               if (bubbleOffsets[idx]) return null; // Don't render if moved to image
               
               return (
                <div 
                  key={idx} 
                  className={`flex ${idx % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                >
                  <div className={`
                    relative max-w-[90%] border-2 border-black px-4 py-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] print:shadow-none cursor-move group
                    ${idx % 2 === 0 ? 'bg-white rounded-2xl rounded-bl-none ml-2' : 'bg-blue-50 rounded-2xl rounded-br-none mr-2'}
                  `}>
                     <Move size={12} className="absolute -right-2 -top-2 text-gray-400 opacity-0 group-hover:opacity-100" />
                    <div className="absolute -top-3 left-2 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase print:border print:border-black">
                      {bubble.speaker}
                    </div>
                    <p className="font-comic text-lg text-black leading-snug mt-1">
                      {bubble.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center py-2 opacity-40">
             <span className="comic-font text-gray-400 text-sm italic border-b-2 border-gray-300 pb-1">...Visual Action Only...</span>
          </div>
        )}

        <div className="mt-auto pt-2 flex justify-between items-end border-t border-gray-100">
           <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">
            {data.verseReference}
          </span>
        </div>
      </div>
    </div>
  );
};