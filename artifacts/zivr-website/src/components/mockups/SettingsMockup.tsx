import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { ChevronLeft, Download } from 'lucide-react';

export function SettingsMockup() {
  return (
    <PhoneFrame className="shadow-slate-500/10 border-white bg-white">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 z-10 sticky top-0 shadow-sm flex items-center gap-2">
        <ChevronLeft className="w-7 h-7 text-primary -ml-2" />
        <div>
          <div className="text-[17px] font-bold text-gray-900 tracking-tight">Chat Settings</div>
        </div>
      </div>
      <div className="flex-1 bg-[#F2F2F7] overflow-y-auto no-scrollbar p-4 space-y-6">
        <div>
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 ml-2">Export & Backup</div>
          
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-white">
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-[16px]">Export Available Data</div>
              </div>
              <Download className="w-5 h-5 text-gray-400" />
            </div>

            <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-white">
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-[16px]">Account Backup</div>
              </div>
              <ChevronRightIcon />
            </div>

            <div className="flex items-center gap-3 p-4 bg-white">
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-[16px]">Restore</div>
              </div>
              <ChevronRightIcon />
            </div>
          </div>
          <div className="text-[12px] text-gray-500 mt-3 mx-2 leading-relaxed">
             Backups are not end-to-end encrypted. Exported files can be shared or saved to your device.
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function ChevronRightIcon() {
   return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="m9 18 6-6-6-6"/></svg>
   )
}
