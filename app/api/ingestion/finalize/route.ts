import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

const TERMINAL_COMPLETED = new Set(['completed', 'success', 'done']);
const TERMINAL_FAILED = new Set(['failed', 'error', 'failure']);

function normalizeFinalizeStatus(raw: unknown): 'completed' | 'failed' | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().toLowerCase();
  if (TERMINAL_COMPLETED.has(s) || s === 'ok') return 'completed';
  if (TERMINAL_FAILED.has(s)) return 'failed';
  return null;
}

/**
 * Ejecuta refresh_cluster_marts sin bloquear la respuesta HTTP (misma RPC que refresh-marts).
 * Actualiza vistas materializadas para que /api/data/companies-geo refleje el cluster.
 */
function scheduleRefreshClusterMarts(): void {
  void (async () => {
    const { error } = await supabaseServer.rpc('refresh_cluster_marts');
    if (error) {
      console.error('[finalize] refresh_cluster_marts:', error.message, error);
    }
  })();
}

/**
 * POST /api/ingestion/finalize
 *
 * Webhook que n8n llama con `job_id` y `status` (completed | failed, o sinónimos).
 *
 * **BroadcastChannel('trazzos_marts')** solo existe en el navegador: este handler corre en Node
 * y no puede emitir `marts_refresh_completed` a otras pestañas. Tras `completed` se ejecuta
 * `refresh_cluster_marts` para que los datos estén listos; la página Inteligencia escucha el
 * mismo evento cuando otro cliente lo publica (p. ej. Ingesta → “Refrescar vistas” vía
 * `publishMartsRefreshCompleted` en lib/trazzosMartsBroadcast.ts) y actualiza el mapa sin
 * recargar toda la página.
 *
 * Responde 200 en cuanto el update confirma, para no bloquear n8n.
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid JSON', 400);
  }

  const jobId =
    (typeof body.job_id === 'string' && body.job_id) ||
    (typeof body.jobId === 'string' && body.jobId) ||
    undefined;

  const statusRaw = body.status ?? body.job_status;

  console.log(
    '[finalize] ← job_id=%s status=%s keys=%s',
    jobId,
    statusRaw,
    Object.keys(body).join(',')
  );

  if (!jobId?.trim()) {
    return createErrorResponse('Se requiere job_id', 400);
  }

  const finalStatus = normalizeFinalizeStatus(statusRaw);
  if (!finalStatus) {
    return createErrorResponse(
      'Se requiere status válido (completed o failed, o sinónimos: success, done, error, failure)',
      400
    );
  }

  const { data: job, error: selectErr } = await supabaseServer
    .from('ingestion_jobs')
    .select('job_id, status')
    .eq('job_id', jobId.trim())
    .maybeSingle();

  if (selectErr) {
    console.error('[finalize] Error leyendo job:', selectErr.message);
    return createErrorResponse('Error al consultar el job', 500);
  }

  if (!job) {
    console.warn('[finalize] Job no encontrado:', jobId);
    return createErrorResponse('Job not found', 404);
  }

  const current = job.status?.toLowerCase() ?? '';
  if (TERMINAL_COMPLETED.has(current) || TERMINAL_FAILED.has(current)) {
    console.log(
      '[finalize] Job %s ya terminal (%s) (%dms)',
      job.job_id,
      job.status,
      Date.now() - t0
    );
    return createSuccessResponse({
      job_id: job.job_id,
      status: job.status,
      skipped: true,
    });
  }

  const { error: updateErr } = await supabaseServer
    .from('ingestion_jobs')
    .update({ status: finalStatus })
    .eq('job_id', job.job_id);

  if (updateErr) {
    console.error('[finalize] Error actualizando:', updateErr.message);
    return createErrorResponse('DB update failed', 500);
  }

  if (finalStatus === 'completed') {
    scheduleRefreshClusterMarts();
  }

  console.log('[finalize] Job %s → %s (%dms)', job.job_id, finalStatus, Date.now() - t0);

  return createSuccessResponse({
    job_id: job.job_id,
    status: finalStatus,
    marts_refresh_scheduled: finalStatus === 'completed',
  });
}
