'use client';

interface GeoCompany {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
}

interface GeoSidebarProps {
  company: GeoCompany | null;
  onClose: () => void;
  onViewSynergies: () => void;
  onViewDetail: () => void;
}

export default function GeoSidebar({
  company,
  onClose,
  onViewSynergies,
  onViewDetail,
}: GeoSidebarProps) {
  if (!company) return null;

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 w-80 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-5 shadow-2xl">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-white font-bold text-lg">{company.name}</h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-zinc-400 text-xs mb-1">Coordenadas</p>
          <p className="text-white text-sm font-medium">
            {company.lat.toFixed(4)}, {company.lng.toFixed(4)}
          </p>
        </div>

        {company.category && (
          <div>
            <p className="text-zinc-400 text-xs mb-1">Categoría</p>
            <p className="text-white text-sm font-medium">{company.category}</p>
          </div>
        )}

        {company.status && (
          <div>
            <p className="text-zinc-400 text-xs mb-1">Estado</p>
            <p className="text-white text-sm font-medium capitalize">{company.status}</p>
          </div>
        )}

        <div className="pt-4 border-t border-zinc-800 flex flex-col gap-2">
          <button
            onClick={onViewSynergies}
            className="w-full px-4 py-2 bg-[#9aff8d]/10 text-[#9aff8d] rounded-lg text-sm font-medium hover:bg-[#9aff8d]/20 transition-colors border border-[#9aff8d]/30"
          >
            Ver Sinergias
          </button>
          <button
            onClick={onViewDetail}
            className="w-full px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors border border-zinc-700"
          >
            Ir a Detalle
          </button>
        </div>
      </div>
    </div>
  );
}



