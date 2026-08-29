import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-200/50 animate-pulse-shimmer rounded-md ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-3.5 rounded-xl border border-zinc-900/40 bg-zinc-900/30 flex gap-3 items-start animate-pulse-shimmer">
      <div className="w-8 h-8 rounded-full bg-zinc-800 shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 bg-zinc-800 rounded w-24" />
        <div className="h-2 bg-zinc-800 rounded w-32" />
        <div className="flex gap-1 mt-2 pt-1">
          <div className="h-3 bg-zinc-800 rounded w-10" />
          <div className="h-3 bg-zinc-800 rounded w-12" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonEmail() {
  return (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 p-6 flex flex-col space-y-4 rounded-b-2xl">
      <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse-shimmer" />
      <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse-shimmer" />
      <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse-shimmer" />
      <div className="h-4 bg-slate-200 rounded w-2/3 animate-pulse-shimmer" />
      
      <div className="pt-8 h-4 bg-slate-200 rounded w-1/4 animate-pulse-shimmer" />
      <div className="h-4 bg-slate-200 rounded w-1/5 animate-pulse-shimmer" />
      
      <div className="absolute inset-0 flex items-center justify-center">
         <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-600">
           <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           Drafting email...
         </div>
      </div>
    </div>
  );
}
