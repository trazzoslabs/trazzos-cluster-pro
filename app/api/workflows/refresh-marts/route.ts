import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

/**
 * GET /api/workflows/refresh-marts
 * Diagnóstico: devuelve conteos de tablas clave sin modificar nada.
 */
export async function GET() {
  try {
    const [mvRes, sitesRes, companiesRes] = await Promise.all([
      supabaseServer.from('mv_cluster_companies').select('*', { count: 'exact', head: true }),
      supabaseServer.from('company_sites').select('*', { count: 'exact', head: true }),
      supabaseServer.from('companies').select('*', { count: 'exact', head: true }),
    ]);

    return createSuccessResponse({
      mv_cluster_companies: mvRes.count ?? 0,
      company_sites: sitesRes.count ?? 0,
      companies: companiesRes.count ?? 0,
      errors: {
        mv_cluster_companies: mvRes.error?.message || null,
        company_sites: sitesRes.error?.message || null,
        companies: companiesRes.error?.message || null,
      },
    });
  } catch (error) {
    console.error('[refresh-marts GET] Error:', error);
    return createErrorResponse('Error al consultar diagnóstico', 500);
  }
}

/**
 * POST /api/workflows/refresh-marts
 * Ejecuta refresh_cluster_marts() y luego devuelve conteos diagnósticos.
 */
export async function POST(request: NextRequest) {
  try {
    const { data, error } = await supabaseServer.rpc('refresh_cluster_marts');

    if (error) {
      console.error('[refresh-marts] Error ejecutando refresh_cluster_marts:', error);
      return createErrorResponse(
        `Error al refrescar vistas: ${error.message}`,
        500
      );
    }

    // Conteos post-refresh para diagnóstico
    const [mvRes, sitesRes] = await Promise.all([
      supabaseServer.from('mv_cluster_companies').select('*', { count: 'exact', head: true }),
      supabaseServer.from('company_sites').select('*', { count: 'exact', head: true }),
    ]);

    return createSuccessResponse({
      message: 'Vistas materializadas actualizadas correctamente',
      result: data,
      counts: {
        mv_cluster_companies: mvRes.count ?? 0,
        company_sites: sitesRes.count ?? 0,
      },
    });
  } catch (error) {
    console.error('[refresh-marts] Error inesperado:', error);
    return createErrorResponse('Error interno al refrescar vistas', 500);
  }
}
