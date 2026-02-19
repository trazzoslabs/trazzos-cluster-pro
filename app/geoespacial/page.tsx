'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import PageTitle from '../components/ui/PageTitle';
import SectionCard from '../components/ui/SectionCard';
import GeoSidebar from '../components/geo/GeoSidebar';
import MapboxLoader from '../components/geo/MapboxLoader';
import { useRouter } from 'next/navigation';

// Importar GeoMap dinámicamente para evitar problemas de SSR
const GeoMap = dynamic(() => import('../components/geo/GeoMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-black/50 rounded-lg border border-zinc-800 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d]"></div>
        <p className="text-zinc-400 mt-4">Cargando mapa...</p>
      </div>
    </div>
  ),
});

interface GeoCompany {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
}

type ViewMode = 'cluster' | 'companies' | 'synergies';

export default function GeoespacialPage() {
  const [companies, setCompanies] = useState<GeoCompany[]>([]);
  const [synergies, setSynergies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [is3DMode, setIs3DMode] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('companies');
  const [showConnections, setShowConnections] = useState(true);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [companiesRes, synergiesRes] = await Promise.all([
        fetch('/api/data/companies-geo'),
        fetch('/api/data/synergies'),
      ]);

      const companiesData = await companiesRes.json();
      const synergiesData = await synergiesRes.json();

      setCompanies(companiesData.data || []);
      setSynergies(synergiesData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId) || null;

  const handleResetView = () => {
    // Resetear vista al bounding box del cluster
    setSelectedCompanyId(null);
    // El mapa se reseteará automáticamente cuando selectedCompanyId sea null
  };

  const handleViewSynergies = () => {
    router.push('/synergies');
  };

  const handleViewDetail = () => {
    if (selectedCompanyId) {
      // Navegar a detalle de empresa (ajustar según tu estructura)
      router.push(`/synergies?company=${selectedCompanyId}`);
    }
  };

  return (
    <div className="space-y-6">
      <MapboxLoader />
      <PageTitle
        title="Vista Geoespacial 3D"
        subtitle="Explora el cluster industrial desde una perspectiva geoespacial"
      />

      {/* Controles */}
      <SectionCard title="" description="">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Toggle 2D/3D */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">2D</span>
            <button
              onClick={() => setIs3DMode(!is3DMode)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                is3DMode ? 'bg-[#9aff8d]' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  is3DMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm text-zinc-400">3D</span>
          </div>

          {/* Toggle Modo de Vista */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-400">Vista:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]/50"
            >
              <option value="cluster">Clúster</option>
              <option value="companies">Empresas</option>
              <option value="synergies">Sinergias</option>
            </select>
          </div>

          {/* Toggle Conexiones */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-connections"
              checked={showConnections}
              onChange={(e) => setShowConnections(e.target.checked)}
              className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-[#9aff8d] focus:ring-[#9aff8d]/50"
            />
            <label htmlFor="show-connections" className="text-sm text-zinc-400 cursor-pointer">
              Mostrar conexiones
            </label>
          </div>

          {/* Botón Reset */}
          <button
            onClick={handleResetView}
            className="px-4 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors border border-zinc-700"
          >
            Reset Vista
          </button>
        </div>
      </SectionCard>

      {/* Mapa */}
      {loading ? (
        <div className="h-[600px] bg-black/50 rounded-lg border border-zinc-800 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d]"></div>
            <p className="text-zinc-400 mt-4">Cargando datos...</p>
          </div>
        </div>
      ) : (
        <SectionCard title="" description="">
          <div className="h-[600px] relative">
            <GeoMap
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              onCompanySelect={setSelectedCompanyId}
              is3DMode={is3DMode}
              showConnections={showConnections && viewMode !== 'cluster'}
              synergies={synergies}
            />
          </div>
        </SectionCard>
      )}

      {/* Sidebar */}
      <GeoSidebar
        company={selectedCompany}
        onClose={() => setSelectedCompanyId(null)}
        onViewSynergies={handleViewSynergies}
        onViewDetail={handleViewDetail}
      />
    </div>
  );
}

