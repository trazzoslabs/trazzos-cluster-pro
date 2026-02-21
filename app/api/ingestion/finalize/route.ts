import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';

/**
 * POST /api/ingestion/finalize
 *
 * Webhook que n8n llama (desde V2-06-DB-Update-Job) al terminar el pipeline.
 * Usa job_id como identificador único para localizar el job.
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
  const jobId: string | undefined =
    body.job_id ?? body.jobId ?? undefined;

  console.log('[finalize] ← job_id=%s keys=%s', jobId, Object.keys(body).join(','));

  if (!jobId) {
    return Response.json({ ok: false, error: 'Se requiere job_id' }, { status: 400 });
  }

  const { data: job } = await supabaseServer
    .from('ingestion_jobs')
    .select('job_id, status')
    .eq('job_id', jobId)
    .maybeSingle();

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

  // Mantener el cierre robusto: solo status.
  // No tocar columnas opcionales para evitar fallos por esquemas distintos.
  const patch: Record<string, any> = {
    status: finalStatus,
  };

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
