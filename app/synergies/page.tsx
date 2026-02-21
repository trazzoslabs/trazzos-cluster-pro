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
        body: JSON.stringify({ synergy_id: synergyId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to create RFP');
      }

      const result = await response.json();
      setRfpSuccess(synergyId);

      if (result.data?.rfp_id) {
        setTimeout(() => { window.location.href = `/rfp/${result.data.rfp_id}`; }, 2000);
      }
    } catch (err) {
      setRfpError(err instanceof Error ? err.message : 'Failed to create RFP');
    } finally {
      setCreatingRfp(null);
    }
  };

  // ── Formatters ────────────────────────────────────────────────────────

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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Return a flat list of company name strings.
   * The API already resolves UUIDs → names; this is a safety net for
   * any remaining objects or UUIDs that slipped through.
   */
  const extractCompanyNames = (raw: any): string[] => {
    if (!raw) return [];

    let entries: any[] = [];
    if (typeof raw === 'string') {
      try { entries = JSON.parse(raw); } catch { return UUID_RE.test(raw) ? [] : [raw]; }
      if (!Array.isArray(entries)) entries = [entries];
    } else if (Array.isArray(raw)) {
      entries = raw;
    } else if (typeof raw === 'object') {
      entries = [raw];
    } else {
      return [];
    }

    const names: string[] = [];
    for (const e of entries) {
      if (typeof e === 'string') {
        if (!UUID_RE.test(e)) names.push(e);
      } else if (typeof e === 'object' && e !== null) {
        const n = e.name ?? e.company_name ?? e.short_name;
        if (n && typeof n === 'string') names.push(n);
      }
    }
    return names;
  };

  /**
   * Extract total + unit from volume_total_json.
   * Returns a clean formatted string like "7,020 UN" or "500 Tons".
   */
  const formatVolume = (v: any): string => {
    if (v == null) return '—';
    if (typeof v === 'number') return v.toLocaleString('es-CO');
    if (typeof v === 'string') {
      const n = Number(v);
      return isNaN(n) ? v : n.toLocaleString('es-CO');
    }
    if (typeof v === 'object') {
      const total = v.total ?? v.total_units ?? v.quantity ?? v.amount ?? v.value;
      const unit = v.uom ?? v.unit ?? v.currency ?? '';

      if (total !== undefined && total !== null) {
        const num = Number(total);
        const formatted = isNaN(num) ? String(total) : num.toLocaleString('es-CO');
        return unit ? `${formatted} ${unit}` : formatted;
      }

      for (const val of Object.values(v)) {
        if (typeof val === 'number') return val.toLocaleString('es-CO');
        if (typeof val === 'string' && !isNaN(Number(val))) return Number(val).toLocaleString('es-CO');
      }
    }
    return '—';
  };

  // ── Render ────────────────────────────────────────────────────────────

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
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-zinc-400 text-lg font-medium mb-1">Sin sinergias disponibles</p>
          <p className="text-zinc-500 text-sm">Sube datos desde Ingesta y ejecuta &quot;Refrescar Vistas&quot; para generar sinergias.</p>
        </div>
      )}

      {!loading && !error && synergies.length > 0 && (
        <SectionCard title="Sinergias detectadas">
          {/* Summary strip */}
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

                      {/* Empresas — green pill tags */}
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

                      {/* Ventana */}
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
          <p className="text-green-300">RFP creado exitosamente. Redirigiendo...</p>
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
