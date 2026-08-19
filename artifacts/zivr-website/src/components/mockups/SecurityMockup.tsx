import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { Lock, ShieldCheck } from 'lucide-react';

export function SecurityMockup() {
  return (
    <PhoneFrame className="shadow-blue-500/20 bg-gray-900 border-gray-800">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black z-0"></div>
      
      <div className="relative z-10 flex flex-col h-full items-center pt-24 px-6 text-center">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
          <Lock className="w-8 h-8 text-primary relative z-10" />
        </div>
        
        <h2 className="text-white text-2xl font-bold mb-1 tracking-tight">Chat Locked</h2>
        <p className="text-primary text-[10px] font-semibold uppercase tracking-wider mb-2">Sample security interface</p>
        <p className="text-gray-400 text-sm font-medium mb-12">Enter your local passcode to open this conversation.</p>
        
        <div className="flex gap-4 mb-12">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-4 h-4 rounded-full border-2 border-primary/50 bg-primary/20"></div>
          ))}
        </div>
        
        <div className="grid grid-cols-3 gap-6 w-full max-w-[240px] text-white text-2xl font-medium mb-12">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <div key={num} className="h-14 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors cursor-pointer">
              {num}
            </div>
          ))}
          <div className="h-14 flex items-center justify-center"></div>
          <div className="h-14 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors cursor-pointer">0</div>
          <div className="h-14 flex items-center justify-center text-primary cursor-pointer hover:bg-white/10 rounded-full transition-colors">
            <Lock className="w-6 h-6" />
          </div>
        </div>

        <div className="mt-auto pb-8 flex items-center gap-2 text-xs text-gray-500 font-medium">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          Sample local-passcode screen
        </div>
      </div>
    </PhoneFrame>
  );
}
