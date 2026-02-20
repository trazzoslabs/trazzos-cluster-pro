import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

/**
 * POST /api/ingestion/finalize
 *
 * Endpoint que n8n llama al terminar un pipeline de ingesta.
 * Acepta cualquiera de estos identificadores (o ambos):
 *   - job_id          (UUID directo del ingestion_job)
 *   - correlation_id  (UUID de correlación asignado al iniciar la sesión)
 *
 * Si n8n envía un nombre distinto (p.ej. "jobId" o "correlationId"),
 * este endpoint los normaliza antes de buscar.
 *
 * Campos opcionales de resultado:
 *   rows_total, rows_ok, rows_error, status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Normalizar nombres de campos (n8n puede enviar camelCase o snake_case)
    const jobId: string | undefined =
      body.job_id ?? body.jobId ?? undefined;
    const correlationId: string | undefined =
      body.correlation_id ?? body.correlationId ?? undefined;

    console.log('[finalize] Recibido:', { jobId, correlationId, keys: Object.keys(body) });

    if (!jobId && !correlationId) {
      return createErrorResponse(
        'Se requiere job_id o correlation_id para finalizar el job',
        400
      );
    }

    // Buscar el job por job_id primero, luego por correlation_id
    let job: any = null;

    if (jobId) {
      const { data, error } = await supabaseServer
        .from('ingestion_jobs')
        .select('job_id, status, correlation_id')
        .eq('job_id', jobId)
        .maybeSingle();

      if (error) {
        console.warn('[finalize] Error buscando por job_id:', error.message);
      } else {
        job = data;
      }
    }

    if (!job && correlationId) {
      const { data, error } = await supabaseServer
        .from('ingestion_jobs')
        .select('job_id, status, correlation_id')
        .eq('correlation_id', correlationId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[finalize] Error buscando por correlation_id:', error.message);
      } else {
        job = data;
      }
    }

    if (!job) {
      console.warn('[finalize] Job no encontrado con job_id=%s correlation_id=%s', jobId, correlationId);
      return createErrorResponse(
        `Job no encontrado (job_id=${jobId || '?'}, correlation_id=${correlationId || '?'})`,
        404
      );
    }

    if (job.status === 'completed' || job.status === 'success') {
      console.log('[finalize] Job ya finalizado:', job.job_id);
      return createSuccessResponse({
        message: 'Job ya estaba finalizado',
        job_id: job.job_id,
        status: job.status,
      });
    }

    // Determinar status final
    const finalStatus = body.status === 'error' || body.status === 'failed'
      ? body.status
      : 'completed';

    const updatePayload: Record<string, any> = {
      status: finalStatus,
      ended_at: new Date().toISOString(),
    };

    if (body.rows_total !== undefined) updatePayload.rows_total = Number(body.rows_total);
    if (body.rows_ok !== undefined) updatePayload.rows_ok = Number(body.rows_ok);
    if (body.rows_error !== undefined) updatePayload.rows_error = Number(body.rows_error);

    // Si n8n envió correlation_id pero el job no lo tenía, guardarlo
    if (correlationId && !job.correlation_id) {
      updatePayload.correlation_id = correlationId;
    }

    const { error: updateErr } = await supabaseServer
      .from('ingestion_jobs')
      .update(updatePayload)
      .eq('job_id', job.job_id);

    if (updateErr) {
      console.error('[finalize] Error actualizando job:', updateErr);
      return createErrorResponse('Error al actualizar el job', 500);
    }

    console.log('[finalize] Job %s → %s', job.job_id, finalStatus);

    return createSuccessResponse({
      message: `Job finalizado como ${finalStatus}`,
      job_id: job.job_id,
      correlation_id: job.correlation_id || correlationId,
      status: finalStatus,
    });
  } catch (error) {
    console.error('[finalize] Error inesperado:', error);
    return createErrorResponse('Error interno en finalize', 500);
  }
}
