import React from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { LeadData } from '@/types';

interface EmailEditorProps {
  activeLead: LeadData;
  selectedLeadIndex: number | null;
  setLeads: React.Dispatch<React.SetStateAction<LeadData[]>>;
  regenerateEmail: (index: number) => void;
}

export default function EmailEditor({ activeLead, selectedLeadIndex, setLeads, regenerateEmail }: EmailEditorProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 space-y-3">
        <div className="flex items-center gap-4">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-16 text-right">To</label>
          <div className="flex items-center">
            <span className="text-xs font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-700 font-semibold">{activeLead.email}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-16 text-right">Subject</label>
          <input 
            type="text" 
            value={activeLead.subject || ''} 
            onChange={(e) => {
              const idx = selectedLeadIndex;
              if (idx === null) return;
              setLeads(prev => {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], subject: e.target.value };
                return updated;
              });
            }}
            placeholder="Email Subject"
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4F700]/50 focus:border-[#D4F700] transition-shadow"
          />
        </div>
      </div>

      <div className="p-6 relative">
        {activeLead.regenerating && (
          <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="animate-spin text-black" size={32} />
            <span className="text-xs font-semibold text-slate-500">Drafting personalized email...</span>
          </div>
        )}

        <textarea
          className="w-full h-80 bg-slate-50/50 p-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4F700]/40 focus:border-[#D4F700] font-mono leading-relaxed transition-shadow"
          value={activeLead.draftEmail}
          onChange={(e) => {
            const idx = selectedLeadIndex;
            if (idx === null) return;
            setLeads(prev => {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], draftEmail: e.target.value };
              return updated;
            });
          }}
          placeholder="Write or edit email draft..."
        />
      </div>

      <div className="p-4 bg-slate-50/85 border-t border-slate-100 flex justify-between items-center">
        <button 
          onClick={() => {
            if (selectedLeadIndex !== null) regenerateEmail(selectedLeadIndex);
          }}
          disabled={activeLead.status === 'sent'}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={activeLead.regenerating ? 'animate-spin' : ''} /> Regenerate
        </button>

        <div className="flex gap-2">
          <button 
            onClick={() => {
              navigator.clipboard.writeText(activeLead.draftEmail);
              console.log('Copied to clipboard!');
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition"
          >
            Copy Draft
          </button>
          <button 
            disabled={true}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-200 text-slate-400 rounded-xl transition cursor-not-allowed border border-slate-200"
          >
            <Send size={14} /> Send (Available Soon)
          </button>
        </div>
      </div>
    </div>
  );
}
