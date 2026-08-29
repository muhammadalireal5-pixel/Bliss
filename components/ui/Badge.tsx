import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'muted' | 'outline';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-black/10 text-black',
    success: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20',
    warning: 'bg-orange-950/40 text-orange-400 border border-orange-900/20',
    error: 'bg-red-100 text-red-800 border border-red-200',
    muted: 'bg-zinc-800/80 text-zinc-400',
    outline: 'bg-slate-100 text-slate-700 border border-slate-200' // Useful for light themes
  };

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide inline-flex items-center gap-1 ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
