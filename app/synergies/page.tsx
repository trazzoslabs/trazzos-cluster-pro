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
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingRfp, setCreatingRfp] = useState<string | null>(null);
  const [rfpError, setRfpError] = useState<string | null>(null);
  const [rfpSuccess, setRfpSuccess] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    async function fetchSynergies() {
      try {
        setLoading(true);
        setError(null);
        
        const base = clusterId 
          ? `/api/data/synergies?cluster_id=${clusterId}&debug=1`
          : '/api/data/synergies?debug=1';
        
        const response = await fetch(base);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch synergies: ${response.statusText}`);
        }

        const result = await response.json();
        setRawResponse(result);
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

  /** Extract a single human-readable number + unit from volume_total_json */
  const formatVolume = (volumeJson: any): string => {
    if (volumeJson == null) return '—';
    if (typeof volumeJson === 'number') return volumeJson.toLocaleString('es-CO');
    if (typeof volumeJson === 'string') {
      const n = Number(volumeJson);
      return isNaN(n) ? volumeJson : n.toLocaleString('es-CO');
    }
    if (typeof volumeJson === 'object') {
      const total = volumeJson.total ?? volumeJson.total_units ?? volumeJson.quantity ?? volumeJson.amount ?? volumeJson.value;
      const uom = volumeJson.uom ?? volumeJson.unit ?? volumeJson.currency ?? '';
      if (total !== undefined && total !== null) {
        const num = Number(total);
        const formatted = isNaN(num) ? String(total) : num.toLocaleString('es-CO');
        return uom ? `${formatted} ${uom}` : formatted;
      }
      // Fallback: pick first numeric-looking value
      for (const [, v] of Object.entries(volumeJson)) {
        if (typeof v === 'number') return v.toLocaleString('es-CO');
        if (typeof v === 'string' && !isNaN(Number(v))) return Number(v).toLocaleString('es-CO');
      }
      return '—';
    }
    return '—';
  };

  /** Extract a flat list of company name strings from companies_involved_json */
  const extractCompanyNames = (companiesJson: any): string[] => {
    const pick = (entry: any): string | null => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        // Skip UUIDs that look like raw IDs if a name exists elsewhere
        return entry;
      }
      if (typeof entry === 'object') {
        return entry.name ?? entry.company_name ?? entry.short_name ?? null;
      }
      return null;
    };

    let raw = companiesJson;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { return [raw]; }
    }

    if (Array.isArray(raw)) {
      return raw.map(pick).filter((n): n is string => !!n);
    }

    const name = pick(raw);
    return name ? [name] : [];
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
        <div className="text-center py-12 space-y-3">
          <p className="text-zinc-400">
            No hay sinergias disponibles.
          </p>
          {rawResponse?._debug && (
            <div className="inline-block text-left bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-xs space-y-1">
              <p className="text-zinc-500">Diagnóstico de tablas:</p>
              <p className="text-zinc-400">operational_data: <span className="text-white font-mono">{rawResponse._debug.operational_data_count ?? '?'}</span></p>
              <p className="text-zinc-400">synergies: <span className="text-white font-mono">{rawResponse._debug.synergies_count ?? '?'}</span></p>
              <p className="text-zinc-400">needs: <span className="text-white font-mono">{rawResponse._debug.needs_count ?? '?'}</span></p>
              <p className="text-zinc-400">shutdowns: <span className="text-white font-mono">{rawResponse._debug.shutdowns_count ?? '?'}</span></p>
              {(rawResponse._debug.operational_data_count ?? 0) === 0 && (rawResponse._debug.synergies_count ?? 0) === 0 && (
                <p className="text-yellow-400 mt-2">Ninguna tabla tiene datos de sinergias. Sube datos desde Ingesta y ejecuta &quot;Refrescar Vistas&quot;.</p>
              )}
              {((rawResponse._debug.operational_data_count ?? 0) > 0 || (rawResponse._debug.needs_count ?? 0) > 0) && (rawResponse._debug.synergies_count ?? 0) === 0 && (
                <p className="text-yellow-400 mt-2">Hay datos en operational_data o needs, pero no en synergies. Ejecuta &quot;Refrescar Vistas&quot; desde Ingesta.</p>
              )}
            </div>
          )}
        </div>
      )}

      {rawResponse?._debug?.used_fallback && synergies.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 mb-4">
          <p className="text-yellow-300 text-sm">Mostrando todas las sinergias (el filtro original no devolvió resultados).</p>
        </div>
      )}

      {!loading && !error && synergies.length > 0 && (
        <SectionCard title="Sinergias detectadas">
          {/* Resumen */}
          <div className="flex flex-wrap gap-4 mb-5 text-sm">
            <div className="bg-zinc-800/60 rounded-lg px-4 py-2">
              <span className="text-zinc-400">Total:</span>{' '}
              <span className="text-white font-semibold">{synergies.length}</span>
            </div>
            <div className="bg-zinc-800/60 rounded-lg px-4 py-2">
              <span className="text-zinc-400">Categorías:</span>{' '}
              <span className="text-white font-semibold">
                {new Set(synergies.map(s => s.item_category).filter(Boolean)).size}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Empresas Involucradas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Ventana</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider">Volumen Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {synergies.map((synergy) => {
                  const companies = extractCompanyNames(synergy.companies_involved_json);
                  return (
                    <tr key={synergy.synergy_id} className="hover:bg-zinc-800/40 transition-colors">
                      {/* Categoría */}
                      <td className="px-4 py-3">
                        {synergy.item_category ? (
                          <span className="text-sm text-white font-medium">{synergy.item_category}</span>
                        ) : (
                          <span className="text-sm text-zinc-600 italic">sin categoría</span>
                        )}
                      </td>

                      {/* Empresas — pill tags */}
                      <td className="px-4 py-3">
                        {companies.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {companies.map((name, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[#9aff8d]/10 text-[#9aff8d] border border-[#9aff8d]/20"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Ventana (inicio – fin combinados) */}
                      <td className="px-4 py-3 text-sm text-zinc-400 whitespace-nowrap">
                        {synergy.window_start || synergy.window_end ? (
                          <>
                            {synergy.window_start ? formatDate(synergy.window_start) : '?'}
                            {' → '}
                            {synergy.window_end ? formatDate(synergy.window_end) : '?'}
                          </>
                        ) : '—'}
                      </td>

                      {/* Volumen */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-white font-mono">
                          {formatVolume(synergy.volume_total_json)}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={synergy.status} />
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleCreateRfp(synergy.synergy_id)}
                            disabled={creatingRfp === synergy.synergy_id}
                            className="px-3 py-1.5 bg-[#9aff8d] hover:bg-[#9aff8d]/80 disabled:bg-zinc-700 disabled:text-zinc-400 text-[#232323] rounded-md transition-colors text-xs font-semibold disabled:cursor-not-allowed"
                          >
                            {creatingRfp === synergy.synergy_id ? 'Creando...' : 'Crear RFP'}
                          </button>
                          <Link
                            href={`/rfps?synergy_id=${synergy.synergy_id}`}
                            className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors text-xs font-medium"
                          >
                            Ver RFPs
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Panel de debug — muestra datos crudos de la API */}
      {!loading && (
        <div className="mt-8">
          <button
            onClick={() => setShowDebug(d => !d)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${showDebug ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Debug: Datos crudos de API
          </button>

          {showDebug && (
            <div className="mt-2 bg-zinc-900 border border-zinc-700 rounded-lg p-4 overflow-auto max-h-[500px]">
              {rawResponse?._debug && (
                <div className="mb-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Fuente:</span>
                    <span className="text-white font-mono">{rawResponse._debug.source || 'ninguna'}</span>
                    {rawResponse._debug.used_fallback && (
                      <span className="text-yellow-400">(fallback)</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['operational_data', 'synergies', 'needs', 'shutdowns', 'companies'].map(t => (
                      <div key={t} className="bg-zinc-800 rounded p-2">
                        <span className="text-zinc-400">{t}:</span>{' '}
                        <span className="text-white font-mono">
                          {rawResponse._debug[`${t}_count`] ?? '?'}
                        </span>
                        {rawResponse._debug[`${t}_error`] && (
                          <span className="text-red-400 block text-[10px] mt-0.5">
                            {rawResponse._debug[`${t}_error`]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            </div>
          )}
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
