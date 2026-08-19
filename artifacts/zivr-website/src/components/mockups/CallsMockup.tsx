import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { Phone, Video } from 'lucide-react';

export function CallsMockup() {
  return (
    <PhoneFrame className="shadow-primary/20">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 z-10 sticky top-0 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-gray-900 tracking-tight">Calls preview</div>
          <div className="text-[10px] text-gray-400 font-medium">Live calling not available yet</div>
        </div>
        <span className="text-sm text-primary font-medium">Preview</span>
      </div>
      <div className="bg-white px-4 py-3 border-b border-gray-100 flex gap-2 overflow-x-hidden">
        <div className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full">All</div>
        <div className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-full">Missed</div>
        <div className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-full">Voice</div>
      </div>
      <div className="flex-1 bg-gray-50 overflow-y-auto no-scrollbar pb-10">
        {[
          { name: "Video layout", type: "video", detail: "Contact row preview" },
          { name: "Voice layout", type: "voice", detail: "Contact row preview" },
          { name: "Missed filter", type: "video", detail: "Call list preview" },
          { name: "Recent activity", type: "voice", detail: "Call list preview" }
        ].map((call, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-white border-b border-gray-100">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold relative">
              {call.name[0]}
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-gray-200">
                {call.type === "video" ? <Video className="w-3 h-3 text-gray-500" /> : <Phone className="w-3 h-3 text-gray-500" />}
              </div>
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900">{call.name}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <span>{call.detail}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
                <span className="text-[10px] text-gray-400 font-medium">Preview</span>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {call.type === "video" ? <Video className="w-4 h-4 text-primary" /> : <Phone className="w-4 h-4 text-primary" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}