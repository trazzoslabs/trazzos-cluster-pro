'use client';

import { useState, useEffect } from 'react';

const ACADEMY_LINK = 'https://v0-trazzos-academy.vercel.app/';

export default function AcademyFloatingButton() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // Animación pulse cada 15 segundos (entre 12-18)
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseAnimation(true);
      setTimeout(() => setPulseAnimation(false), 2000);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    window.open(ACADEMY_LINK, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      className={`group relative fixed top-4 right-6 z-40 flex items-center gap-2 px-3.5 py-2 bg-gradient-to-br from-[#9aff8d] via-[#8aff7d] to-[#7ae66d] text-[#232323] rounded-full font-semibold text-xs transition-all duration-300 hover:scale-105 active:scale-100 focus:outline-none focus:ring-2 focus:ring-[#9aff8d] focus:ring-offset-2 focus:ring-offset-black ${
        pulseAnimation ? 'animate-pulse-subtle' : ''
      }`}
      style={{
        boxShadow: '0 4px 20px rgba(154, 255, 141, 0.2), 0 0 40px rgba(154, 255, 141, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
      }}
      aria-label="Ir a Trazzos Academy"
    >
      {/* Glow exterior suave */}
      <div className="absolute inset-0 rounded-full bg-[#9aff8d] opacity-20 blur-xl -z-10 group-hover:opacity-30 transition-opacity" />

      {/* Ícono académico minimalista */}
      <svg 
        className="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2.5} 
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" 
        />
      </svg>
      
      {/* Texto principal */}
      <span className="font-semibold leading-tight whitespace-nowrap">Trazzos Academy</span>

      {/* Tooltip elegante - se despliega hacia arriba */}
      <div className={`absolute bottom-full right-0 mb-3 px-4 py-2.5 bg-zinc-900/95 backdrop-blur-sm text-white text-xs rounded-lg whitespace-nowrap pointer-events-none z-50 border border-zinc-800 shadow-2xl transition-all duration-200 ${
        showTooltip ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}>
        <div className="text-center">
          <div className="font-semibold mb-1 text-white">Trazzos Academy</div>
          <div className="text-zinc-400 text-[10px] leading-tight">Aprende. Conecta. Escala.</div>
        </div>
        {/* Flecha del tooltip apuntando hacia abajo */}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900"></div>
      </div>

      {/* Sheen effect sutil en hover */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-sheen transition-opacity pointer-events-none overflow-hidden" />
    </button>
  );
}

