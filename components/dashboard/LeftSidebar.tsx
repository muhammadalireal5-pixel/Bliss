import React from 'react';
import { History, Plus, RefreshCw, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { LeadData } from '@/types';
import { getInitials } from '@/lib/utils';
import { signOut } from 'next-auth/react';

interface LeftSidebarProps {
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (val: boolean) => void;
  setIsModalOpen: (val: boolean) => void;
  totalLeads: number;
  securedLeads: number;
  loading: boolean;
  loadingMessage: string;
  leads: LeadData[];
  selectedLeadIndex: number | null;
  setSelectedLeadIndex: (val: number) => void;
  setIsManualModalOpen: (val: boolean) => void;
  session: any;
}

export default function LeftSidebar({
  isLeftSidebarOpen, setIsLeftSidebarOpen, setIsModalOpen, totalLeads, securedLeads,
  loading, loadingMessage, leads, selectedLeadIndex, setSelectedLeadIndex, setIsManualModalOpen, session
}: LeftSidebarProps) {
  return (
    <>
      {isLeftSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsLeftSidebarOpen(false)} />
      )}
      
      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-80 bg-zinc-950 text-white flex flex-col h-full border-r border-zinc-800 transform transition-transform duration-300 lg:transform-none ${isLeftSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4F700] flex items-center justify-center text-black font-bold">
              ★
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">SayMe</h1>
              <p className="text-[10px] text-zinc-400">Personalized Outreach</p>
            </div>
          </div>
          <Link href="/history" className="p-2 text-zinc-400 hover:text-[#D4F700] rounded-lg transition hover:bg-zinc-900" title="Campaign History">
            <History size={18} />
          </Link>
        </div>

        <div className="p-4 space-y-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-[#D4F700] hover:bg-[#b8d600] text-black font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#d4f700]/10 text-sm"
          >
            <Plus size={16} /> New Campaign
          </button>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
              <span className="text-[10px] text-zinc-400 block font-medium">TOTAL LEADS</span>
              <span className="text-xl font-bold block mt-0.5 text-zinc-100">{totalLeads}</span>
            </div>
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
              <span className="text-[10px] text-zinc-400 block font-medium">SECURED</span>
              <span className="text-xl font-bold block mt-0.5 text-emerald-400">{securedLeads}</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-t border-zinc-800 flex justify-between items-center bg-zinc-900/20">
          <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">FOUND LEADS</span>
          {leads.length > 0 && (
            <button 
              onClick={() => setIsManualModalOpen(true)}
              className="text-[10px] text-[#D4F700] hover:underline flex items-center gap-0.5 font-medium"
            >
              + Add Lead
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3 text-zinc-400">
              <RefreshCw className="animate-spin text-[#D4F700]" size={24} />
              <span className="text-xs animate-pulse text-center px-4 leading-relaxed">{loadingMessage}</span>
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center text-zinc-500 py-12 px-4 text-xs">
              No leads active. Start a campaign or add leads manually to begin outreach.
            </div>
          ) : (
            leads.map((lead, idx) => {
              const isSelected = selectedLeadIndex === idx;
              return (
                <div
                  key={`${lead.email}-${idx}`}
                  onClick={() => setSelectedLeadIndex(idx)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all duration-200 relative group flex gap-3 items-start border ${
                    isSelected 
                      ? 'bg-[#D4F700] text-black border-transparent shadow-md' 
                      : 'bg-zinc-900/30 hover:bg-zinc-900/80 text-zinc-300 border-zinc-900/40 hover:border-zinc-800'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSelected ? 'bg-black text-[#D4F700]' : 'bg-zinc-800 text-zinc-200'
                  }`}>
                    {getInitials(lead.name)}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <h4 className={`text-xs font-bold truncate leading-tight ${
                      isSelected ? 'text-black' : 'text-white font-semibold'
                    }`}>{lead.name}</h4>
                    <p className={`text-[10px] truncate mt-0.5 ${
                      isSelected ? 'text-zinc-800' : 'text-zinc-400'
                    }`}>{lead.email}</p>
                    
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                        isSelected 
                          ? 'bg-black/10 text-black' 
                          : 'bg-zinc-800/80 text-zinc-400'
                      }`}>
                        {lead.source || 'Web'}
                      </span>
                      {lead.generationFailed && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                          isSelected ? 'bg-orange-600 text-white' : 'bg-orange-950/40 text-orange-400 border border-orange-900/20'
                        }`}>
                          FALLBACK
                        </span>
                      )}
                      {lead.secured ? (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                          isSelected ? 'bg-black text-emerald-400' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20'
                        }`}>
                          SECURED
                        </span>
                      ) : (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                          isSelected ? 'bg-black/20 text-black/80' : 'bg-zinc-800/30 text-zinc-500'
                        }`}>
                          DRAFT
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${
                    isSelected ? 'text-black translate-x-0.5' : 'text-zinc-600 group-hover:text-zinc-400'
                  }`} />
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
              {session?.user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-zinc-200 truncate">{session?.user?.name || 'User'}</p>
              <p className="text-[10px] text-zinc-500 truncate">{session?.user?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition"
            title="Sign Out"
          >
            <X size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
