import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

/**
 * PATCH /api/data/ingestion-jobs
 * Permite marcar un job como 'completed' manualmente (force-close).
 * Body: { job_id: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { job_id } = body;

    if (!job_id) {
      return createErrorResponse('job_id es requerido', 400);
    }

    const { data: current, error: fetchErr } = await supabaseServer
      .from('ingestion_jobs')
      .select('job_id, status')
      .eq('job_id', job_id)
      .maybeSingle();

    if (fetchErr || !current) {
      return createErrorResponse('Job no encontrado', 404);
    }

    if (current.status === 'completed') {
      return createSuccessResponse({ message: 'Job ya estaba completado', job_id });
    }

    const { error: updateErr } = await supabaseServer
      .from('ingestion_jobs')
      .update({ status: 'completed' })
      .eq('job_id', job_id);

    if (updateErr) {
      console.error('[PATCH ingestion-jobs] Error al actualizar:', updateErr);
      return createErrorResponse('Error al actualizar el job', 500);
    }

    return createSuccessResponse({ message: 'Job marcado como completado', job_id });
  } catch (error) {
    console.error('[PATCH ingestion-jobs] Error inesperado:', error);
    return createErrorResponse('Error interno', 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('job_id');

    let query = supabaseServer
      .from('ingestion_jobs')
      .select('job_id,status');

    // Si viene job_id, devolver 1 registro
    if (jobId) {
      const { data, error } = await query.eq('job_id', jobId).maybeSingle();

      if (error) {
        console.error('Error fetching ingestion job:', error);
        return createErrorResponse('Failed to fetch ingestion job', 500);
      }

      return createSuccessResponse(data || null);
    }

    // Si no viene job_id, devolver últimos 50 por job_id desc
    const { data, error } = await query
      .order('job_id', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching ingestion jobs:', error);
      return createErrorResponse('Failed to fetch ingestion jobs', 500);
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/ingestion-jobs:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
