import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

/**
 * POST /api/workflows/refresh-marts
 * Ejecuta refresh_cluster_marts() para actualizar las vistas materializadas
 * después de una ingesta exitosa.
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

    return createSuccessResponse({
      message: 'Vistas materializadas actualizadas correctamente',
      result: data,
    });
  } catch (error) {
    console.error('[refresh-marts] Error inesperado:', error);
    return createErrorResponse('Error interno al refrescar vistas', 500);
  }
}
