import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { Radio, EyeOff, ChevronRight } from 'lucide-react';

export function CheckInMockup() {
  return (
    <PhoneFrame className="shadow-accent/20">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 z-10 sticky top-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-gray-900 tracking-tight">Check In</div>
            <p className="text-xs text-gray-500 font-medium">Creator-only reply view</p>
          </div>
          <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center text-accent">
            <Radio className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 bg-gray-50 overflow-y-auto no-scrollbar pb-10 flex flex-col gap-4">
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-start gap-3">
          <EyeOff className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 font-medium leading-relaxed">
            In-app visibility: replies appear in the creator's view.
          </p>
        </div>

        {/* Received Broadcast */}
        <div className="space-y-2 mt-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
            Received
          </h2>
          
          <div className="bg-white border-2 border-primary/40 rounded-2xl p-4 shadow-sm relative">
            <div className="flex justify-between items-start mb-2">
              <div className="font-bold text-primary text-sm">Sample sender</div>
              <div className="text-[10px] text-gray-400 font-medium">Preview</div>
            </div>
            <div className="text-xs text-gray-500 font-medium mb-1">Family Group</div>
            <div className="text-sm text-gray-800 font-medium mb-3">Has everyone made it home?</div>
            
            <div className="bg-primary/10 rounded-lg p-2 flex items-center justify-between">
              <span className="text-xs font-bold text-primary">Reply to creator</span>
            </div>
          </div>
        </div>

        {/* My Groups */}
        <div className="space-y-2 mt-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent inline-block"></span>
            My Groups
          </h2>
          
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-bold text-gray-900">Study Group</div>
                <div className="bg-secondary/15 text-secondary text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 uppercase">
                  <EyeOff className="w-2 h-2" /> Private
                </div>
              </div>
              <div className="text-xs text-gray-500 font-medium mt-1">Sample members</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </div>

      </div>
    </PhoneFrame>
  );
}
