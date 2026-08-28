import React from 'react';
import { Layers, TrendingUp, Send } from 'lucide-react';

interface RightSidebarProps {
  isRightSidebarOpen: boolean;
  targetAudience: string;
  reasonForOutreach: string;
  offering: string;
  totalLeads: number;
  securedLeads: number;
}

export default function RightSidebar({
  isRightSidebarOpen, targetAudience, reasonForOutreach, offering, totalLeads, securedLeads
}: RightSidebarProps) {
  return (
    <aside className={`fixed lg:relative inset-y-0 right-0 z-50 w-80 bg-white border-l border-slate-200 p-6 flex flex-col h-full overflow-y-auto shrink-0 transform transition-transform duration-300 lg:transform-none ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
      <h3 className="text-sm font-bold tracking-tight text-slate-900 mb-4 flex items-center gap-2">
        <Layers size={16} className="text-[#D4F700]" /> Campaign Summary
      </h3>

      {targetAudience ? (
        <div className="space-y-5 flex-1">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audience</span>
            <span className="text-sm font-semibold text-slate-900 mt-1 block">{targetAudience}</span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reason</span>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-h-32 overflow-y-auto">{reasonForOutreach}</p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Offering</span>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-h-32 overflow-y-auto">{offering}</p>
          </div>

          <div className="bg-[#D4F700]/10 rounded-2xl p-5 border border-[#D4F700]/30 space-y-4">
            <div className="flex items-center gap-2 text-black font-semibold text-xs">
              <TrendingUp size={16} /> Progress Details
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">Secured Leads</span>
                <span className="text-slate-900">{securedLeads} / {totalLeads}</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${totalLeads > 0 ? (securedLeads / totalLeads) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          
          <button 
            disabled={true}
            className="w-full bg-slate-200 border border-slate-200 text-slate-400 font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-not-allowed"
          >
            <Send size={16} /> Send All Drafts (Available Soon)
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center px-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
            <Layers size={24} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-600">No Active Campaign</p>
          <p className="text-xs text-slate-400 mt-1">Start a campaign to see summary here.</p>
        </div>
      )}
    </aside>
  );
}
