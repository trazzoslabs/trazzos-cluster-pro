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

/**
 * Busca un job por job_id, upload_id o mapping_profile_id (para /ingestion/mapping/[id]).
 * 1) job_id = id, 2) upload_id = id, 3) mapping_profile_id = id.
 * Así n8n puede enviar el ID del perfil de mapeo y se redirige al job correcto.
 */
export async function getIngestionJobByJobIdOrUploadId(id: string): Promise<IngestionJobRow | null> {
  const trimmed = id?.trim();
  if (!trimmed) return null;
  const cols = 'job_id, status, upload_id, pipeline_version, mapping_profile_id, rows_total, rows_ok, rows_error, started_at, ended_at, correlation_id';
  const { data: byJob, error: errJob } = await supabaseServer
    .from('ingestion_jobs')
    .select(cols)
    .eq('job_id', trimmed)
    .maybeSingle();
  if (!errJob && byJob) return byJob as IngestionJobRow;
  const { data: byUpload, error: errUpload } = await supabaseServer
    .from('ingestion_jobs')
    .select(cols)
    .eq('upload_id', trimmed)
    .maybeSingle();
  if (!errUpload && byUpload) return byUpload as IngestionJobRow;
  const { data: byMappingProfile, error: errProfile } = await supabaseServer
    .from('ingestion_jobs')
    .select(cols)
    .eq('mapping_profile_id', trimmed)
    .maybeSingle();
  if (errProfile) throw new Error('Failed to fetch ingestion job by id');

  const { data: byCorrelation, error: errCorrelation } = await supabaseServer
    .from('ingestion_jobs')
    .select(cols)
    .eq('correlation_id', trimmed)
    .maybeSingle();
  if (!errCorrelation && byCorrelation) return byCorrelation as IngestionJobRow;

  return (byMappingProfile as IngestionJobRow) ?? null;
}

export async function updateIngestionJobStatus(jobId: string, status: 'completed'): Promise<void> {
  const { error } = await supabaseServer
    .from('ingestion_jobs')
    .update({ status })
    .eq('job_id', jobId);

  if (error) throw new Error('Error al actualizar el job');
}
