'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Mail, 
  Users, 
  ChevronRight, 
  RefreshCw, 
  History, 
  FileText, 
  ExternalLink 
} from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignIndex, setSelectedCampaignIndex] = useState<number | null>(null);

  // Fetch history on client mount only
  const [hasFetched, setHasFetched] = useState(false);
  if (typeof window !== 'undefined' && !hasFetched) {
    setHasFetched(true);
    fetch('/api/history')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch campaign history');
        return res.json();
      })
      .then((data) => {
        if (data.history) {
          setHistory(data.history);
          if (data.history.length > 0) {
            setSelectedCampaignIndex(0);
          }
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to load history');
      })
      .finally(() => setLoading(false));
  }

  const activeCampaign = selectedCampaignIndex !== null ? history[selectedCampaignIndex] : null;

  // Safe initials helper
  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || '??';
  };

  return (
    <div className="flex h-screen bg-[#F5F6FA] text-slate-800 overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR (Dark Theme - Campaign History List) */}
      <aside className="w-80 bg-zinc-950 text-white flex flex-col h-full border-r border-zinc-800 z-10">
        {/* Brand Logo & Back to App Link */}
        <div className="p-5 flex items-center justify-between border-b border-zinc-800">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-[#D4F700] rounded-lg transition py-1 px-2 hover:bg-zinc-900 text-xs font-semibold">
            <ArrowLeft size={16} /> Back to Outreach
          </Link>
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800">
            <History size={16} className="text-zinc-400" />
          </div>
        </div>

        {/* List Header */}
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/10">
          <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">PAST CAMPAIGNS</span>
        </div>

        {/* Campaign List Scroll Area */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2 text-zinc-400">
              <RefreshCw className="animate-spin text-[#D4F700]" size={24} />
              <span className="text-xs">Loading campaign log...</span>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 py-12 px-4 text-xs">
              {error}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-zinc-500 py-12 px-4 text-xs">
              No outreach campaigns recorded.
            </div>
          ) : (
            history.map((campaign, idx) => {
              const isSelected = selectedCampaignIndex === idx;
              const dateStr = new Date(campaign.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              
              return (
                <div
                  key={campaign._id || idx}
                  onClick={() => setSelectedCampaignIndex(idx)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all duration-200 relative group border ${
                    isSelected 
                      ? 'bg-[#D4F700] text-black border-transparent shadow-md' 
                      : 'bg-zinc-900/30 hover:bg-zinc-900/80 text-zinc-300 border-zinc-900/40 hover:border-zinc-800'
                  }`}
                >
                  <h4 className={`text-xs font-bold truncate leading-tight ${
                    isSelected ? 'text-black' : 'text-white'
                  }`}>
                    {campaign.targetAudience}
                  </h4>
                  <p className={`text-[10px] mt-1 ${
                    isSelected ? 'text-zinc-800' : 'text-zinc-400'
                  }`}>
                    {dateStr}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[9px] font-bold flex items-center gap-1 ${
                      isSelected ? 'text-black/80' : 'text-zinc-400'
                    }`}>
                      <Users size={10} /> {campaign.leads?.length || 0} leads
                    </span>
                    <span className={`text-[9px] font-bold flex items-center gap-1 ${
                      isSelected ? 'text-emerald-950' : 'text-emerald-400'
                    }`}>
                      <Mail size={10} /> {campaign.leads?.filter((l: any) => l.status === 'sent').length || 0} sent
                    </span>
                  </div>

                  <ChevronRight size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${
                    isSelected ? 'text-black translate-x-0.5' : 'text-zinc-600 group-hover:text-zinc-400'
                  }`} />
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* CENTER AREA (Campaign Detail & Associated Leads) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <span>Campaigns</span>
            <ChevronRight size={12} />
            <span className="text-slate-800 font-semibold">Details</span>
          </div>
        </header>

        {/* Selected Campaign View */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {activeCampaign ? (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Campaign Header Info */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OUTREACH CAMPAIGN TARGET</span>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">{activeCampaign.targetAudience}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Created on {new Date(activeCampaign.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Outreach Reason</span>
                    <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">{activeCampaign.reasonForOutreach}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Offering Description</span>
                    <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">{activeCampaign.offering}</p>
                  </div>
                </div>
              </div>

              {/* Associated Leads Header */}
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-sm text-slate-900">Campaign Leads ({activeCampaign.leads?.length || 0})</h3>
              </div>

              {/* Leads Grid list */}
              <div className="grid grid-cols-1 gap-4">
                {activeCampaign.leads && activeCampaign.leads.length > 0 ? (
                  activeCampaign.leads.map((lead: any, lIdx: number) => (
                    <div key={lead._id || `${lead.email}-${lIdx}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row">
                      {/* Left side details */}
                      <div className="p-5 md:w-80 border-r border-slate-100 shrink-0 space-y-4 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-xs">
                            {getInitials(lead.name)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-slate-900 truncate">{lead.name || 'Unknown'}</h4>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{lead.email}</p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Source:</span>
                            <span className="font-semibold text-slate-700">{lead.source || 'Web'}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Status:</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                              lead.status === 'sent' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-slate-200/80 text-slate-700'
                            }`}>
                              {(lead.status || 'draft').toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {lead.profileUrl && (
                          <a 
                            href={lead.profileUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center justify-center gap-1.5 w-full py-2 text-center text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition"
                          >
                            Profile URL <ExternalLink size={12} />
                          </a>
                        )}
                      </div>

                      {/* Right side Email content preview */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Generated Outreach Email</span>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                            {lead.draftEmail || '(No email draft generated)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-400 py-10 bg-white rounded-2xl border border-slate-100">
                    No leads associated with this campaign.
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-20 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-200/50 flex items-center justify-center">
                <FileText size={32} className="text-slate-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">No Campaign Selected</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">Select a past campaign from the sidebar to inspect details and lead records.</p>
              </div>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
