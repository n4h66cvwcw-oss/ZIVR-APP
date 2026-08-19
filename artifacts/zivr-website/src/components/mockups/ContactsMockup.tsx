import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { Search, UserPlus, RefreshCw, Send } from 'lucide-react';

export function ContactsMockup() {
  return (
    <PhoneFrame className="shadow-green-500/20">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 z-10 sticky top-0 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-gray-900 tracking-tight">Contacts</div>
            <div className="text-[10px] text-gray-400 font-medium">Sample interface</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1.5 rounded-md text-[10px] font-semibold">
              <UserPlus className="w-3 h-3" /> Invite
            </div>
            <div className="flex items-center gap-1 bg-green-500/10 text-green-600 px-2 py-1.5 rounded-md text-[10px] font-semibold">
              <RefreshCw className="w-3 h-3" /> Sync
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-xl">
          <Search className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400 font-medium">Search contacts...</span>
        </div>
      </div>
      <div className="flex-1 bg-gray-50 overflow-y-auto no-scrollbar pb-10">
        <div className="p-4 space-y-5">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Status field preview</div>
            
            <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg relative">
                L
              </div>
              <div className="flex-1">
                <div className="font-bold text-gray-900">Leo</div>
                <div className="text-xs text-gray-500">Sample status value</div>
              </div>
              <div className="flex gap-1">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20"><Send className="w-4 h-4" /></div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Contacts</div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                  D
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900">Dad</div>
                  <div className="text-xs text-gray-500">Last-seen field</div>
                </div>
                <div className="flex gap-1">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20"><Send className="w-4 h-4" /></div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-400 to-rose-400 flex items-center justify-center text-white font-bold text-lg">
                  M
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900">Mom</div>
                  <div className="text-xs text-gray-500">Last-seen field</div>
                </div>
                <div className="flex gap-1">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20"><Send className="w-4 h-4" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}