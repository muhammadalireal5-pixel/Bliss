'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  RefreshCw, 
  PlusCircle, 
  Layers, 
  AlertCircle,
  Menu,
  FileText,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { LeadData } from '@/types';
import LeadProfileCard from '@/components/dashboard/LeadProfileCard';
import EmailEditor from '@/components/dashboard/EmailEditor';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import RightSidebar from '@/components/dashboard/RightSidebar';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import CsvImportModal from '@/components/dashboard/CsvImportModal';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MobileTabBar, TabId } from '@/components/ui/MobileTabBar';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { success, error, warning } = useToast();

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
  const [oauthAccount, setOauthAccount] = useState<any>(null);

  useEffect(() => {
    fetch('/api/oauth/status')
      .then(res => res.json())
      .then(data => {
        if (data.account) setOauthAccount(data.account);
      })
      .catch(() => {});
  }, []);
  // App state
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [selectedLeadIndex, setSelectedLeadIndex] = useState<number | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [usage, setUsage] = useState<{ used: number; limit: number; tier: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/user/usage')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setUsage(data);
      })
      .catch(console.error);
  }, [leads.length]); // Refresh usage when leads change

  // Manual lead inputs
  const [manualLeadName, setManualLeadName] = useState('');
  const [manualLeadEmail, setManualLeadEmail] = useState('');
  const [manualLeadSource, setManualLeadSource] = useState('Manual');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualGenerating, setManualGenerating] = useState(false);

  // Follow-up configs
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpDelayDays, setFollowUpDelayDays] = useState(3);
  const [maxFollowUps, setMaxFollowUps] = useState(2);

  // Responsive UI state
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<TabId>('leads');
  
  const [loadingMessage, setLoadingMessage] = useState('Initializing search...');

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <RefreshCw className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Statistics
  const totalLeads = leads.length;
  const securedLeads = leads.filter(l => l.secured).length;

  const handleSearchAndGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    setLoading(true);

    const messages = [
      "Searching Google & LinkedIn...",
      "Analyzing profiles with SayMe AI Engine...",
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
        warning('No profiles with public emails found. Try a different audience or search term.');
        setLoading(false);
        return;
      }

      success(`Found ${foundLeads.length} leads. Generating drafts...`);

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
        setActiveMobileTab('compose'); // switch to compose tab on mobile
      }

      if (failedCount > 0) {
        warning(`${failedCount} email drafts used fallback templates due to AI timeout.`);
      } else {
        success('All email drafts generated successfully.');
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
            leads: leadsWithEmails,
            followUpEnabled,
            followUpDelayDays,
            maxFollowUps
          })
        });
        const saveData = await saveRes.json();
        if (saveRes.ok && saveData.campaignId) {
          setCampaignId(saveData.campaignId);
        }
      } catch (saveErr) {
        console.error('Campaign save error:', saveErr);
      }

    } catch (err: any) {
      console.error(err);
      error('An error occurred during lead generation');
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

      try {
        const saveRes = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            targetAudience,
            reasonForOutreach,
            offering,
            lead: newLead
          })
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok || saveData.error) {
          console.error(saveData.error);
          error('Failed to save lead to database');
          return;
        } else if (saveData.lead) {
          newLead._id = saveData.lead._id;
          if (saveData.campaignId && !campaignId) {
            setCampaignId(saveData.campaignId);
          }
        }
      } catch (e) {
        console.error('Failed to save manual lead:', e);
        error('Failed to save lead to database');
        return;
      }

      setLeads(prev => {
        const updated = [...prev, newLead];
        setSelectedLeadIndex(updated.length - 1);
        return updated;
      });
      
      setManualLeadName('');
      setManualLeadEmail('');
      setIsManualModalOpen(false);
      setActiveMobileTab('compose');

      if (generationFailed) {
        warning('AI email generation failed. Fallback template applied.');
      } else {
        success('Lead added and drafted successfully.');
      }
    } catch (err) {
      error('Failed to generate email template for manual lead');
    } finally {
      setManualGenerating(false);
    }
  };

  const regenerateEmail = async (index: number) => {
    if (index === null || index === undefined) return;
    
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
        console.error(genData.error);
        error('Failed to regenerate email');
        setLeads(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], regenerating: false };
          return updated;
        });
        return;
      }

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
      
      success('Email regenerated successfully.');
    } catch (err) {
      error('Failed to regenerate email');
      setLeads(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], regenerating: false };
        return updated;
      });
    }
  };


  const activeLead = selectedLeadIndex !== null ? leads[selectedLeadIndex] : null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      
      {/* LEFT SIDEBAR (Lead Management) */}
      <LeftSidebar
        isLeftSidebarOpen={isLeftSidebarOpen}
        setIsLeftSidebarOpen={setIsLeftSidebarOpen}
        setIsModalOpen={setIsModalOpen}
        setIsManualModalOpen={setIsManualModalOpen}
        setIsCsvModalOpen={setIsCsvModalOpen}
        totalLeads={totalLeads}
        securedLeads={securedLeads}
        loading={loading}
        loadingMessage={loadingMessage}
        leads={leads}
        selectedLeadIndex={selectedLeadIndex}
        setSelectedLeadIndex={(idx) => {
          setSelectedLeadIndex(idx);
          if (window.innerWidth < 768) {
            setActiveMobileTab('compose');
            setIsLeftSidebarOpen(false);
          }
        }}
        session={session}
        activeMobileTab={activeMobileTab}
      />

      {/* CENTER PANEL (Email Editor Area) */}
      <main className={`flex-1 flex-col h-full overflow-hidden w-full relative ${activeMobileTab !== 'compose' ? 'hidden md:flex' : 'flex'}`}>
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors"
              onClick={() => setIsLeftSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
              <span className="hidden sm:inline">Workspace</span>
              <ChevronRight size={12} className="hidden sm:inline" />
              <span className="text-slate-800">AI Lead Outreach</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {oauthAccount ? (
              <div className="hidden sm:flex items-center gap-2 border-r border-slate-200 pr-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Sending via {oauthAccount.provider === 'gmail' ? 'Gmail' : 'Outlook'}
                </span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 border-r border-slate-200 pr-3">
                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Sending via Resend
                </span>
              </div>
            )}
            {usage && (
              <div className="hidden sm:flex items-center gap-2 border-r border-slate-200 pr-3">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${usage.used >= usage.limit ? 'text-red-500' : 'text-slate-500'}`}>
                  {usage.used}/{usage.limit} Leads Used
                </span>
              </div>
            )}
            {usage?.isAdmin && (
              <div className="hidden sm:flex items-center gap-2 border-r border-slate-200 pr-3">
                <Link href="/admin" className="text-[11px] font-bold text-blue-500 uppercase tracking-wide hover:underline">
                  Admin
                </Link>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Gemini AI Active</span>
            </div>
            <button 
              className="xl:hidden p-2 -mr-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors"
              onClick={() => setIsRightSidebarOpen(true)}
              aria-label="Open campaign summary"
            >
              <Layers size={20} />
            </button>
          </div>
        </header>

        {/* Email Editor / Details Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 pb-24 md:pb-8">
          {activeLead && selectedLeadIndex !== null ? (
            <div className="max-w-3xl mx-auto space-y-6">
              
              {activeLead.generationFailed && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-bold text-orange-800">AI generation failed for this lead</p>
                    <p className="text-[11px] font-medium text-orange-600 mt-1">A fallback template was used. Edit manually or click Regenerate to try again.</p>
                  </div>
                </div>
              )}

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
            <EmptyState 
              icon={<FileText size={32} />}
              title="No Lead Selected"
              description="Select a lead from the sidebar list to view, edit, and send outreach emails."
            />
          )}
        </div>
      </main>

      {/* RIGHT PANEL (Campaign Summary) */}
      <RightSidebar 
        isRightSidebarOpen={isRightSidebarOpen} 
        setIsRightSidebarOpen={setIsRightSidebarOpen}
        targetAudience={targetAudience} 
        reasonForOutreach={reasonForOutreach} 
        offering={offering} 
        totalLeads={leads.length} 
        securedLeads={leads.filter(l => l.secured).length} 
        leads={leads}
        campaignId={campaignId}
        activeMobileTab={activeMobileTab}
      />

      <MobileTabBar activeTab={activeMobileTab} onTabChange={setActiveMobileTab} />

      {/* NEW CAMPAIGN MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Configure Outreach Campaign" maxWidth="lg">
        <form onSubmit={handleSearchAndGenerate} className="p-6 space-y-4">
          <Input
            label="Who are you looking for?"
            required
            placeholder="e.g., Software Engineers in Tokyo"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
          />
          <Textarea
            label="Why are you reaching out?"
            required
            rows={3}
            placeholder="e.g., Discuss remote jobs and collaboration opportunities..."
            value={reasonForOutreach}
            onChange={(e) => setReasonForOutreach(e.target.value)}
          />
          <Textarea
            label="What is your offering?"
            required
            rows={3}
            placeholder="e.g., Remote roles, flexible schedules, up to $120k/year..."
            value={offering}
            onChange={(e) => setOffering(e.target.value)}
          />

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input 
                type="checkbox" 
                checked={followUpEnabled}
                onChange={(e) => setFollowUpEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-semibold text-slate-700">Enable automatic follow-ups</span>
            </label>
            
            {followUpEnabled && (
              <div className="flex gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Days between</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={14} 
                    className="w-full text-sm bg-white border border-slate-200 rounded-lg p-2"
                    value={followUpDelayDays}
                    onChange={(e) => setFollowUpDelayDays(parseInt(e.target.value))}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Max follow-ups</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={3} 
                    className="w-full text-sm bg-white border border-slate-200 rounded-lg p-2"
                    value={maxFollowUps}
                    onChange={(e) => setMaxFollowUps(parseInt(e.target.value))}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Note: Requires a connected Microsoft inbox for automatic reply detection. Shared sender users will not get auto-follow-ups.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={loading} icon={<Search size={14} />}>
              Start Campaign
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADD MANUAL LEAD MODAL */}
      <Modal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} title="Add Lead Manually" maxWidth="md">
        <form onSubmit={addManualLeadSubmit} className="p-6 space-y-4">
          <Input
            label="Full Name"
            required
            placeholder="e.g., John Doe"
            value={manualLeadName}
            onChange={(e) => setManualLeadName(e.target.value)}
          />
          <Input
            label="Email Address"
            type="email"
            required
            placeholder="e.g., john@example.com"
            value={manualLeadEmail}
            onChange={(e) => setManualLeadEmail(e.target.value)}
          />
          <div className="w-full">
            <label className="label">Source / Platform</label>
            <select
              className="input-field"
              value={manualLeadSource}
              onChange={(e) => setManualLeadSource(e.target.value)}
            >
              <option value="Manual">Manual</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Reddit">Reddit</option>
              <option value="Twitter">Twitter</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsManualModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={manualGenerating} icon={<PlusCircle size={14} />}>
              Add & Draft
            </Button>
          </div>
        </form>
      </Modal>

      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImport={async (importedLeads) => {
          if (!campaignId) {
            error("Start a campaign first to import leads.");
            return;
          }
          // Set new leads to state
          const newLeads = importedLeads.map(l => ({ ...l, status: 'draft', draftEmail: '', regenerating: true }));
          setLeads(prev => [...newLeads, ...prev]);

          // Start generation for them
          try {
            const batchRes = await fetch('/api/generate-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leads: newLeads,
                reasonForOutreach,
                offering,
                campaignId
              })
            });
            const data = await batchRes.json();
            if (batchRes.ok) {
              setLeads(prev => {
                const updated = [...prev];
                data.results.forEach((resItem: any) => {
                   const leadIndex = updated.findIndex(l => l.email === resItem.email);
                   if (leadIndex !== -1) {
                     updated[leadIndex] = {
                       ...updated[leadIndex],
                       draftEmail: resItem.emailDraft,
                       subject: resItem.subject || `Opportunity for ${updated[leadIndex].name}`,
                       regenerating: false,
                       generationFailed: !resItem.success,
                       _id: resItem._id
                     };
                   }
                });
                return updated;
              });
              success(`Imported and generated emails for ${newLeads.length} leads!`);
            }
          } catch(e) {
            error("Failed to generate emails for imported leads.");
            setLeads(prev => prev.map(l => newLeads.find(nl => nl.email === l.email) ? {...l, regenerating: false, generationFailed: true} : l));
          }
        }}
      />
    </div>
  );
}
