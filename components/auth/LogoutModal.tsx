'use client';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-2">Cerrar sesión</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Se cerrará tu sesión en este dispositivo.
        </p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/50 rounded-lg transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}



