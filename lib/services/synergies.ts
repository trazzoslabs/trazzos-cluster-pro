/**
 * Servicio de acceso a datos de sinergias.
 * Prioridad: tabla synergies → operational_data → n8n mock (solo como última instancia).
 */

import { supabaseServer } from '@/app/api/_lib/supabaseServer';
import { getMockSynergiesData, isN8nMockEnabled } from '@/app/api/_lib/n8nMock';
import type { CompaniesInvolvedJson } from '@/lib/types/synergies';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapOperationalRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    synergy_id: row.synergy_id ?? row.id ?? row.record_id ?? `op-${row.created_at ?? Date.now()}`,
    cluster_id: row.cluster_id ?? null,
    item_category: row.item_category ?? row.category ?? row.type ?? 'Operación',
    window_start: row.window_start ?? row.start_date ?? row.created_at ?? new Date().toISOString(),
    window_end: row.window_end ?? row.end_date ?? row.created_at ?? new Date().toISOString(),
    companies_involved_json: row.companies_involved_json ?? row.companies_involved ?? row.companies ?? null,
    volume_total_json: row.volume_total_json ?? row.volume_total ?? row.volume ?? null,
    status: row.status ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    _source: 'operational_data',
  };
}

async function buildCompanyLookup(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await supabaseServer
    .from('companies')
    .select('company_id, name, short_name');

  if (error) {
    console.warn('[synergies service] Cannot build company lookup:', error.message);
    return map;
  }

  for (const c of data ?? []) {
    if (c.company_id && c.name) {
      map.set(c.company_id, c.name);
      if (c.short_name) map.set((c.short_name as string).toLowerCase(), c.name as string);
    }
  }
  return map;
}

function resolveCompanyNames(involved: unknown, lookup: Map<string, string>): string[] {
  if (!involved) return [];

  let entries: unknown[] = [];

  if (typeof involved === 'string') {
    if (UUID_RE.test(involved)) {
      const name = lookup.get(involved);
      return name ? [name] : [];
    }
    try {
      const parsed = JSON.parse(involved);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [involved];
    }
  } else if (Array.isArray(involved)) {
    entries = involved;
  } else {
    entries = [involved];
  }

  const names: string[] = [];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      if (UUID_RE.test(entry)) {
        const resolved = lookup.get(entry) ?? lookup.get(entry.toLowerCase());
        if (resolved) names.push(resolved);
      } else {
        names.push(entry);
      }
    } else if (typeof entry === 'object' && entry !== null) {
      const o = entry as Record<string, unknown>;
      const name = o.name ?? o.company_name ?? o.short_name;
      if (name) {
        names.push(String(name));
        continue;
      }
      const id = o.company_id ?? o.id;
      if (id) {
        const resolved = lookup.get(String(id));
        if (resolved) names.push(resolved);
      }
    }
  }
  return names;
}

export interface GetSynergiesOptions {
  clusterId?: string | null;
  companyId?: string | null;
  debug?: boolean;
}

export interface GetSynergiesResult {
  rows: Array<Record<string, unknown> & { companies_involved_json?: CompaniesInvolvedJson | string[] }>;
  source: string;
  usedFallback: boolean;
  debug?: Record<string, unknown>;
}

export async function getSynergies(options: GetSynergiesOptions = {}): Promise<GetSynergiesResult> {
  const { clusterId, companyId, debug = false } = options;
  const mockMode = isN8nMockEnabled();

  let rows: Array<Record<string, unknown>> = [];
  let source = '';
  let usedFallback = false;

  // Fuente 1: tabla synergies (Supabase)
  let query = supabaseServer.from('synergies').select('*');
  if (clusterId && !mockMode) query = query.eq('cluster_id', clusterId);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.warn('[synergies service] Error en tabla synergies:', error.message);
  } else if (data && data.length > 0) {
    rows = data as Array<Record<string, unknown>>;
    source = 'synergies';
  }

  // Reintentar sin filtro cluster_id si vacío
  if (rows.length === 0 && clusterId && !mockMode) {
    const { data: dataNoFilter } = await supabaseServer
      .from('synergies')
      .select('*')
      .order('created_at', { ascending: false });

    if (dataNoFilter && dataNoFilter.length > 0) {
      rows = dataNoFilter as Array<Record<string, unknown>>;
      source = 'synergies';
      usedFallback = true;
    }
  }

  // Fuente 2: operational_data (fallback controlado)
  if (rows.length === 0) {
    const { data: opData, error: opErr } = await supabaseServer
      .from('operational_data')
      .select('*')
      .order('created_at', { ascending: false });

    if (!opErr && opData && opData.length > 0) {
      rows = opData.map((row) => mapOperationalRow(row as Record<string, unknown>));
      source = 'operational_data';
    }
  }

  // Última instancia: n8n mock solo si todo lo anterior está vacío
  if (rows.length === 0 && mockMode) {
    rows = getMockSynergiesData() as Array<Record<string, unknown>>;
    source = 'mock_static';
    usedFallback = true;
  }

  const companyLookup = await buildCompanyLookup();
  if (companyLookup.size > 0) {
    rows = rows.map((row) => ({
      ...row,
      companies_involved_json: resolveCompanyNames(
        row.companies_involved_json ?? row.companies_involved,
        companyLookup,
      ),
    }));
  }

  if (companyId && rows.length > 0 && !mockMode) {
    const nameForId = companyLookup.get(companyId);
    const filtered = rows.filter((s) => {
      const involved = s.companies_involved_json;
      if (!involved) return true;
      const str = typeof involved === 'string' ? involved : JSON.stringify(involved);
      return str.includes(companyId) || (nameForId && str.includes(nameForId));
    });
    if (filtered.length > 0) rows = filtered;
  }

  let debugInfo: Record<string, unknown> | undefined;
  if (debug || rows.length === 0) {
    const diagQueries = await Promise.all([
      supabaseServer.from('operational_data').select('*', { count: 'exact', head: true }).then((r) => ({ table: 'operational_data', count: r.count ?? 0, error: r.error?.message ?? null })),
      supabaseServer.from('synergies').select('*', { count: 'exact', head: true }).then((r) => ({ table: 'synergies', count: r.count ?? 0, error: r.error?.message ?? null })),
      supabaseServer.from('needs').select('*', { count: 'exact', head: true }).then((r) => ({ table: 'needs', count: r.count ?? 0, error: r.error?.message ?? null })),
      supabaseServer.from('shutdowns').select('*', { count: 'exact', head: true }).then((r) => ({ table: 'shutdowns', count: r.count ?? 0, error: r.error?.message ?? null })),
      supabaseServer.from('companies').select('*', { count: 'exact', head: true }).then((r) => ({ table: 'companies', count: r.count ?? 0, error: r.error?.message ?? null })),
    ]);
    debugInfo = { source, used_fallback: usedFallback, total_returned: rows.length, company_lookup_size: companyLookup.size };
    for (const q of diagQueries) {
      debugInfo[`${(q as { table: string }).table}_count`] = (q as { count: number }).count;
      if ((q as { error: string | null }).error) debugInfo[`${(q as { table: string }).table}_error`] = (q as { error: string }).error;
    }
  }

  return { rows, source, usedFallback, debug: debugInfo };
}
