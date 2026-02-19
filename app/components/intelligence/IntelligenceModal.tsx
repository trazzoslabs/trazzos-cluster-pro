'use client';

interface IntelligenceModalProps {
  onClose: () => void;
}

const GPT_LINK = 'https://chatgpt.com/g/g-6997051562348191a4cdc187983fd7fa-trazzos-intelligence-guia-del-cluster';

export default function IntelligenceModal({ onClose }: IntelligenceModalProps) {
  const handleOpenAssistant = () => {
    window.open(GPT_LINK, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {/* Overlay con backdrop blur */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          className="relative bg-zinc-900/95 backdrop-blur-md border border-[#9aff8d]/20 rounded-2xl p-8 max-w-lg w-full shadow-2xl pointer-events-auto opacity-0 scale-95 animate-[fadeInScale_0.3s_ease-out_forwards]"
          style={{
            boxShadow: '0 0 40px rgba(154, 255, 141, 0.1), 0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow verde sutil en el borde */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#9aff8d]/5 to-transparent pointer-events-none" />

          {/* Contenido */}
          <div className="relative z-10 space-y-6">
            {/* Título */}
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-white">
                Trazzos Intelligence
              </h2>
              <p className="text-lg text-zinc-400 font-medium">
                Guía estratégica del Cluster Industrial
              </p>
            </div>

            {/* Texto descriptivo */}
            <div className="pt-2">
              <p className="text-base text-zinc-300 leading-relaxed text-center">
                Este asistente le ayudará a comprender los módulos, procesos y términos del sistema Cluster Pro antes de interactuar con flujos operativos.
              </p>
            </div>

            {/* Botones */}
            <div className="flex flex-col gap-3 pt-4">
              {/* Botón principal - Abrir Asistente */}
              <button
                onClick={handleOpenAssistant}
                className="w-full px-6 py-3.5 bg-[#9aff8d] hover:bg-[#9aff8d]/90 text-[#232323] rounded-lg font-semibold text-base transition-all shadow-lg hover:shadow-[#9aff8d]/30 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Abrir Asistente
              </button>

              {/* Botón secundario - Cerrar */}
              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium text-sm transition-colors border border-zinc-700 hover:border-zinc-600"
              >
                Cerrar
              </button>
            </div>
          </div>

          {/* Botón de cerrar en esquina (opcional, discreto) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800/50"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

