import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { CloudUpload, CloudDownload, FileText, ChevronLeft } from 'lucide-react';

export function SettingsMockup() {
  return (
    <PhoneFrame className="shadow-slate-500/20">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 z-10 sticky top-0 shadow-sm flex items-center gap-2">
        <ChevronLeft className="w-6 h-6 text-primary" />
        <div>
          <div className="text-xl font-bold text-gray-900 tracking-tight">Chat Settings</div>
          <div className="text-[10px] text-gray-400 font-medium">Sample data tools</div>
        </div>
      </div>
      <div className="flex-1 bg-gray-50 overflow-y-auto no-scrollbar p-4 space-y-6">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Export & Backup</div>
          
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-gray-600" /></div>
              <div className="flex-1">
                <div className="font-bold text-gray-900 text-sm">Export Available Data as Text</div>
                <div className="text-[10px] text-gray-500">Available chat data</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-gray-600" /></div>
              <div className="flex-1">
                <div className="font-bold text-gray-900 text-sm">Export Available Data as PDF</div>
                <div className="text-[10px] text-gray-500">Available chat data</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><CloudUpload className="w-5 h-5 text-primary" /></div>
              <div className="flex-1">
                <div className="font-bold text-gray-900 text-sm">Create Account Backup</div>
                <div className="text-[10px] text-gray-500">Not end-to-end encrypted</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0"><CloudDownload className="w-5 h-5 text-green-600" /></div>
              <div className="flex-1">
                <div className="font-bold text-gray-900 text-sm">Restore Support</div>
                <div className="text-[10px] text-gray-500">Availability may vary</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}