import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { ChevronLeft, Mic, Plus, Play } from 'lucide-react';

export function ChatMockup() {
  return (
    <PhoneFrame className="shadow-primary/20">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md px-4 pt-10 pb-3 border-b border-gray-100 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <ChevronLeft className="w-6 h-6 text-primary" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
              E
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 leading-tight">Emma</div>
              <div className="text-[10px] text-gray-400 font-medium">Sample conversation</div>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 font-medium">Preview</div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50 pb-20 no-scrollbar">
        <div className="text-center text-[10px] text-gray-400 font-medium my-2">Today, 9:41 AM</div>
        
        {/* Received text */}
        <div className="flex gap-2 items-end">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-400 to-purple-500 shrink-0" />
          <div className="bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-sm px-4 py-2 text-sm shadow-sm max-w-[80%]">
            Did you finish the math homework?
          </div>
        </div>

        {/* Sent text */}
        <div className="flex justify-end">
          <div className="bg-primary text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm shadow-sm shadow-primary/20 max-w-[80%]">
            Yeah! It took forever though.
          </div>
        </div>

        {/* Musical Message Received */}
        <div className="flex gap-2 items-end mt-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-400 to-purple-500 shrink-0" />
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-[2px] rounded-2xl rounded-bl-sm shadow-md shadow-pink-500/20 max-w-[80%] relative overflow-hidden">
            <div className="bg-white rounded-[14px] rounded-bl-none p-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 text-pink-600 fill-pink-600 ml-0.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-end gap-1 h-6">
                    {[40, 75, 55, 90, 60, 35, 70, 50].map((height, i) => (
                      <div key={i} className="w-1 bg-pink-400 rounded-full" style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs font-medium text-gray-800">Audio attachment</div>
            </div>
          </div>
        </div>

        {/* Pre-send translation example */}
        <div className="flex justify-end mt-2">
          <div className="bg-primary text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm shadow-sm max-w-[80%]">
            <div>¿Cómo estás?</div>
            <div className="mt-1 pt-1 border-t border-white/20 text-blue-100 text-xs flex items-center gap-1">
              <span className="font-semibold text-[10px] uppercase">Original</span> How are you?
            </div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 flex flex-col z-10">
        {/* Suggested Replies */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-3 pb-2 border-b border-gray-100/50">
          <div className="text-[10px] text-gray-400 font-semibold whitespace-nowrap self-center">Optional suggestions</div>
          <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">Yes, I did!</div>
          <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">Still working on it</div>
        </div>
        
        <div className="p-4 pb-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <Plus className="w-5 h-5" />
          </div>
          <div className="flex-1 h-9 bg-gray-100 rounded-full px-4 text-sm text-gray-400 flex items-center border border-gray-200/50">
            Message Emma...
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-sm shadow-primary/30">
            <Mic className="w-4 h-4" />
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
