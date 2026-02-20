import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clusterId = searchParams.get('cluster_id');
    const companyId = searchParams.get('company_id');
    const debug = searchParams.get('debug') === '1';

    let rows: any[] = [];
    let usedFallback = false;

    // ── Intento 1: filtrar si se proveyó cluster_id o company_id ──
    if (clusterId) {
      const { data, error } = await supabaseServer
        .from('synergies')
        .select('*')
        .eq('cluster_id', clusterId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[synergies] Error con cluster_id filter:', error.message);
      } else {
        rows = data || [];
      }
    }

    if (rows.length === 0 && companyId) {
      // synergies no tiene columna company_id; buscar dentro de companies_involved_json
      const { data, error } = await supabaseServer
        .from('synergies')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        rows = data.filter((s: any) => {
          const involved = s.companies_involved_json;
          if (!involved) return false;
          const str = typeof involved === 'string' ? involved : JSON.stringify(involved);
          return str.includes(companyId);
        });
        console.log('[synergies] Filtro company_id en JSON:', rows.length, 'de', data.length);
      }
    }

    // ── Intento 2 (fallback): traer TODO si los filtros devolvieron vacío ──
    if (rows.length === 0) {
      const { data, error } = await supabaseServer
        .from('synergies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[synergies] Error fetching all:', error);
        return createErrorResponse('Failed to fetch synergies', 500);
      }

      rows = data || [];
      if (clusterId || companyId) {
        usedFallback = true;
        console.log('[synergies] Filtro vacío → fallback sin filtros:', rows.length, 'filas');
      }
    }

    console.log('[synergies] Rows returned:', rows.length, usedFallback ? '(fallback)' : '');

    // Diagnóstico de tablas fuente
    if (debug || rows.length === 0) {
      const [needsRes, shutdownsRes, companiesRes] = await Promise.all([
        supabaseServer.from('needs').select('*', { count: 'exact', head: true }),
        supabaseServer.from('shutdowns').select('*', { count: 'exact', head: true }),
        supabaseServer.from('companies').select('*', { count: 'exact', head: true }),
      ]);

      const diag = {
        synergies_count: rows.length,
        needs_count: needsRes.count ?? 0,
        shutdowns_count: shutdownsRes.count ?? 0,
        companies_count: companiesRes.count ?? 0,
        needs_error: needsRes.error?.message || null,
        shutdowns_error: shutdownsRes.error?.message || null,
        used_fallback: usedFallback,
      };
      console.log('[synergies] Diagnóstico tablas fuente:', diag);

      return Response.json({ data: rows, _debug: diag }, { status: 200 });
    }

    return createSuccessResponse(rows);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/synergies:', error);
    return createErrorResponse('Internal server error', 500);
  }
}


