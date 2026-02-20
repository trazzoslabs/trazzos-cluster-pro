'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  variant?: 'error' | 'warn' | 'success';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, variant = 'error', onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const variantStyles = {
    error: 'bg-red-900/90 border-red-700 text-red-100',
    warn: 'bg-yellow-900/90 border-yellow-700 text-yellow-100',
    success: 'bg-green-900/90 border-green-700 text-green-100',
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <div
        className={`px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm ${variantStyles[variant]} min-w-[300px] max-w-md`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="text-current opacity-70 hover:opacity-100 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}


