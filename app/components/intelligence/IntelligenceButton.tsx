'use client';

import { useState } from 'react';
import IntelligenceModal from './IntelligenceModal';

export default function IntelligenceButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Botón fijo en esquina inferior derecha */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="group fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 rounded-lg text-zinc-400 hover:text-white hover:border-[#9aff8d]/30 hover:bg-zinc-800/90 transition-all shadow-lg hover:shadow-[#9aff8d]/10"
        title="Guía estratégica del sistema"
      >
        {/* Icono minimalista - spark/brain */}
        <svg 
          className="w-4 h-4 text-[#9aff8d] group-hover:scale-110 transition-transform" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
          />
        </svg>
        <span className="text-sm font-medium">Asistencia</span>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <IntelligenceModal onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}

