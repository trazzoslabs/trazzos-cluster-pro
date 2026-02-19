'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';

interface Rfp {
  rfp_id: string;
  synergy_id: string | null;
  status: string | null;
  published_at: string | null;
  closing_at: string;
  rfp_pack_path: string | null;
  created_by_user_id: string | null;
}

function RfpsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const synergyId = searchParams.get('synergy_id');
  
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchRfps() {
      if (!synergyId) {
        setError('synergy_id es requerido');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/data/rfps?synergy_id=${synergyId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch rfps: ${response.statusText}`);
        }

        const result = await response.json();
        setRfps(result.data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rfps');
        console.error('Error fetching rfps:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRfps();
  }, [synergyId]);

  const handleCreateRfp = async () => {
    if (!synergyId) {
      setError('synergy_id es requerido');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await fetch('/api/workflows/rfp-open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          synergy_id: synergyId,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || `Failed to create RFP: ${response.statusText}`);
      }

      // Refrescar la lista de RFPs
      const refreshResponse = await fetch(`/api/data/rfps?synergy_id=${synergyId}`);
      if (refreshResponse.ok) {
        const result = await refreshResponse.json();
        setRfps(result.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create RFP');
      console.error('Error creating RFP:', err);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-textured">
      <Header backUrl="/synergies" backLabel="Volver a Sinergias" />
      <main className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white mb-2">
            RFPs
          </h1>
          {synergyId && (
            <p className="text-sm text-zinc-400 mt-2 font-mono">
              Synergy ID: {synergyId}
            </p>
          )}
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-4"></div>
            <p className="text-zinc-400">Cargando RFPs...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-300">Error: {error}</p>
          </div>
        )}

        {!loading && !error && !synergyId && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-300">
              Por favor, selecciona una sinergia desde la página anterior.
            </p>
          </div>
        )}

        {!loading && !error && synergyId && rfps.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-400 mb-6 text-lg">
              No hay RFPs aún
            </p>
            <button
              onClick={handleCreateRfp}
              disabled={creating}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-400 text-white rounded-md transition-colors font-medium shadow-md hover:shadow-lg"
            >
              {creating ? 'Creando RFP...' : 'Crear/Abrir RFP'}
            </button>
          </div>
        )}

        {!loading && !error && rfps.length > 0 && (
          <div className="space-y-4">
            {rfps.map((rfp) => (
              <div
                key={rfp.rfp_id}
                className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 shadow-lg hover:shadow-xl hover:border-green-500/50 transition-all duration-200 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-2 text-white group-hover:text-green-400 transition-colors">
                      RFP {rfp.rfp_id.substring(0, 8)}...
                    </h2>
                    <p className="text-xs text-zinc-500 font-mono mb-2">
                      ID: {rfp.rfp_id}
                    </p>
                    {rfp.status && (
                      <p className="text-sm text-zinc-400 mb-2">
                        Status: <span className="font-medium text-zinc-300">{rfp.status}</span>
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/rfp/${rfp.rfp_id}`}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors text-sm font-medium whitespace-nowrap shadow-md hover:shadow-lg"
                  >
                    Abrir
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-400">
                  <div>
                    <span className="font-medium">Publicado:</span>{' '}
                    {formatDate(rfp.published_at)}
                  </div>
                  <div>
                    <span className="font-medium">Cierre:</span>{' '}
                    {formatDate(rfp.closing_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function RfpsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center py-8">
            <p className="text-zinc-600 dark:text-zinc-400">Cargando...</p>
          </div>
        </main>
      </div>
    }>
      <RfpsContent />
    </Suspense>
  );
}

