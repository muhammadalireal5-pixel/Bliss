'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/oauth/status')
      .then(res => res.json())
      .then(data => {
        if (data.account) setAccount(data.account);
        setLoading(false);
      });
  }, []);

  const handleDisconnect = async () => {
    setLoading(true);
    await fetch('/api/oauth/disconnect', { method: 'POST' });
    setAccount(null);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <Link href="/" className="inline-flex items-center text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
        </Link>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-zinc-400 mt-2">Manage your connected email sender accounts.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Mail size={20} className="text-primary" />
                Email Sender Account
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Connect your own inbox to send outreach emails directly from you, improving deliverability.
              </p>
            </div>
            {account && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={14} /> Connected
              </span>
            )}
          </div>

          {loading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-zinc-800 rounded"></div>
                  <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          ) : account ? (
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex items-center justify-between">
              <div>
                <p className="font-medium text-white">{account.email}</p>
                <p className="text-xs text-zinc-500 mt-0.5 capitalize">Provider: {account.provider}</p>
              </div>
              <Button variant="secondary" onClick={handleDisconnect}>Disconnect</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a href="/api/oauth/google" className="flex items-center justify-center gap-2 bg-white text-black font-semibold px-4 py-3 rounded-lg hover:bg-zinc-200 transition-colors">
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                  Connect Gmail
                </a>
                <a href="/api/oauth/microsoft" className="flex items-center justify-center gap-2 bg-[#00a4ef] text-white font-semibold px-4 py-3 rounded-lg hover:bg-[#0093d6] transition-colors">
                  <svg className="w-5 h-5" viewBox="0 0 23 23"><path fill="#f3f3f3" d="M0 0h11v11H0z"/><path fill="#f3f3f3" d="M12 0h11v11H12z"/><path fill="#f3f3f3" d="M0 12h11v11H0z"/><path fill="#f3f3f3" d="M12 12h11v11H12z"/></svg>
                  Connect Outlook
                </a>
              </div>
              
              <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4 flex gap-3 text-sm text-blue-200">
                <ShieldCheck className="shrink-0 text-blue-400" size={20} />
                <p>We request only the permissions needed to send emails on your behalf. Your credentials are encrypted at rest using AES-256-GCM.</p>
              </div>
            </div>
          )}

          {!account && (
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-sm text-zinc-400">
              <p><strong>Note:</strong> If you don't connect an account, emails will be sent via our shared Resend infrastructure (SayMe Outreach). You won't be able to receive automatic reply tracking on the shared sender.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
