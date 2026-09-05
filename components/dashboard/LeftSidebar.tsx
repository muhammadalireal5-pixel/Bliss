import { useState } from 'react';
import { Plus, Users, History, X, ChevronRight, Settings, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { LeadData } from '@/types';
import { TabId } from '@/components/ui/MobileTabBar';
import { exportLeadsToCsv } from '@/lib/csv-export';

const SkeletonCard = () => (
  <div className="w-full p-3.5 rounded-xl bg-zinc-900/30 border border-zinc-900/40 animate-pulse">
    <div className="flex gap-3">
      <div className="w-10 h-10 rounded-full bg-zinc-800" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 bg-zinc-800 rounded w-2/3" />
        <div className="h-3 bg-zinc-800 rounded w-1/2" />
        <div className="flex gap-2 mt-2">
          <div className="h-5 bg-zinc-800 rounded w-16" />
          <div className="h-5 bg-zinc-800 rounded w-16" />
        </div>
      </div>
    </div>
  </div>
);

interface LeftSidebarProps {
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (val: boolean) => void;
  setIsModalOpen: (val: boolean) => void;
  setIsCsvModalOpen?: (val: boolean) => void;
  totalLeads: number;
  securedLeads: number;
  loading: boolean;
  loadingMessage: string;
  leads: LeadData[];
  selectedLeadIndex: number | null;
  setSelectedLeadIndex: (val: number) => void;
  setIsManualModalOpen: (val: boolean) => void;
  session: any;
  activeMobileTab?: TabId;
}

export default function LeftSidebar({
  isLeftSidebarOpen, setIsLeftSidebarOpen, setIsModalOpen, setIsCsvModalOpen, totalLeads, securedLeads,
  loading, loadingMessage, leads, selectedLeadIndex, setSelectedLeadIndex, setIsManualModalOpen, session, activeMobileTab = 'leads'
}: LeftSidebarProps) {
  
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const mobileHiddenClass = activeMobileTab !== 'leads' ? 'hidden md:flex' : 'flex';
  
  const displayedLeads = showVerifiedOnly 
    ? leads.filter(l => l.contactMethod === 'email' && !l.alreadyContacted)
    : leads;

  return (
    <>
      {isLeftSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden lg:hidden" onClick={() => setIsLeftSidebarOpen(false)} />
      )}
      
      <aside className={`${mobileHiddenClass} fixed md:relative inset-y-0 left-0 z-40 w-full md:w-72 lg:w-80 bg-sidebar text-white flex-col h-full border-r border-sidebar-border transform transition-transform duration-300 md:transform-none ${isLeftSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-5 flex items-center justify-between border-b border-sidebar-border bg-sidebar-bg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-black font-bold">
              ★
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">SayMe</h1>
              <p className="text-[10px] text-zinc-400 font-medium tracking-wide">AI OUTREACH</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/history" className="p-2 text-zinc-400 hover:text-primary rounded-lg transition-colors hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-primary outline-none" aria-label="Campaign history">
              <History size={18} />
            </Link>
            <Link href="/settings" className="p-2 text-zinc-400 hover:text-primary rounded-lg transition-colors hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-primary outline-none" aria-label="Settings">
              <Settings size={18} />
            </Link>
            <button 
              className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg transition-colors"
              onClick={() => setIsLeftSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 bg-sidebar-bg shrink-0">
          <Button 
            variant="primary" 
            className="w-full shadow-primary/20 shadow-lg py-3"
            onClick={() => setIsModalOpen(true)}
            icon={<Plus size={16} strokeWidth={2.5} />}
          >
            New Campaign
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80">
              <span className="text-[10px] text-zinc-400 block font-bold tracking-wider">LEADS</span>
              <span className="text-xl font-bold block mt-1 text-zinc-100">{totalLeads}</span>
            </div>
            <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80">
              <span className="text-[10px] text-zinc-400 block font-bold tracking-wider">SECURED</span>
              <span className="text-xl font-bold block mt-1 text-emerald-400">{securedLeads}</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-y border-sidebar-border flex justify-between items-center bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider text-zinc-500">FOUND LEADS</span>
            {leads.length > 0 && (
              <button
                onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
                className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded transition-colors ${showVerifiedOnly ? 'bg-primary/20 text-primary' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Filter Email Ready Only"
              >
                <Filter size={10} /> {showVerifiedOnly ? 'Email Ready' : 'All'}
              </button>
            )}
          </div>
          {leads.length > 0 && (
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => exportLeadsToCsv(leads, 'leads')}
                className="text-[10px] text-zinc-300 hover:text-primary transition-colors font-bold flex items-center gap-1 uppercase tracking-wide focus:outline-none focus-visible:underline"
                title="Export all leads to CSV"
              >
                <Download size={11} /> CSV
              </button>
              <button 
                onClick={() => setIsManualModalOpen(true)}
                className="text-[10px] text-primary hover:text-primary-hover transition-colors font-bold flex items-center gap-1 uppercase tracking-wide focus:outline-none focus-visible:underline"
              >
                + Add
              </button>
              {setIsCsvModalOpen && (
                <button 
                  onClick={() => setIsCsvModalOpen(true)}
                  className="text-[10px] text-primary hover:text-primary-hover transition-colors font-bold flex items-center gap-1 uppercase tracking-wide focus:outline-none focus-visible:underline"
                >
                  Import
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-sidebar-bg pb-24 md:pb-4">
          {loading ? (
            <div className="space-y-3">
              <div className="text-xs text-center text-primary font-bold animate-pulse mb-4 pt-2">
                {loadingMessage}
              </div>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : displayedLeads.length === 0 ? (
            <EmptyState 
              icon={<Users size={24} />}
              title={leads.length > 0 ? "No verified leads" : "No Leads Found"}
              description={leads.length > 0 ? "Try showing all leads or searching again." : "Start a campaign or add leads manually."}
              dark
            />
          ) : (
            displayedLeads.map((lead, idx) => {
              const originalIndex = leads.indexOf(lead);
              const isSelected = selectedLeadIndex === originalIndex;
              const isSourceOnly = lead.contactMethod === 'source-only' || !lead.email;

              return (
                <button
                  key={`${lead.email || lead.profileUrl || lead.name}-${idx}`}
                  onClick={() => setSelectedLeadIndex(originalIndex)}
                  className={`w-full text-left p-3.5 rounded-xl cursor-pointer transition-colors duration-150 relative group flex gap-3 items-start border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected 
                      ? 'bg-primary text-black border-primary shadow-md' 
                      : 'bg-zinc-900/30 hover:bg-zinc-900/80 text-zinc-300 border-zinc-900/40 hover:border-zinc-800'
                  }`}
                  aria-selected={isSelected}
                  role="tab"
                >
                  <Avatar 
                    name={lead.name} 
                    size="sm" 
                    theme={isSelected ? 'brand' : 'dark'} 
                  />
                  <div className="flex-1 min-w-0 pr-6">
                    <h4 className={`text-sm font-bold truncate ${
                      isSelected ? 'text-black' : 'text-white group-hover:text-white transition-colors'
                    }`}>{lead.name}</h4>
                    <p className={`text-[11px] truncate mt-0.5 ${
                      isSelected ? 'text-zinc-800 font-medium' : 'text-zinc-400'
                    }`}>
                      {isSourceOnly ? (lead.contactSource || lead.profileUrl || 'Manual Outreach') : lead.email}
                    </p>
                    
                    <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
                      <Badge variant={isSelected ? 'default' : 'muted'}>{lead.source || 'Web'}</Badge>
                      {isSourceOnly ? (
                        <Badge variant={isSelected ? 'default' : 'warning'}>SOURCE ONLY</Badge>
                      ) : (
                        <Badge variant={isSelected ? 'default' : 'success'}>EMAIL READY</Badge>
                      )}
                      {lead.alreadyContacted && (
                        <Badge variant={isSelected ? 'default' : 'error'}>CONTACTED</Badge>
                      )}
                      {lead.secured ? (
                        <Badge variant={isSelected ? 'default' : 'success'}>SECURED</Badge>
                      ) : (
                        <Badge variant={isSelected ? 'default' : 'muted'}>DRAFT</Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${
                    isSelected ? 'text-black translate-x-1' : 'text-zinc-600 group-hover:text-zinc-400'
                  }`} />
                </button>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-sidebar-border bg-sidebar-bg flex items-center justify-between shrink-0 mb-[60px] md:mb-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar name={session?.user?.name || 'User'} size="sm" theme="dark" />
            <div className="truncate">
              <p className="text-xs font-bold text-zinc-200 truncate">{session?.user?.name || 'User'}</p>
              <p className="text-[10px] font-medium text-zinc-500 truncate">{session?.user?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="Sign out"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      </aside>
    </>
  );
}
