import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('job_id');

    if (!jobId) {
      return createErrorResponse('job_id query parameter is required', 400);
    }

    // Get job info to determine dataset_type
    const { data: job, error: jobError } = await supabaseServer
      .from('ingestion_jobs')
      .select('job_id, upload_id')
      .eq('job_id', jobId)
      .maybeSingle();

    if (jobError) {
      console.error('Error fetching job:', jobError);
      return createErrorResponse('Failed to fetch job', 500);
    }

    if (!job) {
      return createErrorResponse('Job not found', 404);
    }

    // Get upload to determine dataset_type
    let datasetType: string | null = null;
    if (job.upload_id) {
      const { data: upload, error: uploadError } = await supabaseServer
        .from('uploads')
        .select('declared_dataset_type')
        .eq('upload_id', job.upload_id)
        .maybeSingle();

      if (uploadError) {
        console.error('Error fetching upload:', uploadError);
      } else if (upload) {
        datasetType = upload.declared_dataset_type;
      }
    }

    // Determine which staging table to query
    let stagingTable: string;
    if (datasetType === 'shutdowns') {
      stagingTable = 'stg_shutdowns_rows';
    } else if (datasetType === 'needs') {
      stagingTable = 'stg_needs_rows';
    } else if (datasetType === 'suppliers') {
      // Suppliers might not have staging table, return empty for now
      return createSuccessResponse([]);
    } else {
      // Try to detect from data
      stagingTable = 'stg_shutdowns_rows';
    }

    // Get a sample row to extract columns
    const { data: sampleRows, error: rowsError } = await supabaseServer
      .from(stagingTable)
      .select('raw_json')
      .eq('job_id', jobId)
      .limit(10);

    if (rowsError) {
      console.error('Error fetching staging rows:', rowsError);
      return createErrorResponse('Failed to fetch staging rows', 500);
    }

    // Extract unique column names from raw_json
    const columnsSet = new Set<string>();
    if (sampleRows && sampleRows.length > 0) {
      sampleRows.forEach((row) => {
        if (row.raw_json && typeof row.raw_json === 'object') {
          Object.keys(row.raw_json).forEach((key) => {
            // Normalize key (UTF-8, trim)
            const normalizedKey = key.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (normalizedKey) {
              columnsSet.add(normalizedKey);
            }
          });
        }
      });
    }

    // Convert to array and sort
    const columns = Array.from(columnsSet).sort().map((col) => ({
      source_column: col,
      detected_at: new Date().toISOString(),
    }));

    return createSuccessResponse(columns);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/staging-columns:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

