import React, { useState } from 'react';
import { Layers, TrendingUp, Send, X, Eye, MousePointerClick, Reply, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TabId } from '@/components/ui/MobileTabBar';
import { LeadData } from '@/types';
import { useToast } from '@/components/ui/Toast';

interface RightSidebarProps {
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen?: (val: boolean) => void;
  targetAudience: string;
  reasonForOutreach: string;
  offering: string;
  totalLeads: number;
  securedLeads: number;
  leads: LeadData[];
  campaignId: string | null;
  activeMobileTab?: TabId;
}

export default function RightSidebar({
  isRightSidebarOpen, setIsRightSidebarOpen, targetAudience, reasonForOutreach, offering, totalLeads, securedLeads, leads, campaignId, activeMobileTab = 'summary'
}: RightSidebarProps) {
  
  const { success, error } = useToast();
  const [sendingAll, setSendingAll] = useState(false);

  const totalOpens = leads.reduce((sum, l) => sum + (l.opens || 0), 0);
  const totalClicks = leads.reduce((sum, l) => sum + (l.clicks || 0), 0);
  const totalReplies = leads.reduce((sum, l) => sum + (l.replies || 0), 0);
  const totalSent = leads.filter(l => l.status !== 'draft' && l.status !== 'queued').length;
  
  // Responsive display logic
  const mobileHiddenClass = activeMobileTab !== 'summary' ? 'hidden xl:flex' : 'flex';
  
  const handleSendAll = async () => {
    if (!campaignId) return;
    setSendingAll(true);
    try {
      const res = await fetch('/api/send-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      });
      const data = await res.json();
      if (res.ok) {
        success(`Queued ${data.queuedCount} emails to send.`);
        // Note: the leads array would ideally update state to 'queued', but they will reload anyway when user refreshes.
      } else {
        error(data.error || 'Failed to queue emails');
      }
    } catch (e: any) {
      error(e.message || 'Error occurred');
    } finally {
      setSendingAll(false);
    }
  };

  return (
    <>
      {/* Tablet Overlay */}
      {isRightSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 xl:hidden" onClick={() => setIsRightSidebarOpen && setIsRightSidebarOpen(false)} />
      )}
      
      <aside className={`${mobileHiddenClass} fixed xl:relative inset-y-0 right-0 z-40 w-full md:w-80 bg-white border-l border-slate-200 flex-col h-full overflow-hidden shrink-0 transform transition-transform duration-300 xl:transform-none ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'}`}>
        
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
          <h3 className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <div className="p-1.5 bg-primary/20 rounded-md">
              <Layers size={16} className="text-slate-800" strokeWidth={2.5} />
            </div>
            Campaign Summary
          </h3>
          {setIsRightSidebarOpen && (
            <button 
              className="xl:hidden p-2 -mr-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setIsRightSidebarOpen(false)}
              aria-label="Close summary"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-24 xl:pb-6">
          {targetAudience ? (
            <div className="space-y-6">
              
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audience</span>
                  <span className="text-sm font-bold text-slate-900 mt-1 block">{targetAudience}</span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reason</span>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed max-h-32 overflow-y-auto font-medium">{reasonForOutreach}</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Offering</span>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed max-h-32 overflow-y-auto font-medium">{offering}</p>
                </div>
              </div>

              <div className="h-px bg-slate-100 w-full" />

              <div className="bg-primary/10 rounded-2xl p-5 border border-primary/30 space-y-4">
                <div className="flex items-center gap-2 text-black font-bold text-xs uppercase tracking-wide">
                  <TrendingUp size={16} strokeWidth={2.5} /> Progress Details
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">Secured Leads</span>
                    <span className="text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">{securedLeads} / {totalLeads}</span>
                  </div>
                  <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${totalLeads > 0 ? (securedLeads / totalLeads) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-primary/20 grid grid-cols-2 gap-2">
                  <div className="bg-white/60 p-2 rounded-lg border border-primary/20 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Mail size={12}/> Sent</span>
                    <span className="font-bold text-slate-800 text-sm">{totalSent}</span>
                  </div>
                  <div className="bg-white/60 p-2 rounded-lg border border-primary/20 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Eye size={12}/> Opens</span>
                    <span className="font-bold text-slate-800 text-sm">{totalOpens}</span>
                  </div>
                  <div className="bg-white/60 p-2 rounded-lg border border-primary/20 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><MousePointerClick size={12}/> Clicks</span>
                    <span className="font-bold text-slate-800 text-sm">{totalClicks}</span>
                  </div>
                  <div className="bg-white/60 p-2 rounded-lg border border-primary/20 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Reply size={12}/> Replies</span>
                    <span className="font-bold text-emerald-600 text-sm">{totalReplies}</span>
                  </div>
                </div>
              </div>
              
              <Button 
                variant="primary"
                className="w-full py-3 mt-2"
                icon={<Send size={16} />}
                onClick={handleSendAll}
                disabled={!campaignId}
                loading={sendingAll}
              >
                Send All Drafts
              </Button>
            </div>
          ) : (
            <EmptyState 
              icon={<Layers size={24} />}
              title="No Active Campaign"
              description="Start a campaign to see your audience, offering, and outreach progress here."
            />
          )}
        </div>
      </aside>
    </>
  );
}
