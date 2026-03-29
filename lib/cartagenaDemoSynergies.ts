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

/** Volumen consolidado demo (USD) — suma de las 12 oportunidades. */
export const CARTAGENA_DEMO_CONSOLIDATED_USD = 8_400_000;

/** Ahorro medio ponderado solicitado para narrativa demo. */
export const CARTAGENA_DEMO_AVG_SAVINGS_PCT = 18.2;

export function getCartagenaDemoConsolidatedUsdTotal(): number {
  return CARTAGENA_DEMO_CONSOLIDATED_USD;
}

export function getCartagenaDemoEstimatedSavingsUsd(): number {
  return Math.round(CARTAGENA_DEMO_CONSOLIDATED_USD * (CARTAGENA_DEMO_AVG_SAVINGS_PCT / 100));
}

/** Pines Mamonal (Cartagena) — útiles si se reutiliza un mapa (p. ej. ruta dedicada); no usados en /intelligence. */
export function getCartagenaDemoGeoPins(): Array<{
  id: string;
  name: string;
  company_name: string;
  lat: number;
  lng: number;
}> {
  return [
    { id: 'demo-reficar', name: 'Reficar', company_name: 'Reficar', lat: 10.33, lng: -75.5 },
    { id: 'demo-yara', name: 'Yara', company_name: 'Yara', lat: 10.32, lng: -75.51 },
    { id: 'demo-argos', name: 'Argos', company_name: 'Argos', lat: 10.34, lng: -75.49 },
  ];
}

/** Misma forma que consume `app/synergies/page.tsx` y `getSynergies`. */
export interface CartagenaDemoSynergyRow {
  synergy_id: string;
  cluster_id: string | null;
  item_category: string;
  window_start: string;
  window_end: string;
  companies_involved_json: string[];
  volume_total_json: {
    amount: number;
    uom?: string;
    estimated_savings_pct: number;
  };
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Agrupa ahorro estimado para el donut de Análisis. */
  savings_segment: string;
}

const USD_PER_ROW = CARTAGENA_DEMO_CONSOLIDATED_USD / 12;

/**
 * 12 sinergias ficticias — volumen total USD 8.4M, ahorro medio 18.2 % en todas las filas.
 */
export function getCartagenaDemoSynergyRows(): CartagenaDemoSynergyRow[] {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const pct = CARTAGENA_DEMO_AVG_SAVINGS_PCT;

  const rows: Omit<CartagenaDemoSynergyRow, 'synergy_id' | 'window_start' | 'window_end' | 'created_at' | 'updated_at'>[] = [
    {
      cluster_id: null,
      item_category: 'Compra Conjunta de EPP Gremial',
      companies_involved_json: ['Reficar', 'Yara'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'detected',
      savings_segment: 'EPP & Seguridad industrial',
    },
    {
      cluster_id: null,
      item_category: 'Logística de Urea Fase 2',
      companies_involved_json: ['Yara', 'Dow'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'active',
      savings_segment: 'Logística & Químicos',
    },
    {
      cluster_id: null,
      item_category: 'Mantenimiento Compartido de Turbinas',
      companies_involved_json: ['Reficar', 'Argos'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'detected',
      savings_segment: 'Mantenimiento crítico',
    },
    {
      cluster_id: null,
      item_category: 'Hub de Residuos Circulares',
      companies_involved_json: ['Esenttia', 'Cabot'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'detected',
      savings_segment: 'Economía circular',
    },
    {
      cluster_id: null,
      item_category: 'Acuerdo de Válvulas y Instrumentación',
      companies_involved_json: ['Ajover', 'Reficar'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'active',
      savings_segment: 'Servicios industriales',
    },
    {
      cluster_id: null,
      item_category: 'Consolidación de Rodamientos de Alta Carga',
      companies_involved_json: ['Argos', 'Yara'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'detected',
      savings_segment: 'Mantenimiento crítico',
    },
    {
      cluster_id: null,
      item_category: 'Pool de Energía y Vapor',
      companies_involved_json: ['Dow', 'Esenttia'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'detected',
      savings_segment: 'Logística & Químicos',
    },
    {
      cluster_id: null,
      item_category: 'Compra Atlas de Lubricantes Sintéticos',
      companies_involved_json: ['Cabot', 'Ajover'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'detected',
      savings_segment: 'Servicios industriales',
    },
    {
      cluster_id: null,
      item_category: 'Cadena Fría Compartida — Cadena del Frío',
      companies_involved_json: ['Yara', 'Esenttia'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'active',
      savings_segment: 'Logística & Químicos',
    },
    {
      cluster_id: null,
      item_category: 'Gestión Integral de EPP y Dieléctricos',
      companies_involved_json: ['Reficar', 'Dow'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'detected',
      savings_segment: 'EPP & Seguridad industrial',
    },
    {
      cluster_id: null,
      item_category: 'Recuperación de Catalizadores y Metales',
      companies_involved_json: ['Argos', 'Cabot'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'detected',
      savings_segment: 'Economía circular',
    },
    {
      cluster_id: null,
      item_category: 'Calibración y Metrología 4.0',
      companies_involved_json: ['Ajover', 'Yara'],
      volume_total_json: { amount: USD_PER_ROW, uom: 'USD', estimated_savings_pct: pct },
      status: 'detected',
      savings_segment: 'Servicios industriales',
    },
  ];

  const demoIds = [
    'b1111111-1111-4111-a111-111111111101',
    'b1111111-1111-4111-a111-111111111102',
    'b1111111-1111-4111-a111-111111111103',
    'b1111111-1111-4111-a111-111111111104',
    'b1111111-1111-4111-a111-111111111105',
    'b1111111-1111-4111-a111-111111111106',
    'b1111111-1111-4111-a111-111111111107',
    'b1111111-1111-4111-a111-111111111108',
    'b1111111-1111-4111-a111-111111111109',
    'b1111111-1111-4111-a111-11111111110a',
    'b1111111-1111-4111-a111-11111111110b',
    'b1111111-1111-4111-a111-11111111110c',
  ];

  return rows.map((r, i) => ({
    ...r,
    synergy_id: demoIds[i]!,
    window_start: iso(now - (14 - i) * 86400000),
    window_end: iso(now + (40 + i * 3) * 86400000),
    created_at: iso(now),
    updated_at: iso(now),
  }));
}

const DONUT_SEGMENT_COLORS: Record<string, string> = {
  'EPP & Seguridad industrial': '#10b981',
  'Logística & Químicos': '#34d399',
  'Mantenimiento crítico': '#6ee7b7',
  'Economía circular': '#059669',
  'Servicios industriales': '#9aff8d',
};

/** Datos para Pie/Donut en Análisis Estratégico (ponderado por ahorro USD estimado). */
export function getCartagenaDemoDonutData(): { name: string; value: number; color: string }[] {
  const rows = getCartagenaDemoSynergyRows();
  const bySeg = new Map<string, number>();
  for (const r of rows) {
    const amt = r.volume_total_json.amount;
    const pct = r.volume_total_json.estimated_savings_pct;
    const savingsUsd = amt * (pct / 100);
    const seg = r.savings_segment;
    bySeg.set(seg, (bySeg.get(seg) || 0) + savingsUsd);
  }
  const totalSav = [...bySeg.values()].reduce((a, b) => a + b, 0);
  if (totalSav <= 0) return [];
  return [...bySeg.entries()].map(([name, v]) => ({
    name,
    value: Math.round((v / totalSav) * 1000) / 10,
    color: DONUT_SEGMENT_COLORS[name] ?? '#10b981',
  }));
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

/** Métricas del dashboard para demo Cartagena (12 sinergias). */
export function getCartagenaDemoSynergyDashboardStats(): {
  total: number;
  activeInPipeline: number;
  avgSavingsPct: number;
} {
  return aggregateSynergyDashboardMetrics(getCartagenaDemoSynergyRows());
}

/** RFP ficticio — Gestión de Decisiones / workbench con bypass activo. */
export const CARTAGENA_DEMO_RFP_ID = 'rfp-cartagena-001';

export interface CartagenaDemoRfp {
  rfp_id: string;
  title: string;
  description: string;
  synergy_id: string | null;
  status: string;
  published_at: string;
  closing_at: string;
}

/** Lista con un único RFP de prueba para el selector del workbench. */
export function getCartagenaDemoRFPs(): CartagenaDemoRfp[] {
  const now = Date.now();
  return [
    {
      rfp_id: CARTAGENA_DEMO_RFP_ID,
      title: 'Suministro Global de EPP - Cluster Mamonal 2026',
      description: 'RFP conjunta para Reficar, Yara y Argos.',
      synergy_id: null,
      status: 'OPEN',
      published_at: new Date(now - 7 * 86400000).toISOString(),
      closing_at: new Date(now + 83 * 86400000).toISOString(),
    },
  ];
}

export function isCartagenaDemoRfpId(rfpId: string | null | undefined): boolean {
  return (rfpId ?? '').trim() === CARTAGENA_DEMO_RFP_ID;
}

/** Ofertas comparativas precalculadas (ahorro y cumplimiento). */
export interface CartagenaDemoComparativeOffer {
  offer_id: string;
  rfp_id: string;
  supplier_label: string;
  supplier_id: string | null;
  price_total: number;
  currency: string;
  lead_time_days: number;
  submitted_at: string;
  savings_score_pct: number;
  compliance_score_pct: number;
}

export function getCartagenaDemoComparativeOffers(): CartagenaDemoComparativeOffer[] {
  const submitted = new Date().toISOString();
  return [
    {
      offer_id: 'demo-offer-cartagena-local-a',
      rfp_id: CARTAGENA_DEMO_RFP_ID,
      supplier_label: 'Proveedor Local A',
      supplier_id: null,
      price_total: 428_000_000,
      currency: 'COP',
      lead_time_days: 21,
      submitted_at: submitted,
      savings_score_pct: 16.4,
      compliance_score_pct: 88,
    },
    {
      offer_id: 'demo-offer-cartagena-nacional-b',
      rfp_id: CARTAGENA_DEMO_RFP_ID,
      supplier_label: 'Proveedor Nacional B',
      supplier_id: null,
      price_total: 401_500_000,
      currency: 'COP',
      lead_time_days: 35,
      submitted_at: submitted,
      savings_score_pct: 21.8,
      compliance_score_pct: 92,
    },
    {
      offer_id: 'demo-offer-cartagena-consorcio-c',
      rfp_id: CARTAGENA_DEMO_RFP_ID,
      supplier_label: 'Consorcio Internacional C',
      supplier_id: null,
      price_total: 389_000_000,
      currency: 'COP',
      lead_time_days: 45,
      submitted_at: submitted,
      savings_score_pct: 24.2,
      compliance_score_pct: 95,
    },
  ];
}

/** Misma forma que las ofertas del workbench, con etiqueta y puntajes para la tabla comparativa. */
export function getCartagenaDemoWorkbenchOffers(): CartagenaDemoComparativeOffer[] {
  return getCartagenaDemoComparativeOffers();
}

