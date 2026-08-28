'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Send, 
  RefreshCw, 
  Plus, 
  History, 
  FileText, 
  LayoutDashboard, 
  X, 
  ChevronRight, 
  TrendingUp, 
  PlusCircle, 
  Layers, 
  ArrowUpRight,
  AlertCircle,
  Menu
} from 'lucide-react';
import Link from 'next/link';
import { LeadData } from '@/types';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signup');
    }
  }, [status, router]);

  // Restore campaign from history if present
  useEffect(() => {
    const restoreData = sessionStorage.getItem('restoreCampaign');
    if (restoreData) {
      try {
        const campaign = JSON.parse(restoreData);
        setTargetAudience(campaign.targetAudience || '');
        setReasonForOutreach(campaign.reasonForOutreach || '');
        setOffering(campaign.offering || '');
        setCampaignId(campaign._id || null);
        if (campaign.leads && campaign.leads.length > 0) {
          setLeads(campaign.leads);
          setSelectedLeadIndex(0);
        }
      } catch (e) {
        console.error('Failed to restore campaign', e);
      }
      sessionStorage.removeItem('restoreCampaign');
    }
  }, []);

  // Campaign inputs
  const [targetAudience, setTargetAudience] = useState('');
  const [reasonForOutreach, setReasonForOutreach] = useState('');
  const [offering, setOffering] = useState('');
  
  // App state
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [selectedLeadIndex, setSelectedLeadIndex] = useState<number | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Manual lead inputs
  const [manualLeadName, setManualLeadName] = useState('');
  const [manualLeadEmail, setManualLeadEmail] = useState('');
  const [manualLeadSource, setManualLeadSource] = useState('Manual');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualGenerating, setManualGenerating] = useState(false);

  // Responsive UI state
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  
  const [loadingMessage, setLoadingMessage] = useState('Initializing search...');

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F6FA]">
        <RefreshCw className="animate-spin text-[#D4F700]" size={32} />
      </div>
    );
  }

  // Statistics
  const totalLeads = leads.length;
  const securedLeads = leads.filter(l => l.secured).length;
  const draftLeads = leads.filter(l => l.status === 'draft').length;

  const handleSearchAndGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    setLoading(true);

    const messages = [
      "Searching Google & LinkedIn...",
      "Analyzing profiles with Gemini...",
      "Extracting verified emails...",
      "Synthesizing bio summaries...",
      "Finalizing lead list..."
    ];
    let msgIndex = 0;
    setLoadingMessage(messages[0]);
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length;
      setLoadingMessage(messages[msgIndex]);
    }, 2500);
    try {
      // 1. Search for leads
      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAudience })
      });
      
      if (!searchRes.ok) {
        const errorText = await searchRes.text();
        throw new Error(`Search failed: ${errorText}`);
      }

      const searchData = await searchRes.json();
      if (searchData.error) throw new Error(searchData.error);
      
      const foundLeads = searchData.leads || [];

      if (foundLeads.length === 0) {
        console.log('No profiles with public emails found. Try a different audience or search term.');
        setLoading(false);
        return;
      }

      // 2. Generate emails for all leads in one batch request
      let leadsWithEmails: LeadData[] = [];
      let failedCount = 0;

      try {
        const batchRes = await fetch('/api/generate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch',
            targetAudience,
            reasonForOutreach,
            offering,
            tone: 'professional',
            leads: foundLeads
          })
        });

        const batchData = await batchRes.json();
        
        if (!batchRes.ok || batchData.error) {
          throw new Error(batchData.error || 'Batch generation failed');
        }

        const generatedEmails = batchData.emails || [];
        
        leadsWithEmails = foundLeads.map((lead: any, index: number) => {
          const gen = generatedEmails[index];
          if (!gen || !gen.draftEmail) {
            failedCount++;
            return {
              ...lead,
              subject: `Opportunity for ${lead.name}`,
              draftEmail: `Hi ${lead.name},\n\nI came across your profile and wanted to reach out regarding ${offering}.\n\nWould love to connect and discuss further.\n\nBest,\n[Your Name]`,
              status: 'draft' as const,
              generationFailed: true
            };
          }
          return {
            ...lead,
            subject: gen.subject || `Opportunity for ${lead.name}`,
            draftEmail: gen.draftEmail,
            status: 'draft' as const,
            generationFailed: false
          };
        });

      } catch (err: any) {
        console.error('Batch generation error:', err);
        failedCount = foundLeads.length;
        leadsWithEmails = foundLeads.map((lead: any) => ({
          ...lead,
          subject: `Opportunity for ${lead.name}`,
          draftEmail: `Hi ${lead.name},\n\nI came across your profile and wanted to reach out regarding ${offering}.\n\nWould love to connect and discuss further.\n\nBest,\n[Your Name]`,
          status: 'draft' as const,
          generationFailed: true
        }));
      }

      setLeads(leadsWithEmails);
      if (leadsWithEmails.length > 0) {
        setSelectedLeadIndex(0);
      }

      if (failedCount > 0) {
        console.log(`${failedCount} of ${leadsWithEmails.length} email drafts failed to generate (AI error). Fallback templates were used — you can manually edit or regenerate them.`);
      }

      // 3. Save campaign and leads to history
      try {
        const saveRes = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetAudience,
            reasonForOutreach,
            offering,
            leads: leadsWithEmails
          })
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok || saveData.error) {
          console.error('Failed to save campaign:', saveData.error);
        } else if (saveData.campaignId) {
          setCampaignId(saveData.campaignId);
        }
      } catch (saveErr) {
        console.error('Campaign save error:', saveErr);
      }

    } catch (err: any) {
      console.error(err.message || 'An error occurred during lead generation');
      return;
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
    }
  };

  const addManualLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLeadName || !manualLeadEmail) return;
    setManualGenerating(true);
    
    try {
      const genRes = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualLeadName,
          targetAudience: targetAudience || 'Custom Target',
          reasonForOutreach: reasonForOutreach || 'Direct Outreach',
          offering: offering || 'Collaboration Proposal'
        })
      });
      const genData = await genRes.json();
      
      let draftEmail: string;
      let subject: string;
      let generationFailed = false;
      if (!genRes.ok || genData.error) {
        draftEmail = `Hi ${manualLeadName},\n\nI wanted to reach out regarding our offering. Let's connect!\n\nBest,\n[Your Name]`;
        subject = `Opportunity for ${manualLeadName}`;
        generationFailed = true;
      } else {
        draftEmail = genData.draftEmail || '';
        subject = genData.subject || `Opportunity for ${manualLeadName}`;
      }

      const newLead: LeadData = {
        name: manualLeadName,
        email: manualLeadEmail,
        source: manualLeadSource,
        subject,
        draftEmail,
        status: 'draft',
        generationFailed,
      };

      setLeads(prev => {
        const updated = [...prev, newLead];
        setSelectedLeadIndex(updated.length - 1);
        return updated;
      });
      
      // Reset manual fields
      setManualLeadName('');
      setManualLeadEmail('');
      setIsManualModalOpen(false);

      if (generationFailed) {
        console.log('AI email generation failed — a fallback template was used. You can edit it manually or regenerate.');
      }
    } catch (err) {
      console.error('Failed to generate email template for manual lead', err);
      return;
    } finally {
      setManualGenerating(false);
    }
  };

  const regenerateEmail = async (index: number) => {
    if (index === null || index === undefined) return;
    
    // Set loading indicator using functional update
    setLeads(prev => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      updated[index] = { ...updated[index], regenerating: true };
      return updated;
    });

    try {
      const lead = leads[index];
      if (!lead) return;

      const genRes = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name,
          targetAudience: targetAudience || 'Professional',
          reasonForOutreach: reasonForOutreach || 'Introduction',
          offering: offering || 'Partnership'
        })
      });
      const genData = await genRes.json();
      
      if (!genRes.ok || genData.error) {
        console.error(`Failed to regenerate: ${genData.error || 'Unknown error'}`);
        setLeads(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], regenerating: false };
          return updated;
        });
        return;
      }

      // Functional update to avoid stale closure
      setLeads(prev => {
        const updated = [...prev];
        updated[index] = { 
          ...updated[index], 
          subject: genData.subject || updated[index].subject,
          draftEmail: genData.draftEmail, 
          regenerating: false,
          generationFailed: false
        };
        return updated;
      });
    } catch (err) {
      console.error('Failed to regenerate email', err);
      setLeads(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], regenerating: false };
        return updated;
      });
      return;
    }
  };

  const sendEmail = async (index: number) => {
    if (index === null || index === undefined) return;
    
    const lead = leads[index];
    if (!lead) return;

    // Set sending state
    setLeads(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], sending: true };
      return updated;
    });

    try {
      const sendRes = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lead.email,
          subject: lead.subject || `Connecting with ${lead.name}`,
          html: lead.draftEmail
        })
      });
      const sendData = await sendRes.json();
      if (sendData.error) throw new Error(typeof sendData.error === 'string' ? sendData.error : sendData.error.message || 'Failed to send');
      
      // Functional update to avoid stale closure
      setLeads(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'sent', sending: false };
        return updated;
      });
    } catch (err: any) {
      console.error('Error sending email:', err.message || err);
      setLeads(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], sending: false };
        return updated;
      });
      return;
    }
  };

  const sendAllEmails = async () => {
    const draftIndexes = leads
      .map((l, i) => l.status === 'draft' ? i : -1)
      .filter(i => i !== -1);

    if (draftIndexes.length === 0) {
      console.log('No draft emails left to send!');
      return;
    }

    console.log(`Sending emails to ${draftIndexes.length} leads...`);
    for (const idx of draftIndexes) {
      await sendEmail(idx);
    }
    console.log('Finished sending batch emails.');
  };

  const activeLead = selectedLeadIndex !== null ? leads[selectedLeadIndex] : null;

  // Safe initials helper
  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || '??';
  };

  return (
    <div className="flex h-screen bg-[#F5F6FA] text-slate-800 overflow-hidden font-sans">
      
      {/* Mobile Overlays */}
      {isLeftSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsLeftSidebarOpen(false)} />
      )}
      {isRightSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsRightSidebarOpen(false)} />
      )}

      {/* LEFT SIDEBAR (Dark Theme - Lead Management) */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-80 bg-zinc-950 text-white flex flex-col h-full border-r border-zinc-800 transform transition-transform duration-300 lg:transform-none ${isLeftSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand Logo & Nav */}
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

        {/* Action Button & Stats Cards */}
        <div className="p-4 space-y-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-[#D4F700] hover:bg-[#b8d600] text-black font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#d4f700]/10 text-sm"
          >
            <Plus size={16} /> New Campaign
          </button>

          {/* Mini Stats Card Grid */}
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

        {/* Scrollable Lead List Header */}
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

        {/* Lead List Scroll Area */}
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
                  {/* Left Avatar Initials */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSelected ? 'bg-black text-[#D4F700]' : 'bg-zinc-800 text-zinc-200'
                  }`}>
                    {getInitials(lead.name)}
                  </div>

                  {/* Name and Snippet */}
                  <div className="flex-1 min-w-0 pr-6">
                    <h4 className={`text-xs font-bold truncate leading-tight ${
                      isSelected ? 'text-black' : 'text-white font-semibold'
                    }`}>{lead.name}</h4>
                    <p className={`text-[10px] truncate mt-0.5 ${
                      isSelected ? 'text-zinc-800' : 'text-zinc-400'
                    }`}>{lead.email}</p>
                    
                    {/* Status badges */}
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

                  {/* Right Arrow */}
                  <ChevronRight size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${
                    isSelected ? 'text-black translate-x-0.5' : 'text-zinc-600 group-hover:text-zinc-400'
                  }`} />
                </div>
              );
            })
          )}
        </div>

        {/* User Profile Footer */}
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

      {/* CENTER PANEL (Email Editor Area) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsLeftSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <span>Workspace</span>
              <ChevronRight size={12} />
              <span className="text-slate-800 font-semibold">AI Lead Outreach</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-600">Gemini Flash</span>
            </div>
            <button 
              className="lg:hidden p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsRightSidebarOpen(true)}
            >
              <Layers size={20} />
            </button>
          </div>
        </header>

        {/* Email Editor / Details Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {activeLead && selectedLeadIndex !== null ? (
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Generation Failed Warning */}
              {activeLead.generationFailed && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-semibold text-orange-800">AI generation failed for this lead</p>
                    <p className="text-[11px] text-orange-600 mt-0.5">A fallback template was used. Edit manually or click Regenerate to try again.</p>
                  </div>
                </div>
              )}

              {/* Recipient Profile Info */}
              {/* Recipient Profile Info */}
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
                    
                    {/* Metadata Row: Email + Copy */}
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
                  {/* Proper Secured Toggle Switch */}
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

              {/* Subject & Draft Editor Box */}
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

                {/* Email Body Area */}
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

                {/* Action Bar */}
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

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-20 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-200/50 flex items-center justify-center">
                <FileText size={32} className="text-slate-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">No Lead Selected</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">Select a lead from the sidebar list to view, edit, and send outreach emails.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* RIGHT PANEL (Campaign Summary & Actions) */}
      <aside className={`fixed lg:relative inset-y-0 right-0 z-50 w-80 bg-white border-l border-slate-200 p-6 flex flex-col h-full overflow-y-auto shrink-0 transform transition-transform duration-300 lg:transform-none ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <h3 className="text-sm font-bold tracking-tight text-slate-900 mb-4 flex items-center gap-2">
          <Layers size={16} className="text-[#D4F700]" /> Campaign Summary
        </h3>

        {targetAudience ? (
          <div className="space-y-5 flex-1">
            {/* Quick Summary Card */}
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

            {/* Campaign Stats Card */}
            <div className="bg-[#D4F700]/10 rounded-2xl p-5 border border-[#D4F700]/30 space-y-4">
              <div className="flex items-center gap-2 text-black font-semibold text-xs">
                <TrendingUp size={16} /> Progress Details
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">Secured Leads</span>
                  <span className="text-slate-900">{securedLeads} / {totalLeads}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${totalLeads > 0 ? (securedLeads / totalLeads) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Bulk Send CTA */}
            <button 
              disabled={true}
              className="w-full bg-slate-200 border border-slate-200 text-slate-400 font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-not-allowed"
            >
              <Send size={16} /> Send All Drafts (Available Soon)
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-slate-400">
            <LayoutDashboard size={24} className="mb-2" />
            <p className="text-xs">No active campaign</p>
          </div>
        )}
      </aside>

      {/* NEW CAMPAIGN MODAL (Overlay) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Configure Outreach Campaign</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSearchAndGenerate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Who are you looking for?</label>
                <input
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/25 focus:border-red-500 outline-none text-sm bg-slate-50/50"
                  placeholder="e.g., Software Engineers in Tokyo"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Why are you reaching out?</label>
                <textarea
                  required
                  rows={3}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/25 focus:border-red-500 outline-none text-sm bg-slate-50/50"
                  placeholder="e.g., Discuss remote jobs and collaboration opportunities..."
                  value={reasonForOutreach}
                  onChange={(e) => setReasonForOutreach(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">What is your offering?</label>
                <textarea
                  required
                  rows={3}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/25 focus:border-red-500 outline-none text-sm bg-slate-50/50"
                  placeholder="e.g., Remote roles, flexible schedules, up to $120k/year..."
                  value={offering}
                  onChange={(e) => setOffering(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-red-500/10 transition disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="animate-spin" size={14} /> : <Search size={14} />}
                  {loading ? 'Searching...' : 'Start Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MANUAL LEAD MODAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Add Lead Manually</h3>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={addManualLeadSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/25 focus:border-red-500 outline-none text-sm bg-slate-50/50"
                  placeholder="e.g., John Doe"
                  value={manualLeadName}
                  onChange={(e) => setManualLeadName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  required
                  type="email"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/25 focus:border-red-500 outline-none text-sm bg-slate-50/50"
                  placeholder="e.g., john@example.com"
                  value={manualLeadEmail}
                  onChange={(e) => setManualLeadEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Source / Platform</label>
                <select
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/25 focus:border-red-500 outline-none text-sm bg-slate-50/50"
                  value={manualLeadSource}
                  onChange={(e) => setManualLeadSource(e.target.value)}
                >
                  <option value="Manual">Manual</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Reddit">Reddit</option>
                  <option value="Twitter">Twitter</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualGenerating}
                  className="bg-[#D4F700] hover:bg-[#b8d600] text-black font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {manualGenerating ? (
                    <>
                      <RefreshCw className="animate-spin" size={14} /> Generating...
                    </>
                  ) : (
                    <>
                      <PlusCircle size={14} /> Add & Draft
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
