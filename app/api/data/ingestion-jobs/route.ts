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
      .update({ status: 'completed', ended_at: new Date().toISOString() })
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
    const correlationId = searchParams.get('correlation_id');

    let query = supabaseServer
      .from('ingestion_jobs')
      .select('job_id, upload_id, pipeline_version, mapping_profile_id, status, rows_total, rows_ok, rows_error, started_at, ended_at, correlation_id');

    // Si viene job_id, devolver 1 registro
    if (jobId) {
      const { data, error } = await query.eq('job_id', jobId).maybeSingle();

      if (error) {
        console.error('Error fetching ingestion job:', error);
        return createErrorResponse('Failed to fetch ingestion job', 500);
      }

      // If we have upload_id, fetch dataset_type separately
      let datasetType = null;
      if (data?.upload_id) {
        const { data: upload } = await supabaseServer
          .from('uploads')
          .select('declared_dataset_type')
          .eq('upload_id', data.upload_id)
          .maybeSingle();
        
        if (upload) {
          datasetType = upload.declared_dataset_type;
        }
      }

      return createSuccessResponse({
        ...data,
        dataset_type: datasetType,
      });
    }

    // Si viene correlation_id, devolver lista de jobs
    if (correlationId) {
      const { data, error } = await query
        .eq('correlation_id', correlationId)
        .order('started_at', { ascending: false, nullsFirst: false })
        .order('job_id', { ascending: false });

      if (error) {
        console.error('Error fetching ingestion jobs:', error);
        return createErrorResponse('Failed to fetch ingestion jobs', 500);
      }

      return createSuccessResponse(data || []);
    }

    // Si no viene ninguno, devolver últimos 50 ordenados por started_at desc nulls last, luego job_id desc
    const { data, error } = await query
      .order('started_at', { ascending: false, nullsFirst: false })
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
