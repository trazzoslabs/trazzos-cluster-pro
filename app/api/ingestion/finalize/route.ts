import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import {
  getIngestionJobByJobId,
  resolveIngestionJobForN8nPayload,
} from '@/lib/services/ingestion-jobs';

const TERMINAL_COMPLETED = new Set(['completed', 'success', 'done']);
const TERMINAL_FAILED = new Set(['failed', 'error', 'failure']);

const FINALIZE_JOB_NOT_FOUND_MSG =
  'Job no encontrado, es posible que haya sido eliminado o procesado previamente';

/** Claves jsonb opcionales en el cuerpo del webhook; `null` → `{}` para Postgres/PostgREST. */
const INGESTION_JOB_FINALIZE_JSONB_KEYS = [
  'metadata',
  'result_json',
  'error_json',
  'details_json',
] as const;

function normalizeFinalizeStatus(raw: unknown): 'completed' | 'failed' | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().toLowerCase();
  if (TERMINAL_COMPLETED.has(s) || s === 'ok') return 'completed';
  if (TERMINAL_FAILED.has(s)) return 'failed';
  return null;
}

function extractN8nIngestionIds(body: Record<string, unknown>): {
  jobId?: string;
  uploadId?: string;
  correlationId?: string;
} {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    jobId: s(body.job_id) || s(body.jobId) || undefined,
    uploadId: s(body.upload_id) || s(body.uploadId) || undefined,
    correlationId: s(body.correlation_id) || s(body.correlationId) || undefined,
  };
}

/**
 * `null` / `undefined` en columnas jsonb → objeto vacío (evita valores inválidos o sorpresas en jsonb).
 * Otros valores se envían tal cual (objetos, arrays, escalares JSON).
 */
function jsonbOrEmptyObject(value: unknown): unknown {
  if (value === null || value === undefined) return {};
  return value;
}

function buildIngestionJobFinalizePatch(
  finalStatus: 'completed' | 'failed',
  body: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { status: finalStatus };
  for (const key of INGESTION_JOB_FINALIZE_JSONB_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    patch[key] = jsonbOrEmptyObject(body[key]);
  }
  return patch;
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

async function tryUpdateUploadForFinalize(
  uploadId: string,
  finalStatus: 'completed' | 'failed',
): Promise<void> {
  try {
    if (finalStatus === 'completed') {
      const { error } = await supabaseServer
        .from('uploads')
        .update({ status: 'completed' })
        .eq('upload_id', uploadId)
        .in('status', ['processing', 'pending', 'running', 'uploading']);
      if (error) {
        console.error('[finalize] Error actualizando uploads (completed):', error.message, error);
      }
    } else {
      const { error } = await supabaseServer
        .from('uploads')
        .update({ status: 'failed' })
        .eq('upload_id', uploadId);
      if (error) {
        console.error('[finalize] Error actualizando uploads (failed):', error.message, error);
      }
    }
  } catch (e) {
    console.error('[finalize] Excepción al actualizar uploads:', e);
  }
}

async function updateIngestionJobStatusOrThrow(
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseServer.from('ingestion_jobs').update(patch).eq('job_id', jobId);
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * POST /api/ingestion/finalize
 *
 * Webhook que n8n llama con `status` (completed | failed, o sinónimos) y al menos uno de:
 * `job_id`, `upload_id` o `correlation_id`. Resolución del job en cascada en ese orden.
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

  const ids = extractN8nIngestionIds(body);

  const statusRaw = body.status ?? body.job_status;

  console.log(
    '[finalize] ← job_id=%s upload_id=%s correlation_id=%s status=%s keys=%s',
    ids.jobId ?? '',
    ids.uploadId ?? '',
    ids.correlationId ?? '',
    statusRaw,
    Object.keys(body).join(',')
  );

  if (!ids.jobId && !ids.uploadId && !ids.correlationId) {
    return createErrorResponse(
      'Se requiere al menos uno de: job_id, upload_id o correlation_id',
      400,
    );
  }

  const finalStatus = normalizeFinalizeStatus(statusRaw);
  if (!finalStatus) {
    return createErrorResponse(
      'Se requiere status válido (completed o failed, o sinónimos: success, done, error, failure)',
      400
    );
  }

  const trimmedJobId = ids.jobId?.trim();
  const job = trimmedJobId
    ? await getIngestionJobByJobId(trimmedJobId)
    : await resolveIngestionJobForN8nPayload(ids);

  if (!job) {
    console.warn('[finalize] Job no encontrado tras cascada job_id→upload_id→correlation_id:', ids);
    return createErrorResponse(FINALIZE_JOB_NOT_FOUND_MSG, 404);
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

  const uploadId = job.upload_id ? String(job.upload_id).trim() : '';
  if (uploadId) {
    await tryUpdateUploadForFinalize(uploadId, finalStatus);
  }

  const jobPatch = buildIngestionJobFinalizePatch(finalStatus, body);

  try {
    await updateIngestionJobStatusOrThrow(job.job_id, jobPatch);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[finalize] Error actualizando ingestion_jobs:', msg, e);
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
