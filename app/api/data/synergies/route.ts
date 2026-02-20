import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

/**
 * Mapea un registro de operational_data (esquema n8n) al formato de synergies.
 * n8n envía: companies_involved, volume_total
 * Supabase espera: companies_involved_json, volume_total_json
 */
function mapOperationalRow(row: any): any {
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clusterId = searchParams.get('cluster_id');
    const companyId = searchParams.get('company_id');
    const debug = searchParams.get('debug') === '1';

    let rows: any[] = [];
    let source = '';
    let usedFallback = false;

    // ── Fuente 1: operational_data (tabla donde n8n escribe el JSON) ──
    const { data: opData, error: opErr } = await supabaseServer
      .from('operational_data')
      .select('*')
      .order('created_at', { ascending: false });

    if (opErr) {
      console.warn('[synergies] operational_data no disponible:', opErr.message);
    } else if (opData && opData.length > 0) {
      rows = opData.map(mapOperationalRow);
      source = 'operational_data';
      console.log('[synergies] Datos desde operational_data:', rows.length);
    }

    // ── Fuente 2: tabla synergies (esquema canónico) ──
    if (rows.length === 0) {
      let query = supabaseServer.from('synergies').select('*');
      if (clusterId) query = query.eq('cluster_id', clusterId);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('[synergies] Error en tabla synergies:', error.message);
      } else if (data && data.length > 0) {
        rows = data;
        source = 'synergies';
        console.log('[synergies] Datos desde tabla synergies:', rows.length);
      }
    }

    // Si se filtró por cluster_id y devolvió vacío, reintentar sin filtro
    if (rows.length === 0 && clusterId) {
      const { data } = await supabaseServer
        .from('synergies')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        rows = data;
        source = 'synergies';
        usedFallback = true;
        console.log('[synergies] Fallback sin filtro cluster_id:', rows.length);
      }
    }

    // Filtrar por company_id dentro de companies_involved_json si se proveyó
    if (companyId && rows.length > 0) {
      const filtered = rows.filter((s: any) => {
        const involved = s.companies_involved_json ?? s.companies_involved;
        if (!involved) return true; // Mostrar siempre si no hay dato
        const str = typeof involved === 'string' ? involved : JSON.stringify(involved);
        return str.includes(companyId);
      });
      if (filtered.length > 0) {
        rows = filtered;
      }
      // Si el filtro no devuelve nada, mantener todos (no vaciar la vista)
    }

    console.log('[synergies] Total rows:', rows.length, '| source:', source || 'ninguna', usedFallback ? '(fallback)' : '');

    // Diagnóstico
    if (debug || rows.length === 0) {
      const diagQueries = await Promise.all([
        supabaseServer.from('operational_data').select('*', { count: 'exact', head: true }).then(r => ({ table: 'operational_data', count: r.count ?? 0, error: r.error?.message || null })),
        supabaseServer.from('synergies').select('*', { count: 'exact', head: true }).then(r => ({ table: 'synergies', count: r.count ?? 0, error: r.error?.message || null })),
        supabaseServer.from('needs').select('*', { count: 'exact', head: true }).then(r => ({ table: 'needs', count: r.count ?? 0, error: r.error?.message || null })),
        supabaseServer.from('shutdowns').select('*', { count: 'exact', head: true }).then(r => ({ table: 'shutdowns', count: r.count ?? 0, error: r.error?.message || null })),
        supabaseServer.from('companies').select('*', { count: 'exact', head: true }).then(r => ({ table: 'companies', count: r.count ?? 0, error: r.error?.message || null })),
      ]);

      const diag: Record<string, any> = { source, used_fallback: usedFallback, total_returned: rows.length };
      for (const q of diagQueries) {
        diag[`${q.table}_count`] = q.count;
        if (q.error) diag[`${q.table}_error`] = q.error;
      }
      console.log('[synergies] Diagnóstico:', diag);

      return Response.json({ data: rows, _debug: diag }, { status: 200 });
    }

    return createSuccessResponse(rows);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/synergies:', error);
    return createErrorResponse('Internal server error', 500);
  }
}


