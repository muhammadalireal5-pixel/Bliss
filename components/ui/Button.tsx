import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { RefreshCw } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'disabled';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading = false, icon, children, disabled, ...props }, ref) => {
    
    // Convert generic sizes to padding classes
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2.5 text-xs',
      lg: 'px-5 py-3 text-sm'
    };

    // Determine visual variant
    let variantClass = `btn-${variant}`;
    
    // If actually disabled or loading, and it's not the explicit "disabled" variant, add some opacity
    if ((disabled || loading) && variant !== 'disabled') {
       variantClass += ' opacity-50 cursor-not-allowed';
    }

    if (variant === 'disabled') {
       variantClass = 'bg-slate-200 text-slate-400 cursor-not-allowed border-transparent shadow-none hover:bg-slate-200';
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading || variant === 'disabled'}
        className={`btn ${variantClass} ${sizeClasses[size]} ${className} min-h-[40px]`}
        {...props}
      >
        {loading ? <RefreshCw className="animate-spin" size={16} /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
