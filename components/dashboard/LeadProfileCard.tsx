import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { LeadData } from '@/types';
import { getInitials } from '@/lib/utils';

interface LeadProfileCardProps {
  activeLead: LeadData;
  selectedLeadIndex: number | null;
  setLeads: React.Dispatch<React.SetStateAction<LeadData[]>>;
}

export default function LeadProfileCard({ activeLead, selectedLeadIndex, setLeads }: LeadProfileCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-start justify-between gap-6">
      <div className="flex items-start gap-4 shrink-0 max-w-full">
        <div className="w-14 h-14 rounded-2xl bg-[#D4F700]/20 flex items-center justify-center text-xl font-bold text-black border border-[#D4F700]/50 shrink-0 mt-1">
          {getInitials(activeLead.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 truncate">{activeLead.name}</h2>
            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-semibold text-[10px] shrink-0 border border-slate-200">{activeLead.source || 'Web'}</span>
            {activeLead.profileUrl && (
              <a 
                href={activeLead.profileUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-red-500 transition"
              >
                Profile <ArrowUpRight size={12} />
              </a>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 pl-3 pr-2 py-1.5 rounded-lg border border-slate-200">
              <span className="text-xs font-mono text-slate-700 font-medium">{activeLead.email}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(activeLead.email);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition"
                title="Copy Email Address"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </div>

          {activeLead.summary && (
            <p className="text-[11px] text-slate-600 mt-3 max-w-lg leading-relaxed border-l-2 border-[#D4F700] pl-3 py-0.5 italic">
              {activeLead.summary}
            </p>
          )}
        </div>
      </div>

      <div className="flex xl:flex-col items-center xl:items-end justify-between xl:justify-start gap-4 w-full xl:w-auto pt-2 xl:pt-0">
        <label className="flex items-center gap-3 cursor-pointer group">
          <span className={`text-xs font-bold tracking-wide transition-colors ${activeLead.secured ? 'text-emerald-600' : 'text-slate-500 group-hover:text-slate-700'}`}>SECURED</span>
          <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out border ${
            activeLead.secured 
              ? 'bg-emerald-500 border-emerald-600' 
              : 'bg-slate-200 border-slate-300 group-hover:bg-slate-300'
          }`}>
            <div className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform duration-300 ease-in-out shadow-sm flex items-center justify-center ${
              activeLead.secured ? 'translate-x-5' : 'translate-x-0'
            }`}>
              {activeLead.secured && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-600" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              )}
            </div>
          </div>
          <input 
            type="checkbox" 
            className="hidden" 
            checked={!!activeLead.secured}
            onChange={(e) => {
              const idx = selectedLeadIndex;
              if (idx === null) return;
              setLeads(prev => {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], secured: e.target.checked };
                return updated;
              });
            }}
          />
        </label>
      </div>
    </div>
  );
}
