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

export async function updateIngestionJobStatus(jobId: string, status: 'completed'): Promise<void> {
  const { error } = await supabaseServer
    .from('ingestion_jobs')
    .update({ status })
    .eq('job_id', jobId);

  if (error) throw new Error('Error al actualizar el job');
}
