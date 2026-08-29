import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  dark?: boolean;
}

export function EmptyState({ icon, title, description, action, className = '', dark = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 h-full ${className}`}>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${dark ? 'bg-zinc-900/50 text-zinc-500' : 'bg-slate-100 text-slate-400'}`}>
        {icon}
      </div>
      <h3 className={`font-bold text-sm mb-1 ${dark ? 'text-zinc-200' : 'text-slate-900'}`}>{title}</h3>
      <p className={`text-xs max-w-xs mb-6 leading-relaxed ${dark ? 'text-zinc-500' : 'text-slate-500'}`}>
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
