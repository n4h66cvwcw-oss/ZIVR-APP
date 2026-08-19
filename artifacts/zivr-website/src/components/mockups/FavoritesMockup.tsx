import React from 'react';
import { PhoneFrame } from './PhoneFrame';
import { Star, ChevronDown, FolderOpen } from 'lucide-react';

export function FavoritesMockup() {
  return (
    <PhoneFrame className="shadow-yellow-500/20">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100 z-10 sticky top-0 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-gray-900 tracking-tight">Contacts</div>
          <div className="text-[10px] text-gray-400 font-medium">Sample favorites</div>
        </div>
        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-primary">
          <FolderOpen className="w-4 h-4" />
        </div>
      </div>

      <div className="flex-1 bg-gray-50 overflow-y-auto no-scrollbar pb-10">
        
        {/* Favorites Strip */}
        <div className="bg-white border-b border-gray-200 py-3">
          <div className="flex items-center justify-between px-4 mb-3">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-bold text-gray-900">Favorites</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>

          {/* Group Chips */}
          <div className="flex px-4 gap-2 mb-4 overflow-x-hidden">
            <div className="bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
              All
            </div>
            <div className="bg-white border border-gray-200 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
              Family
            </div>
            <div className="bg-white border border-gray-200 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
              Work
            </div>
          </div>

          {/* Avatar Bubbles */}
          <div className="flex px-4 gap-3 overflow-x-hidden">
            {[
              { name: "Mom", color: "from-pink-400 to-rose-400" },
              { name: "Dad", color: "from-blue-400 to-indigo-500" },
              { name: "Emma", color: "from-purple-400 to-fuchsia-500" },
              { name: "Leo", color: "from-green-400 to-emerald-500" }
            ].map((fav, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={`w-14 h-14 rounded-full bg-gradient-to-tr ${fav.color} flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-white`}>
                  {fav.name[0]}
                </div>
                <span className="text-[10px] font-semibold text-gray-700">{fav.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact List */}
        <div className="p-4 space-y-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pinned contact</div>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-400 to-rose-400 flex items-center justify-center text-white font-bold text-lg relative">
              M
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900">Mom</div>
              <div className="text-xs text-gray-500">Sample contact</div>
            </div>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Star className="w-4 h-4 fill-primary" /></div>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
