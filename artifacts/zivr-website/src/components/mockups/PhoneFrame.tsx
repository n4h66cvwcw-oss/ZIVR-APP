import React from 'react';
import { cn } from '@/lib/utils';

export function PhoneFrame({ 
  children, 
  className,
  frameColor = "border-gray-200 bg-white" 
}: { 
  children: React.ReactNode;
  className?: string;
  frameColor?: string;
}) {
  return (
    <div className={cn("relative mx-auto rounded-[2.5rem] border-[8px] shadow-2xl overflow-hidden aspect-[9/19.5] w-full max-w-[320px] shrink-0", frameColor, className)}>
      {/* Notch / Dynamic Island */}
      <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50 pointer-events-none">
        <div className="w-24 h-full bg-black rounded-b-xl"></div>
      </div>
      
      {/* Screen Content */}
      <div className="w-full h-full relative z-0 flex flex-col bg-gray-50 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
