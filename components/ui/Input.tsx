import React, { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="label">{label}</label>}
        <input
          ref={ref}
          className={`input-field ${error ? 'border-red-500 focus:ring-red-500/30' : ''} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-[11px] text-red-500 font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';


export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col flex-1">
        {label && <label className="label">{label}</label>}
        <textarea
          ref={ref}
          className={`input-field flex-1 ${error ? 'border-red-500 focus:ring-red-500/30' : ''} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-[11px] text-red-500 font-medium">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
