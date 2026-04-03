import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div 
        onClick={onClick}
        className={cn(
            "bg-white border-none shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[32px] overflow-hidden transition-all duration-300",
            onClick && "cursor-pointer hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:translate-y-[-2px]",
            className
        )}
    >
      {children}
    </div>
  );
}

export function Button({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
    const variants = {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20",
        secondary: "bg-white text-gray-700 border border-gray-100 hover:bg-gray-50 shadow-sm",
        ghost: "bg-transparent hover:bg-black/5 text-gray-500 hover:text-gray-900",
    };
    
    return (
        <button 
            className={cn(
                "inline-flex items-center justify-center rounded-[14px] px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50",
                variants[variant],
                className
            )}
            {...props}
        />
    );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-[14px] border border-gray-100 bg-white px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      {...props}
    />
  );
}
