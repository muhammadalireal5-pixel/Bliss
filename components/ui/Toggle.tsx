import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, className = '' }: ToggleProps) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer group min-h-[40px] ${className}`}>
      {label && (
        <span className={`text-xs font-bold tracking-wide transition-colors ${checked ? 'text-emerald-600' : 'text-slate-500 group-hover:text-slate-700'}`}>
          {label}
        </span>
      )}
      <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out border outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
        checked 
          ? 'bg-emerald-500 border-emerald-600' 
          : 'bg-slate-200 border-slate-300 group-hover:bg-slate-300'
      }`}>
        <div className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform duration-300 ease-in-out shadow-sm flex items-center justify-center ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}>
          {checked && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-600" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          )}
        </div>
        <input 
          type="checkbox" 
          role="switch"
          aria-checked={checked}
          aria-label={label || 'Toggle switch'}
          className="sr-only" 
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    </label>
  );
}
