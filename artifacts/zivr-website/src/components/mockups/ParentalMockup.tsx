import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { Shield, ChevronRight, Clock, Users } from 'lucide-react';

export function ParentalMockup() {
  return (
    <PhoneFrame className="shadow-secondary/20">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 z-10 sticky top-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-gray-900 tracking-tight">Family Controls</div>
            <div className="text-[10px] text-gray-400 font-medium">Sample interface</div>
          </div>
          <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
            <Shield className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 bg-gray-50 overflow-y-auto no-scrollbar pb-10">
        
        {/* Child Cards */}
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-green-400/20 to-transparent rounded-bl-full"></div>
            
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-green-400 to-emerald-500 flex items-center justify-center text-white text-lg font-bold">L</div>
              <div>
                <div className="font-bold text-gray-900 text-lg">Leo</div>
                <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                  Sample child
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-gray-400 mb-1"><Clock className="w-4 h-4" /></div>
                <div className="font-bold text-gray-900 text-sm">Configured</div>
                <div className="text-[10px] text-gray-500">Access Schedule</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-gray-400 mb-1"><Users className="w-4 h-4" /></div>
                <div className="font-bold text-gray-900 text-sm">Review</div>
                <div className="text-[10px] text-gray-500">Contact Requests</div>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-xs font-semibold text-secondary">Manage Settings</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-red-400/20 to-transparent rounded-bl-full"></div>
            <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Needs Review
            </div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-400 to-purple-500 flex items-center justify-center text-white text-lg font-bold">E</div>
              <div>
                <div className="font-bold text-gray-900 text-lg">Emma</div>
                <div className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block"></span>
                  Sample status
                </div>
              </div>
            </div>

            <div className="bg-red-50 text-red-700 text-xs p-2 rounded-lg border border-red-100 mb-3 flex items-center gap-2">
              <Shield className="w-3 h-3 shrink-0" />
              <span>Unrecognized contact request</span>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-xs font-semibold text-secondary">Review Alerts</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

      </div>
    </PhoneFrame>
  );
}
