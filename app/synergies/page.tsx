'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CANONICAL_PURCHASE_ORDER_ENTITY_TYPE } from '@/lib/utils/normalization';
import { isCartagenaBypassCompanyId, getCartagenaDemoSynergyRows } from '@/lib/cartagenaDemoSynergies';
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

interface EvidenceRecord {
  evidence_id: string;
  payload_hash_sha256?: string | null;
  tx_hash?: string | null;
  simulated_transaction_hash?: string | null;
  is_sandbox_transaction?: boolean;
  created_at: string | null;
}

type SavingsImpact = 'all' | 'high' | 'medium' | 'low';

function SynergiesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clusterId = searchParams.get('cluster_id');

  const [synergies, setSynergies] = useState<Synergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingRfp, setCreatingRfp] = useState<string | null>(null);
  const [rfpError, setRfpError] = useState<string | null>(null);
  const [rfpSuccess, setRfpSuccess] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [impactFilter, setImpactFilter] = useState<SavingsImpact>('all');
  const [evidenceModal, setEvidenceModal] = useState<{
    open: boolean;
    loading: boolean;
    category: string;
    hash: string | null;
    error: string | null;
    sandbox: boolean;
  }>({
    open: false,
    loading: false,
    category: '',
    hash: null,
    error: null,
    sandbox: false,
  });

  useEffect(() => {
    async function fetchSynergies() {
      try {
        setLoading(true);
        setError(null);

        let companyId: string | null = null;
        try {
          const profileRes = await fetch('/api/auth/profile');
          if (profileRes.ok) {
            const profileJson = await profileRes.json();
            companyId =
              typeof profileJson?.data?.company_id === 'string'
                ? profileJson.data.company_id.trim()
                : null;
          }
        } catch {
          /* perfil opcional */
        }

        if (isCartagenaBypassCompanyId(companyId)) {
          setSynergies(getCartagenaDemoSynergyRows() as unknown as Synergy[]);
          return;
        }

        const params = new URLSearchParams();
        if (clusterId) params.set('cluster_id', clusterId);
        if (companyId) params.set('company_id', companyId);
        const qs = params.toString();
        const url = qs ? `/api/data/synergies?${qs}` : '/api/data/synergies';

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

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('trazzos_marts');
      bc.onmessage = (event) => {
        const msg = event?.data;
        if (msg?.type === 'n8n_v2_ok') {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            router.refresh();
          }, 3_000);
        }
      };
    } catch {
      // Browser sin BroadcastChannel
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (bc) bc.close();
    };
  }, [router]);

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
        if (n && typeof n === 'string') { names.push(n); continue; }
        // Fallback: pick first non-UUID string value from the object
        for (const val of Object.values(e)) {
          if (typeof val === 'string' && val.length > 0 && !UUID_RE.test(val)) {
            names.push(val);
            break;
          }
        }
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

  const getSavingsPct = (v: any): number => {
    if (!v || typeof v !== 'object') return 0;
    const pct = Number(v.estimated_savings_pct ?? v.savings_pct ?? 0);
    return Number.isFinite(pct) ? pct : 0;
  };

  const getImpactLevel = (savingsPct: number): SavingsImpact => {
    if (savingsPct >= 18) return 'high';
    if (savingsPct >= 12) return 'medium';
    return 'low';
  };

  const getStatusMeta = (status: string | null) => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'completed') {
      return { label: 'Awarded', classes: 'bg-green-500/15 text-green-300 border-green-500/30' };
    }
    if (normalized === 'detected') {
      return { label: 'In Review', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    return { label: 'Active', classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
  };

  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '--';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  };

  const handleViewEvidence = async (synergy: Synergy) => {
    setEvidenceModal({
      open: true,
      loading: true,
      category: synergy.item_category || 'Sinergia',
      hash: null,
      error: null,
      sandbox: false,
    });

    try {
      const rfpsRes = await fetch(`/api/data/rfps?synergy_id=${synergy.synergy_id}`);
      const rfpsJson = rfpsRes.ok ? await rfpsRes.json() : { data: [] };
      const rfpId = rfpsJson?.data?.[0]?.rfp_id;

      if (!rfpId) {
        throw new Error('No se encontró RFP asociado para esta sinergia.');
      }

      const poRes = await fetch(`/api/data/purchase-orders?rfp_id=${rfpId}`);
      const poJson = poRes.ok ? await poRes.json() : { data: [] };
      const poId = poJson?.data?.[0]?.po_id;

      if (!poId) {
        throw new Error('No se encontró orden de compra para este RFP.');
      }

      const evidenceRes = await fetch(
        `/api/data/evidence?entity_type=${encodeURIComponent(CANONICAL_PURCHASE_ORDER_ENTITY_TYPE)}&entity_id=${poId}`,
      );
      const evidenceJson = evidenceRes.ok ? await evidenceRes.json() : { data: [] };
      const evidence = (evidenceJson?.data?.[0] || null) as EvidenceRecord | null;

      const payloadHash = evidence?.payload_hash_sha256?.trim() ?? '';
      const chainOrSandboxTx = evidence?.tx_hash?.trim() ?? '';
      const sandbox = Boolean(evidence?.is_sandbox_transaction);

      if (!payloadHash && !chainOrSandboxTx) {
        throw new Error('No se encontró hash de evidencia para la adjudicación.');
      }

      setEvidenceModal((prev) => ({
        ...prev,
        loading: false,
        hash: payloadHash || chainOrSandboxTx,
        sandbox,
      }));
    } catch (err) {
      setEvidenceModal((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'No fue posible cargar la evidencia.',
      }));
    }
  };

  const filteredSynergies = synergies.filter((synergy) => {
    const category = (synergy.item_category || '').toLowerCase();
    const matchesSearch = category.includes(categorySearch.trim().toLowerCase());
    const impact = getImpactLevel(getSavingsPct(synergy.volume_total_json));
    const matchesImpact = impactFilter === 'all' ? true : impact === impactFilter;
    return matchesSearch && matchesImpact;
  });

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div>
      <PageTitle
        title="Oportunidades Conjuntas"
        subtitle="Identificación de compras compartidas y ventanas de sincronización"
      />
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors text-sm font-medium border border-zinc-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar Vista
        </button>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d] mb-4"></div>
          <p className="text-zinc-400">Cargando sinergias...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-5 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-200 font-semibold text-sm mb-1">Error en procesamiento de n8n</p>
              <p className="text-red-300 text-sm">{error}</p>
              <p className="text-red-400/70 text-xs mt-2">Revise el formato del JSON subido y que el workflow de n8n esté activo.</p>
              <Link
                href="/ingestion"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reintentar Carga
              </Link>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && synergies.length === 0 && (
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-zinc-400 text-lg font-medium mb-1">Sin sinergias disponibles</p>
          <p className="text-zinc-500 text-sm">Sube datos desde Ingesta y ejecuta &quot;Refrescar Vistas&quot; para generar sinergias.</p>
          <p className="text-zinc-500 text-xs mt-3 font-mono">
            Buscando datos para el Cluster: {(clusterId || 'c1057e40').slice(0, 8)}...
          </p>
        </div>
      )}

      {!loading && !error && synergies.length > 0 && (() => {
        const failedCount = synergies.filter(s => ['error', 'failed'].includes(s.status?.toLowerCase() ?? '')).length;
        return (
        <SectionCard title="Sinergias detectadas">
          {failedCount > 0 && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-5 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-red-200 font-semibold text-sm">
                    {failedCount} sinergia{failedCount > 1 ? 's' : ''} con error de procesamiento
                  </p>
                  <p className="text-red-400/70 text-xs mt-1">Error en procesamiento de n8n: Revise el formato del JSON</p>
                </div>
              </div>
              <Link
                href="/ingestion"
                className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reintentar Carga
              </Link>
            </div>
          )}

          {/* Summary strip */}
          <div className="flex flex-wrap gap-4 mb-5 text-sm">
            <div className="bg-zinc-800/60 rounded-lg px-4 py-2">
              <span className="text-zinc-400">Total:</span>{' '}
              <span className="text-white font-semibold">{synergies.length}</span>
            </div>
            <div className="bg-zinc-800/60 rounded-lg px-4 py-2">
              <span className="text-zinc-400">En vista:</span>{' '}
              <span className="text-white font-semibold">{filteredSynergies.length}</span>
            </div>
            <div className="bg-zinc-800/60 rounded-lg px-4 py-2">
              <span className="text-zinc-400">Categorías:</span>{' '}
              <span className="text-white font-semibold">
                {new Set(synergies.map(s => s.item_category).filter(Boolean)).size}
              </span>
            </div>
          </div>

          {/* Filtros avanzados */}
          <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Buscar por categoría (ej. Rodamientos, EPP...)"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]/50"
            />
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value as SavingsImpact)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]/50"
            >
              <option value="all">Impacto de ahorro: Todos</option>
              <option value="high">Impacto Alto</option>
              <option value="medium">Impacto Medio</option>
              <option value="low">Impacto Bajo</option>
            </select>
          </div>

          {filteredSynergies.length === 0 ? (
            <div className="text-center py-10 border border-zinc-800 rounded-lg bg-zinc-900/30">
              <p className="text-zinc-400">No hay sinergias que coincidan con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredSynergies.map((synergy) => {
                const companies = extractCompanyNames(synergy.companies_involved_json);
                const statusMeta = getStatusMeta(synergy.status);
                const savingsPct = getSavingsPct(synergy.volume_total_json);
                const impactLevel = getImpactLevel(savingsPct);
                const impactClasses =
                  impactLevel === 'high'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : impactLevel === 'medium'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';

                return (
                  <div key={synergy.synergy_id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-white font-semibold text-base">{synergy.item_category || 'Sin categoría'}</h3>
                        <p className="text-zinc-500 text-xs mt-1">
                          Ventana: {synergy.window_start ? formatDate(synergy.window_start) : '?'} → {synergy.window_end ? formatDate(synergy.window_end) : '?'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusMeta.classes}`}>
                          {statusMeta.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${impactClasses}`}>
                          Ahorro {savingsPct || 0}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-zinc-400 text-xs">Volumen consolidado</p>
                        <p className="text-white font-mono text-sm">{formatVolume(synergy.volume_total_json)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-zinc-400 text-xs">Estado técnico</p>
                        <StatusBadge status={synergy.status} />
                      </div>
                    </div>

                    <div>
                      <p className="text-zinc-400 text-xs mb-2">Indicadores de colaboración</p>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {companies.slice(0, 4).map((company, idx) => (
                            <div
                              key={idx}
                              title={company}
                              className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-200 text-[10px] font-semibold flex items-center justify-center"
                            >
                              {getInitials(company)}
                            </div>
                          ))}
                        </div>
                        <p className="text-zinc-300 text-xs">
                          {companies.length || 0} empresa{companies.length === 1 ? '' : 's'} unida{companies.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleViewEvidence(synergy)}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors text-xs font-medium border border-zinc-700"
                      >
                        Ver Evidencia de Adjudicación
                      </button>
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
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
        );
      })()}

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

      {evidenceModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white font-semibold">Evidencia de Adjudicación</h3>
                <p className="text-zinc-400 text-xs mt-1">{evidenceModal.category}</p>
              </div>
              <button
                onClick={() =>
                  setEvidenceModal({
                    open: false,
                    loading: false,
                    category: '',
                    hash: null,
                    error: null,
                    sandbox: false,
                  })
                }
                className="text-zinc-400 hover:text-white text-sm"
              >
                Cerrar
              </button>
            </div>

            {evidenceModal.loading ? (
              <p className="text-zinc-300 text-sm">Consultando hash SHA-256...</p>
            ) : evidenceModal.error ? (
              <p className="text-red-300 text-sm">{evidenceModal.error}</p>
            ) : (
              <div className="space-y-3">
                {evidenceModal.sandbox && (
                  <p className="rounded-md border border-amber-600/40 bg-amber-950/50 px-3 py-2 text-sm text-amber-100">
                    Verificado en Sandbox
                  </p>
                )}
                <div>
                  <p className="text-zinc-400 text-xs">
                    {evidenceModal.sandbox ? 'Huella / transacción (sandbox)' : 'Hash SHA-256'}
                  </p>
                  <div className="mt-1 bg-zinc-950 border border-zinc-800 rounded-md p-3">
                    <p className="text-[#9aff8d] font-mono text-xs break-all">{evidenceModal.hash}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
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
