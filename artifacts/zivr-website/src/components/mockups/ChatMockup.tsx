import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { ChevronLeft, Mic, Plus, Play } from 'lucide-react';

export function ChatMockup() {
  return (
    <PhoneFrame className="shadow-primary/10 border-white bg-white">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-xl px-4 pt-12 pb-3 border-b border-gray-100 flex items-center justify-between z-10 sticky top-0 shadow-sm">
        <div className="flex items-center gap-2">
          <ChevronLeft className="w-7 h-7 text-primary -ml-2" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              E
            </div>
            <div className="-mt-0.5">
              <div className="font-bold text-[15px] text-gray-900 leading-tight tracking-tight">Emma</div>
              <div className="text-[11px] text-gray-400 font-medium">Sample conversation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#F2F2F7] pb-24 no-scrollbar">
        <div className="text-center text-[11px] text-gray-400 font-medium my-1">Today, 9:41 AM</div>
        
        {/* Received text */}
        <div className="flex gap-2 items-end">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-accent to-purple-500 shrink-0 shadow-sm" />
          <div className="bg-[#E5E5EA] text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2 text-[15px] shadow-sm max-w-[80%]">
            Did you finish the math homework?
          </div>
        </div>

        {/* Sent text */}
        <div className="flex justify-end mt-1">
          <div className="bg-primary text-white rounded-2xl rounded-br-sm px-4 py-2 text-[15px] shadow-sm max-w-[80%]">
            Yeah! It took forever though.
          </div>
        </div>

        {/* Musical Message Received */}
        <div className="flex gap-2 items-end mt-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-accent to-purple-500 shrink-0 shadow-sm" />
          <div className="bg-gradient-to-br from-accent to-purple-500 p-[2px] rounded-[18px] rounded-bl-sm shadow-md shadow-accent/20 max-w-[80%] relative overflow-hidden flex-1">
            <div className="bg-white/95 backdrop-blur-md rounded-[16px] rounded-bl-none p-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 text-accent fill-accent ml-0.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-end gap-1 h-6">
                    {[40, 75, 55, 90, 60, 35, 70, 50].map((height, i) => (
                      <div key={i} className="w-1 bg-accent/60 rounded-full" style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Audio clip</div>
            </div>
          </div>
        </div>

        {/* Pre-send translation example */}
        <div className="flex justify-end mt-3">
          <div className="bg-primary text-white rounded-[18px] rounded-br-sm p-[2px] shadow-sm shadow-primary/20 max-w-[80%] relative overflow-hidden">
             <div className="bg-primary rounded-[16px] rounded-br-none px-4 py-2.5 relative z-10">
                <div className="text-[15px]">Cómo estás?</div>
                <div className="mt-2 pt-2 border-t border-white/20 text-white/90 text-[12px] flex flex-col gap-0.5">
                  <span className="font-bold text-[9px] uppercase tracking-wider text-white/70">Original</span>
                  <span>How are you?</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 flex flex-col z-10 pb-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        {/* Suggested Replies */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-3 pb-2">
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider whitespace-nowrap self-center mr-1">Reply</div>
          <div className="bg-gray-100 text-gray-800 px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap border border-gray-200 shadow-sm">Yes, I did!</div>
          <div className="bg-gray-100 text-gray-800 px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap border border-gray-200 shadow-sm">Still working</div>
        </div>
        
        <div className="px-4 pt-2 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm">
            <Plus className="w-5 h-5" />
          </div>
          <div className="flex-1 h-10 bg-gray-100 rounded-full px-4 text-[15px] text-gray-400 flex items-center shadow-inner border border-gray-200/50">
            Message...
          </div>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white shadow-md shadow-primary/30">
            <Mic className="w-5 h-5" />
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
