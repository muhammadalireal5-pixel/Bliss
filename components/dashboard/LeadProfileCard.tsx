import React from 'react';
import { ArrowUpRight, Copy } from 'lucide-react';
import { LeadData } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';

interface LeadProfileCardProps {
  activeLead: LeadData;
  selectedLeadIndex: number | null;
  setLeads: React.Dispatch<React.SetStateAction<LeadData[]>>;
}

export default function LeadProfileCard({ activeLead, selectedLeadIndex, setLeads }: LeadProfileCardProps) {
  const { success } = useToast();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(activeLead.email);
    success('Email copied to clipboard');
  };

  return (
    <div className="card p-6 flex flex-col xl:flex-row xl:items-start justify-between gap-6 transition-colors hover:border-slate-300">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <Avatar name={activeLead.name} size="lg" theme="brand" className="mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 truncate">{activeLead.name}</h2>
            <Badge variant="outline">{activeLead.source || 'Web'}</Badge>
            {activeLead.profileUrl && (
              <a 
                href={activeLead.profileUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-primary-hover transition-colors"
                aria-label="View profile"
              >
                Profile <ArrowUpRight size={12} strokeWidth={2.5} />
              </a>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 pl-3 pr-1.5 py-1.5 rounded-lg border border-slate-200">
              <span className="text-xs font-mono text-slate-700 font-medium truncate max-w-[200px] sm:max-w-xs">{activeLead.email}</span>
              <button 
                onClick={handleCopyEmail}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Copy Email Address"
                aria-label="Copy email address"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>

          {activeLead.summary && (
            <p className="text-[11px] text-slate-600 mt-4 max-w-lg leading-relaxed border-l-[3px] border-primary pl-3 py-0.5 italic">
              {activeLead.summary}
            </p>
          )}
        </div>
      </div>

      <div className="flex xl:flex-col items-center xl:items-end justify-between xl:justify-start gap-4 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 xl:pl-4 xl:border-l">
        <Toggle 
          checked={!!activeLead.secured}
          onChange={(checked) => {
            const idx = selectedLeadIndex;
            if (idx === null) return;
            setLeads(prev => {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], secured: checked };
              return updated;
            });
          }}
          label="SECURED"
        />
      </div>
    </div>
  );
}
