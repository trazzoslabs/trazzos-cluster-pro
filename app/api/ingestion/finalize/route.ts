import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';

/**
 * POST /api/ingestion/finalize
 *
 * Webhook que n8n llama (desde V2-06-DB-Update-Job) al terminar el pipeline.
 * Prioriza correlation_id para localizar el job (es lo que n8n genera en V2-01).
 * Responde 200 lo más rápido posible para que n8n cierre el hilo.
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Normalizar nombres (n8n puede enviar camelCase o snake_case)
  const correlationId: string | undefined =
    body.correlation_id ?? body.correlationId ?? undefined;
  const jobId: string | undefined =
    body.job_id ?? body.jobId ?? undefined;

  console.log('[finalize] ← correlation_id=%s job_id=%s keys=%s', correlationId, jobId, Object.keys(body).join(','));

  if (!correlationId && !jobId) {
    return Response.json({ ok: false, error: 'Se requiere correlation_id o job_id' }, { status: 400 });
  }

  // Buscar job: correlation_id primero (fuente de verdad de n8n), job_id como fallback
  let job: any = null;

  if (correlationId) {
    const { data } = await supabaseServer
      .from('ingestion_jobs')
      .select('job_id, status, correlation_id')
      .eq('correlation_id', correlationId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    job = data;
  }

  if (!job && jobId) {
    const { data } = await supabaseServer
      .from('ingestion_jobs')
      .select('job_id, status, correlation_id')
      .eq('job_id', jobId)
      .maybeSingle();
    job = data;
  }

  if (!job) {
    console.warn('[finalize] Job no encontrado');
    return Response.json({ ok: false, error: 'Job not found' }, { status: 404 });
  }

  // Ya finalizado — responder 200 inmediato
  if (job.status === 'completed' || job.status === 'success' || job.status === 'done') {
    console.log('[finalize] Job %s ya estaba en %s (%dms)', job.job_id, job.status, Date.now() - t0);
    return Response.json({ ok: true, job_id: job.job_id, status: job.status });
  }

  // Determinar status final
  const finalStatus = (body.status === 'error' || body.status === 'failed') ? body.status : 'completed';

  const patch: Record<string, any> = {
    status: finalStatus,
    ended_at: new Date().toISOString(),
  };
  if (body.rows_total !== undefined) patch.rows_total = Number(body.rows_total);
  if (body.rows_ok !== undefined) patch.rows_ok = Number(body.rows_ok);
  if (body.rows_error !== undefined) patch.rows_error = Number(body.rows_error);
  if (correlationId && !job.correlation_id) patch.correlation_id = correlationId;

  const { error: updateErr } = await supabaseServer
    .from('ingestion_jobs')
    .update(patch)
    .eq('job_id', job.job_id);

  if (updateErr) {
    console.error('[finalize] Error actualizando:', updateErr.message);
    return Response.json({ ok: false, error: 'DB update failed' }, { status: 500 });
  }

  console.log('[finalize] Job %s → %s (%dms)', job.job_id, finalStatus, Date.now() - t0);

  // 200 rápido para que n8n cierre el hilo
  return Response.json({ ok: true, job_id: job.job_id, status: finalStatus });
}
