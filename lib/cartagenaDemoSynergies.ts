import { AUTH_BYPASS_COMPANY_ID } from '@/lib/authBypass';

/** Session flag tras “Aprobar” en el mapeo bypass; sincroniza dashboard, sinergias y vista 3D. */
export const CARTAGENA_DEMO_SESSION_KEY = 'cartagena_demo_active';

export function isDemoActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(CARTAGENA_DEMO_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isCartagenaBypassCompanyId(companyId: string | null | undefined): boolean {
  return (companyId ?? '').trim() === AUTH_BYPASS_COMPANY_ID;
}

/** Misma forma que consume `app/synergies/page.tsx` y `getSynergies`. */
export interface CartagenaDemoSynergyRow {
  synergy_id: string;
  cluster_id: string | null;
  item_category: string;
  window_start: string;
  window_end: string;
  companies_involved_json: string[];
  volume_total_json: { total: number; uom: string; estimated_savings_pct: number };
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Sinergias ficticias para demo Cluster Cartagena (sin Supabase / n8n).
 * Formato alineado con la vista en `app/synergies/page.tsx`.
 */
export function getCartagenaDemoSynergyRows(): CartagenaDemoSynergyRow[] {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  return [
    {
      synergy_id: 'b1111111-1111-4111-a111-111111111101',
      cluster_id: null,
      item_category: 'Intercambio de válvulas industriales Reficar–Yara',
      window_start: iso(now - 14 * 86400000),
      window_end: iso(now + 50 * 86400000),
      companies_involved_json: ['Reficar', 'Yara'],
      volume_total_json: { total: 420, uom: 'UN', estimated_savings_pct: 19 },
      status: 'detected',
      created_at: iso(now),
      updated_at: iso(now),
    },
    {
      synergy_id: 'b1111111-1111-4111-a111-111111111102',
      cluster_id: null,
      item_category: 'Logística compartida de urea (Yara–Esenttia)',
      window_start: iso(now - 7 * 86400000),
      window_end: iso(now + 30 * 86400000),
      companies_involved_json: ['Yara', 'Esenttia'],
      volume_total_json: { total: 2800, uom: 'Tons', estimated_savings_pct: 14 },
      status: 'detected',
      created_at: iso(now),
      updated_at: iso(now),
    },
    {
      synergy_id: 'b1111111-1111-4111-a111-111111111103',
      cluster_id: null,
      item_category: 'Consolidación de compra de rodamientos (Reficar–Argos)',
      window_start: iso(now - 21 * 86400000),
      window_end: iso(now + 60 * 86400000),
      companies_involved_json: ['Reficar', 'Argos'],
      volume_total_json: { total: 1850, uom: 'UN', estimated_savings_pct: 22 },
      status: 'active',
      created_at: iso(now),
      updated_at: iso(now),
    },
    {
      synergy_id: 'b1111111-1111-4111-a111-111111111104',
      cluster_id: null,
      item_category: 'Servicio de calibración de instrumentación (Cabot–Reficar)',
      window_start: iso(now - 3 * 86400000),
      window_end: iso(now + 20 * 86400000),
      companies_involved_json: ['Cabot', 'Reficar'],
      volume_total_json: { total: 96, uom: 'servicios', estimated_savings_pct: 11 },
      status: 'detected',
      created_at: iso(now),
      updated_at: iso(now),
    },
  ];
}

const PIPELINE_SYNERGY_STATUSES = new Set(['detected', 'active', 'open', 'pending']);

function savingsPctFromVolumeJson(v: unknown): number {
  if (!v || typeof v !== 'object') return 0;
  const o = v as Record<string, unknown>;
  const pct = Number(o.estimated_savings_pct ?? o.savings_pct ?? 0);
  return Number.isFinite(pct) ? pct : 0;
}

/** Agrega métricas de lista de sinergias (API real o demo). */
export function aggregateSynergyDashboardMetrics(
  rows: Array<{ status?: string | null; volume_total_json?: unknown }>,
): { total: number; activeInPipeline: number; avgSavingsPct: number } {
  const total = rows.length;
  const activeInPipeline = rows.filter((r) =>
    PIPELINE_SYNERGY_STATUSES.has((r.status ?? '').toLowerCase()),
  ).length;
  const sumPct = rows.reduce((acc, r) => acc + savingsPctFromVolumeJson(r.volume_total_json), 0);
  const avgSavingsPct = total > 0 ? Math.round((sumPct / total) * 10) / 10 : 0;
  return { total, activeInPipeline, avgSavingsPct };
}

/** Métricas del dashboard para demo Cartagena (4 sinergias ficticias). */
export function getCartagenaDemoSynergyDashboardStats(): {
  total: number;
  activeInPipeline: number;
  avgSavingsPct: number;
} {
  return aggregateSynergyDashboardMetrics(getCartagenaDemoSynergyRows());
}
