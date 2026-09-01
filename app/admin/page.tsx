'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Users, Activity, ShieldAlert,  ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  createdAt: string | Date;
  leadsUsedThisMonth: number;
  tier: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalLeadsThisMonth: 0 });
  const [error, setError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/admin/users')
        .then(res => {
          if (!res.ok) throw new Error('Unauthorized');
          return res.json();
        })
        .then(data => {
          setUsers(data.users || []);
          setStats(data.stats || { totalUsers: 0, totalLeadsThisMonth: 0 });
          setLoading(false);
        })
        .catch(err => {
          setError('You do not have access to this page.');
          setLoading(false);
        });
    }
  }, [status, router]);

  const changeTier = async (userId: string, newTier: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: newTier })
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(prevUsers => prevUsers.map(u => u._id === userId ? { ...u, tier: data.user.tier } : u));
      } else {
        alert('Failed to update tier');
      }
    } catch (err) {
      alert('Failed to update tier');
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Activity className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50">
        <ShieldAlert className="text-red-500 mb-4" size={48} />
        <h1 className="text-xl font-bold text-slate-800">Access Denied</h1>
        <p className="text-slate-500 mt-2">{error}</p>
        <Link href="/" className="mt-6 text-primary hover:underline flex items-center gap-2">
          <ChevronLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Users size={24} className="text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">Manage users and subscription tiers.</p>
          </div>
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50">
            <ChevronLeft size={16} /> Back to App
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Total Users</p>
              <h2 className="text-3xl font-bold text-slate-800 mt-1">{stats.totalUsers}</h2>
            </div>
            <Users size={32} className="text-slate-300" />
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Leads Generated (This Month)</p>
              <h2 className="text-3xl font-bold text-slate-800 mt-1">{stats.totalLeadsThisMonth}</h2>
            </div>
            <Activity size={32} className="text-slate-300" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4">Usage (Month)</th>
                <th className="px-6 py-4">Tier</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">{user.leadsUsedThisMonth || 0}</span>
                      <span className="text-xs text-slate-400">leads</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide
                      ${user.tier === 'Pro' ? 'bg-purple-100 text-purple-700' : 
                        user.tier === 'Basic' ? 'bg-blue-100 text-blue-700' : 
                        'bg-slate-100 text-slate-600'}`}>
                      {user.tier || 'Free'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <select 
                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        value={user.tier || 'Free'}
                        onChange={(e) => changeTier(user._id, e.target.value)}
                        disabled={updatingUserId === user._id}
                      >
                        <option value="Free">Free (5/mo)</option>
                        <option value="Basic">Basic (150/mo)</option>
                        <option value="Pro">Pro (500/mo)</option>
                      </select>
                      {updatingUserId === user._id && (
                        <Activity size={16} className="text-primary animate-spin" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-12 text-center text-slate-500 text-sm">
              No users found.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
