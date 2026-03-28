/**
 * Servicio de jobs de ingesta (tabla ingestion_jobs, docs01_DB_SCHEMA.md).
 */

import { supabaseServer } from '@/app/api/_lib/supabaseServer';

export interface IngestionJobRow {
  job_id: string;
  upload_id?: string | null;
  pipeline_version?: string | null;
  mapping_profile_id?: string | null;
  status?: string | null;
  rows_total?: number | null;
  rows_ok?: number | null;
  rows_error?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  correlation_id?: string | null;
}

export async function getIngestionJobs(jobId?: string | null): Promise<IngestionJobRow | IngestionJobRow[] | null> {
  let query = supabaseServer.from('ingestion_jobs').select('job_id, status, upload_id, pipeline_version, mapping_profile_id, rows_total, rows_ok, rows_error, started_at, ended_at, correlation_id');

  if (jobId) {
    const { data, error } = await query.eq('job_id', jobId).maybeSingle();
    if (error) throw new Error('Failed to fetch ingestion job');
    return data as IngestionJobRow | null;
  }

  const { data, error } = await query.order('job_id', { ascending: false }).limit(50);
  if (error) throw new Error('Failed to fetch ingestion jobs');
  return (data ?? []) as IngestionJobRow[];
}

const INGESTION_JOB_SELECT_COLS =
  'job_id, status, upload_id, pipeline_version, mapping_profile_id, rows_total, rows_ok, rows_error, started_at, ended_at, correlation_id';

type IngestionJobSingleColumn = 'job_id' | 'upload_id' | 'correlation_id' | 'mapping_profile_id';

/**
 * Una sola consulta a `ingestion_jobs` por columna concreta.
 */
async function queryIngestionJobBySingleColumn(
  column: IngestionJobSingleColumn,
  value: string,
): Promise<IngestionJobRow | null> {
  const { data, error } = await supabaseServer
    .from('ingestion_jobs')
    .select(INGESTION_JOB_SELECT_COLS)
    .eq(column, value)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[ingestion-jobs] lookup ${column}=… falló:`, error.message);
    return null;
  }
  return (data as IngestionJobRow) ?? null;
}

/**
 * Resolución secuencial y no excluyente: cada paso solo se ejecuta si el anterior no devolvió fila.
 * 1) job_id — 2) upload_id — 3) correlation_id (n8n a veces registra ahí el mismo UUID que sería upload_id) — 4) mapping_profile_id (V2-03).
 */
async function findIngestionJobByColumn(value: string): Promise<IngestionJobRow | null> {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const byJobId = await queryIngestionJobBySingleColumn('job_id', trimmed);
  if (byJobId) return byJobId;

  const byUploadId = await queryIngestionJobBySingleColumn('upload_id', trimmed);
  if (byUploadId) return byUploadId;

  const byCorrelationId = await queryIngestionJobBySingleColumn('correlation_id', trimmed);
  if (byCorrelationId) return byCorrelationId;

  const byMappingProfileId = await queryIngestionJobBySingleColumn('mapping_profile_id', trimmed);
  if (byMappingProfileId) return byMappingProfileId;

  return null;
}

/**
 * Resuelve un job para `/ingestion/mapping/[id]` y enlaces n8n (incl. upload_id duplicado en `correlation_id`).
 */
export async function getIngestionJobByJobIdOrUploadId(id: string): Promise<IngestionJobRow | null> {
  return findIngestionJobByColumn(id);
}

export async function updateIngestionJobStatus(jobId: string, status: 'completed'): Promise<void> {
  const { error } = await supabaseServer
    .from('ingestion_jobs')
    .update({ status })
    .eq('job_id', jobId);

  if (error) throw new Error('Error al actualizar el job');
}
