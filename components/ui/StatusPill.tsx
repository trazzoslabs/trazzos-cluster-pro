'use client';

interface StatusPillProps {
  label: string;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'demo';
  size?: 'sm' | 'md';
}

export default function StatusPill({ label, variant = 'info', size = 'sm' }: StatusPillProps) {
  const variantStyles = {
    success: 'bg-[#9aff8d]/20 text-[#9aff8d] border-[#9aff8d]/30',
    error: 'bg-red-900/20 text-red-300 border-red-800/30',
    warning: 'bg-yellow-900/20 text-yellow-300 border-yellow-800/30',
    info: 'bg-zinc-800/50 text-zinc-300 border-zinc-700/30',
    demo: 'bg-purple-900/20 text-purple-300 border-purple-800/30',
  };
  
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };
  
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {label}
    </span>
  );
}

