'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Mail, 
  Users, 
  ChevronRight, 
  RefreshCw, 
  History, 
  ExternalLink,
  Menu,
  FileText
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function HistoryPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signup');
    }
  }, [status, router]);

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignIndex, setSelectedCampaignIndex] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || hasFetched) return;
    
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
        setError('Failed to load history');
      })
      .finally(() => setLoading(false));
  }, [hasFetched, status]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <RefreshCw className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const activeCampaign = selectedCampaignIndex !== null ? history[selectedCampaignIndex] : null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* LEFT SIDEBAR (Dark Theme - Campaign History List) */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-full md:w-80 bg-sidebar text-white flex flex-col h-full border-r border-sidebar-border transform transition-transform duration-300 lg:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand Logo & Back to App Link */}
        <div className="p-5 flex items-center justify-between border-b border-sidebar-border bg-sidebar-bg">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-primary rounded-lg transition-colors py-1 px-2 hover:bg-zinc-900 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Back to Outreach">
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-sidebar-border">
            <History size={16} className="text-zinc-400" />
          </div>
        </div>

        {/* List Header */}
        <div className="px-4 py-3 border-b border-sidebar-border bg-zinc-900/40">
          <span className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">PAST CAMPAIGNS</span>
        </div>

        {/* Campaign List Scroll Area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-sidebar-bg pb-24 lg:pb-4">
          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : error ? (
            <div className="text-center p-6 bg-red-950/20 rounded-xl border border-red-900/30">
              <p className="text-xs font-bold text-red-400">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <EmptyState 
              icon={<History size={24} />}
              title="No History"
              description="No outreach campaigns recorded yet."
              dark
            />
          ) : (
            history.map((campaign, idx) => {
              const isSelected = selectedCampaignIndex === idx;
              const dateStr = new Date(campaign.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              
              return (
                <button
                  key={campaign._id || idx}
                  onClick={() => {
                    setSelectedCampaignIndex(idx);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl cursor-pointer transition-colors duration-150 relative group border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected 
                      ? 'bg-primary text-black border-primary shadow-md' 
                      : 'bg-zinc-900/30 hover:bg-zinc-900/80 text-zinc-300 border-zinc-900/40 hover:border-zinc-800'
                  }`}
                  aria-selected={isSelected}
                  role="tab"
                >
                  <h4 className={`text-sm font-bold truncate ${
                    isSelected ? 'text-black' : 'text-white'
                  }`}>
                    {campaign.targetAudience}
                  </h4>
                  <p className={`text-[11px] font-medium mt-1 ${
                    isSelected ? 'text-zinc-800' : 'text-zinc-400'
                  }`}>
                    {dateStr}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-2.5">
                    <span className={`text-[10px] font-bold flex items-center gap-1.5 ${
                      isSelected ? 'text-black/80' : 'text-zinc-400'
                    }`}>
                      <Users size={12} strokeWidth={2.5} /> {campaign.leads?.length || 0} leads
                    </span>
                    <span className={`text-[10px] font-bold flex items-center gap-1.5 ${
                      isSelected ? 'text-emerald-950' : 'text-emerald-400'
                    }`}>
                      <Mail size={12} strokeWidth={2.5} /> {campaign.leads?.filter((l: any) => l.status === 'sent').length || 0} sent
                    </span>
                  </div>

                  <ChevronRight size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${
                    isSelected ? 'text-black translate-x-1' : 'text-zinc-600 group-hover:text-zinc-400'
                  }`} />
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* CENTER AREA (Campaign Detail & Associated Leads) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
              <span>Campaigns</span>
              <ChevronRight size={12} />
              <span className="text-slate-800">Details</span>
            </div>
          </div>
        </header>

        {/* Selected Campaign View */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 pb-24 md:pb-8">
          {activeCampaign ? (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Campaign Header Info */}
              <div className="card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <span className="label">OUTREACH CAMPAIGN TARGET</span>
                    <h2 className="text-xl font-bold text-slate-900 mt-1">{activeCampaign.targetAudience}</h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Created on {new Date(activeCampaign.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="dark"
                    onClick={() => {
                      sessionStorage.setItem('restoreCampaign', JSON.stringify(activeCampaign));
                      router.push('/');
                    }}
                    icon={<ExternalLink size={14} />}
                    className="shrink-0"
                  >
                    Open in Workspace
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="label">Outreach Reason</span>
                    <p className="text-xs font-medium text-slate-700 mt-1.5 leading-relaxed">{activeCampaign.reasonForOutreach}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="label">Offering Description</span>
                    <p className="text-xs font-medium text-slate-700 mt-1.5 leading-relaxed">{activeCampaign.offering}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="label">Total Leads</span>
                    <span className="block text-lg font-bold text-slate-900">{activeCampaign.leads?.length || 0}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="label">Sent</span>
                    <span className="block text-lg font-bold text-slate-900">
                      {activeCampaign.leads?.filter((l: any) => l.status !== 'draft' && l.status !== 'queued').length || 0}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="label">Opened</span>
                    <span className="block text-lg font-bold text-slate-900">
                      {activeCampaign.leads?.reduce((sum: number, l: any) => sum + (l.opens || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="label">Clicked</span>
                    <span className="block text-lg font-bold text-slate-900">
                      {activeCampaign.leads?.reduce((sum: number, l: any) => sum + (l.clicks || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <span className="label">Replied</span>
                    <span className="block text-lg font-bold text-emerald-600">
                      {activeCampaign.leads?.reduce((sum: number, l: any) => sum + (l.replies || 0), 0) || 0}
                    </span>
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
                    <div key={lead._id || `${lead.email}-${lIdx}`} className="card flex flex-col md:flex-row hover:border-slate-300 transition-colors">
                      {/* Left side details */}
                      <div className="p-5 md:w-80 border-b md:border-b-0 md:border-r border-slate-100 shrink-0 space-y-4 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <Avatar name={lead.name} />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm text-slate-900 truncate">{lead.name || 'Unknown'}</h4>
                            <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">{lead.email}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-bold">Source:</span>
                            <span className="font-bold text-slate-800">{lead.source || 'Web'}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-bold">Status:</span>
                            <Badge variant={['sent', 'replied'].includes(lead.status) ? 'success' : 'muted'}>
                              {lead.status || 'draft'}
                            </Badge>
                          </div>
                          {lead.status !== 'draft' && lead.status !== 'queued' && (
                            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-medium text-slate-600">
                              <span>Opens: {lead.opens || 0}</span>
                              <span>Clicks: {lead.clicks || 0}</span>
                            </div>
                          )}
                        </div>

                        {lead.summary && (
                          <div className="pt-3 border-t border-slate-200">
                            <p className="text-[11px] text-slate-600 leading-relaxed italic border-l-2 border-primary pl-2 line-clamp-4">
                              {lead.summary}
                            </p>
                          </div>
                        )}

                        {lead.profileUrl && (
                          <a 
                            href={lead.profileUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center justify-center gap-1.5 w-full py-2 text-center text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            Profile URL <ExternalLink size={14} />
                          </a>
                        )}
                      </div>

                      {/* Right side Email content preview */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          <span className="label">Generated Outreach Email</span>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                            {lead.draftEmail || '(No email draft generated)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState 
                    icon={<Users size={24} />}
                    title="No Leads"
                    description="No leads associated with this campaign."
                    className="bg-white rounded-2xl border border-slate-100"
                  />
                )}
              </div>

            </div>
          ) : (
            <EmptyState 
              icon={<FileText size={32} />}
              title="No Campaign Selected"
              description="Select a past campaign from the sidebar to inspect details and lead records."
            />
          )}
        </div>
      </main>

    </div>
  );
}
