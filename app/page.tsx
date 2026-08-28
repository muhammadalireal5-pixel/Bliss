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
import LeadProfileCard from '@/components/dashboard/LeadProfileCard';
import EmailEditor from '@/components/dashboard/EmailEditor';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import RightSidebar from '@/components/dashboard/RightSidebar';
import { getInitials } from '@/lib/utils';

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
      <LeftSidebar
        isLeftSidebarOpen={isLeftSidebarOpen}
        setIsLeftSidebarOpen={setIsLeftSidebarOpen}
        setIsModalOpen={setIsModalOpen}
        totalLeads={totalLeads}
        securedLeads={securedLeads}
        loading={loading}
        loadingMessage={loadingMessage}
        leads={leads}
        selectedLeadIndex={selectedLeadIndex}
        setSelectedLeadIndex={setSelectedLeadIndex}
        setIsManualModalOpen={setIsManualModalOpen}
        session={session}
      />

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
              <LeadProfileCard 
                activeLead={activeLead} 
                selectedLeadIndex={selectedLeadIndex} 
                setLeads={setLeads} 
              />
              <EmailEditor 
                activeLead={activeLead} 
                selectedLeadIndex={selectedLeadIndex} 
                setLeads={setLeads} 
                regenerateEmail={regenerateEmail} 
              />

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
      <RightSidebar 
        isRightSidebarOpen={isRightSidebarOpen} 
        targetAudience={targetAudience} 
        reasonForOutreach={reasonForOutreach} 
        offering={offering} 
        totalLeads={totalLeads} 
        securedLeads={securedLeads} 
      />

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
