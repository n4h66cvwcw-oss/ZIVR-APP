import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { Shield, ChevronRight } from 'lucide-react';

export function ParentalMockup() {
  return (
    <PhoneFrame className="shadow-secondary/10 border-white bg-white">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 z-10 sticky top-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-gray-400">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </div>
            <div>
              <div className="text-[17px] font-bold text-gray-900 tracking-tight">Family Controls</div>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 bg-[#F2F2F7] overflow-y-auto no-scrollbar pb-10">
        
        {/* Banner */}
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 mb-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-accent mt-0.5 shrink-0" />
          <div className="text-[13px] text-gray-700 leading-snug">
            Monitor activity, set screen time, and approve contacts for your kids.
          </div>
        </div>

        {/* Alert Prefs */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-4">
           <div className="flex gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              </div>
              <div>
                 <div className="font-bold text-[15px] text-gray-900">Safety alerts</div>
                 <div className="text-[13px] text-gray-500">Choose which severities notify you</div>
              </div>
           </div>
           <div className="flex gap-2">
              <div className="flex-1 border border-gray-200 rounded-lg p-2 text-center opacity-50">
                 <div className="font-bold text-[11px] text-gray-900">ALL</div>
              </div>
              <div className="flex-1 border-2 border-accent bg-accent/5 rounded-lg p-2 text-center">
                 <div className="font-bold text-[11px] text-accent">MEDIUM+</div>
              </div>
              <div className="flex-1 border border-gray-200 rounded-lg p-2 text-center opacity-50">
                 <div className="font-bold text-[11px] text-gray-900">HIGH</div>
              </div>
           </div>
        </div>

        {/* Child Cards */}
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-secondary to-emerald-500 flex items-center justify-center text-white text-[18px] font-bold shadow-sm">L</div>
              <div className="flex-1">
                <div className="font-bold text-gray-900 text-[16px]">Leo</div>
                <div className="text-[13px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-secondary inline-block"></span>
                  Online
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-purple-500 flex items-center justify-center text-white text-[18px] font-bold shadow-sm">E</div>
              <div className="flex-1">
                <div className="font-bold text-gray-900 text-[16px]">Emma</div>
                <div className="text-[13px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>
                  Offline
                </div>
              </div>
              <div className="bg-destructive text-white text-[12px] font-bold h-6 min-w-[24px] px-2 flex items-center justify-center rounded-full">
                2
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>

      </div>
    </PhoneFrame>
  );
}
