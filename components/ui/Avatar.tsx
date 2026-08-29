import React from 'react';
import { getInitials } from '@/lib/utils';

interface AvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark' | 'brand';
  className?: string;
}

export function Avatar({ name, size = 'md', theme = 'light', className = '' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs rounded-lg',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-14 h-14 text-xl rounded-2xl'
  };

  const themeClasses = {
    light: 'bg-slate-200 text-slate-700 border border-slate-300/50',
    dark: 'bg-zinc-800 text-zinc-200 border border-zinc-700',
    brand: 'bg-primary/20 text-black border border-primary/50'
  };

  return (
    <div className={`flex items-center justify-center font-bold shrink-0 ${sizeClasses[size]} ${themeClasses[theme]} ${className}`}>
      {getInitials(name || '?')}
    </div>
  );
}
