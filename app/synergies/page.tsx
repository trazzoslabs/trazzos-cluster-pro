'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PageTitle from '../components/ui/PageTitle';
import SectionCard from '../components/ui/SectionCard';
import StatusBadge from '../components/ui/StatusBadge';

interface Synergy {
  synergy_id: string;
  cluster_id: string | null;
  item_category: string;
  window_start: string;
  window_end: string;
  companies_involved_json: any;
  volume_total_json: any;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function SynergiesContent() {
  const searchParams = useSearchParams();
  const clusterId = searchParams.get('cluster_id');
  
  const [synergies, setSynergies] = useState<Synergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingRfp, setCreatingRfp] = useState<string | null>(null);
  const [rfpError, setRfpError] = useState<string | null>(null);
  const [rfpSuccess, setRfpSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSynergies() {
      try {
        setLoading(true);
        setError(null);
        
        const url = clusterId 
          ? `/api/data/synergies?cluster_id=${clusterId}`
          : '/api/data/synergies';
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch synergies: ${response.statusText}`);
        }

        const result = await response.json();
        setSynergies(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load synergies');
        console.error('Error fetching synergies:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSynergies();
  }, [clusterId]);

  const handleCreateRfp = async (synergyId: string) => {
    try {
      setCreatingRfp(synergyId);
      setRfpError(null);
      setRfpSuccess(null);

      const response = await fetch('/api/workflows/rfp-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          synergy_id: synergyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to create RFP');
      }

      const result = await response.json();
      setRfpSuccess(synergyId);
      
      // Opcional: redirigir al RFP creado si viene en la respuesta
      if (result.data?.rfp_id) {
        setTimeout(() => {
          window.location.href = `/rfp/${result.data.rfp_id}`;
        }, 2000);
      }
    } catch (err) {
      setRfpError(err instanceof Error ? err.message : 'Failed to create RFP');
    } finally {
      setCreatingRfp(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  const formatVolume = (volumeJson: any) => {
    if (!volumeJson) return 'N/A';
    if (typeof volumeJson === 'number') return volumeJson.toLocaleString('es-CO');
    if (typeof volumeJson === 'object') {
      return JSON.stringify(volumeJson);
    }
    return String(volumeJson);
  };

  return (
    <div>
      <PageTitle
        title="Oportunidades Conjuntas"
        subtitle="Identificación de compras compartidas y ventanas de sincronización"
      />

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d] mb-4"></div>
          <p className="text-zinc-400">Cargando sinergias...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-300">Error: {error}</p>
        </div>
      )}

      {!loading && !error && synergies.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400">
            {clusterId 
              ? 'No hay sinergias disponibles para este cluster'
              : 'No hay sinergias disponibles'}
          </p>
        </div>
      )}

      {!loading && !error && synergies.length > 0 && (
        <SectionCard>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Categoría</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Ventana Inicio</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Ventana Fin</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Volumen Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {synergies.map((synergy) => (
                  <tr key={synergy.synergy_id} className="hover:bg-zinc-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      {synergy.item_category}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(synergy.window_start)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(synergy.window_end)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatVolume(synergy.volume_total_json)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={synergy.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCreateRfp(synergy.synergy_id)}
                          disabled={creatingRfp === synergy.synergy_id}
                          className="px-3 py-1.5 bg-[#9aff8d] hover:bg-[#9aff8d]/80 disabled:bg-zinc-700 disabled:text-zinc-400 text-[#232323] rounded-md transition-colors text-sm font-medium disabled:cursor-not-allowed"
                        >
                          {creatingRfp === synergy.synergy_id ? 'Creando...' : 'Crear RFP'}
                        </button>
                        <Link
                          href={`/rfps?synergy_id=${synergy.synergy_id}`}
                          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors text-sm font-medium"
                        >
                          Ver RFPs
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {rfpError && (
        <div className="mt-6 bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-300">Error al crear RFP: {rfpError}</p>
        </div>
      )}

      {rfpSuccess && (
        <div className="mt-6 bg-green-900/20 border border-green-800 rounded-lg p-4">
          <p className="text-green-300">✓ RFP creado exitosamente. Redirigiendo...</p>
        </div>
      )}
    </div>
  );
}

export default function SynergiesPage() {
  return (
    <Suspense fallback={
      <div>
        <PageTitle title="Oportunidades Conjuntas" />
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d] mb-4"></div>
          <p className="text-zinc-400">Cargando...</p>
        </div>
      </div>
    }>
      <SynergiesContent />
    </Suspense>
  );
}
