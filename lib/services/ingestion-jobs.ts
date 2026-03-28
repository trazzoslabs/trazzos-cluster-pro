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

type IngestionJobLookupColumn =
  | 'job_id'
  | 'upload_id'
  | 'mapping_profile_id'
  | 'correlation_id';

const INGESTION_JOB_SELECT_COLS =
  'job_id, status, upload_id, pipeline_version, mapping_profile_id, rows_total, rows_ok, rows_error, started_at, ended_at, correlation_id';

/**
 * Una fila por coincidencia en `ingestion_jobs`. `limit(1)` + `order` evita errores de PostgREST
 * si hubiera duplicados raros en upload_id; prioridad explícita entre consultas.
 */
async function findIngestionJobByColumn(
  column: IngestionJobLookupColumn,
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
 * Resuelve un job para `/ingestion/mapping/[id]` y enlaces n8n V2-03.
 * Orden: job_id → upload_id → mapping_profile_id → correlation_id (extra, por si el workflow envía correlation).
 */
export async function getIngestionJobByJobIdOrUploadId(id: string): Promise<IngestionJobRow | null> {
  const trimmed = id?.trim();
  if (!trimmed) return null;

  const byJob = await findIngestionJobByColumn('job_id', trimmed);
  if (byJob) return byJob;

  const byUpload = await findIngestionJobByColumn('upload_id', trimmed);
  if (byUpload) return byUpload;

  const byMappingProfile = await findIngestionJobByColumn('mapping_profile_id', trimmed);
  if (byMappingProfile) return byMappingProfile;

  const byCorrelation = await findIngestionJobByColumn('correlation_id', trimmed);
  if (byCorrelation) return byCorrelation;

  return null;
}

export async function updateIngestionJobStatus(jobId: string, status: 'completed'): Promise<void> {
  const { error } = await supabaseServer
    .from('ingestion_jobs')
    .update({ status })
    .eq('job_id', jobId);

  if (error) throw new Error('Error al actualizar el job');
}
