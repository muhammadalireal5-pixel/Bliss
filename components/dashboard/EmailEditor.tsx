import React, { useState } from 'react';
import { RefreshCw, Send, Copy } from 'lucide-react';
import { LeadData } from '@/types';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SkeletonEmail } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface EmailEditorProps {
  activeLead: LeadData;
  selectedLeadIndex: number | null;
  setLeads: React.Dispatch<React.SetStateAction<LeadData[]>>;
  regenerateEmail: (index: number) => void;
}

export default function EmailEditor({ activeLead, selectedLeadIndex, setLeads, regenerateEmail }: EmailEditorProps) {
  const { success, error } = useToast();
  const [sending, setSending] = useState(false);

  const isSourceOnly = activeLead.contactMethod === 'source-only' || !activeLead.email;

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(activeLead.draftEmail);
    success(isSourceOnly ? 'Inquiry message copied to clipboard!' : 'Draft copied to clipboard!');
  };

  const handleSend = async () => {
    if (isSourceOnly || !activeLead.email) {
      error('Cannot send email: This lead has no email address. Please copy the message and send via their contact page.');
      return;
    }
    if (!activeLead._id) {
      error('Cannot send: Lead must be saved first');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeLead.email,
          subject: activeLead.subject,
          html: activeLead.draftEmail,
          leadId: activeLead._id
        })
      });
      const data = await res.json();
      if (res.ok) {
        success('Email sent successfully!');
        const idx = selectedLeadIndex;
        if (idx !== null) {
          setLeads(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], status: 'sent' };
            return updated;
          });
        }
      } else {
        console.error(data.error);
        error('Failed to send email');
      }
    } catch (e: any) {
      console.error(e);
      error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card overflow-hidden flex flex-col" style={{ minHeight: 'calc(100vh - 380px)' }}>
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
        <div className="flex items-center gap-4">
          <label className="label w-16 text-right mb-0">To</label>
          <div className="flex items-center flex-1">
            {isSourceOnly ? (
              <span className="text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg font-medium truncate">
                No Email — Website Contact Form Outreach
              </span>
            ) : (
              <span className="text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700 font-medium truncate">
                {activeLead.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="label w-16 text-right mb-0">Subject</label>
          <div className="flex-1">
            <Input 
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
              placeholder={isSourceOnly ? "Inquiry headline (optional for contact form)" : "Email Subject"}
            />
          </div>
        </div>
      </div>

      <div className="p-6 relative flex-1 flex flex-col">
        {activeLead.regenerating && <SkeletonEmail />}

        <Textarea
          className="flex-1 min-h-[200px] resize-none font-mono leading-relaxed bg-slate-50/30"
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

      <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex justify-between items-center gap-3 shrink-0">
        <Button 
          variant="secondary"
          size="sm"
          onClick={() => {
            if (selectedLeadIndex !== null) regenerateEmail(selectedLeadIndex);
          }}
          disabled={activeLead.status === 'sent'}
          loading={activeLead.regenerating}
          icon={<RefreshCw size={14} />}
          aria-label="Regenerate email draft"
        >
          Regenerate
        </Button>

        <div className="flex gap-2 items-center">
          <Button 
            variant={isSourceOnly ? "primary" : "secondary"}
            size="sm"
            onClick={handleCopyDraft}
            icon={<Copy size={14} />}
            aria-label="Copy email draft"
          >
            {isSourceOnly ? "Copy Message for Contact Form" : "Copy Draft"}
          </Button>
          {!isSourceOnly && (
            <Button 
              variant="primary"
              size="sm"
              icon={<Send size={14} />}
              loading={sending}
              onClick={handleSend}
              disabled={activeLead.status === 'sent'}
            >
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
