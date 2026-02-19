import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

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
