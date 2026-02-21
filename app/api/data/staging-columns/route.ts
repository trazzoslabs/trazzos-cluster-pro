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

    // Determinar tabla staging sin depender de columnas extra en ingestion_jobs.
    const tableCandidates = ['stg_needs_rows', 'stg_shutdowns_rows'];
    let stagingTable: string | null = null;

    for (const tableName of tableCandidates) {
      const { data, error } = await supabaseServer
        .from(tableName)
        .select('job_id')
        .eq('job_id', jobId)
        .limit(1);
      if (!error && data && data.length > 0) {
        stagingTable = tableName;
        break;
      }
    }

    if (!stagingTable) {
      return createSuccessResponse([]);
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

