import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

/**
 * GET /api/data/quality-issues?job_id=<uuid>
 * Errores de calidad persistidos tras V2-04 (canonicalize / upsert): tabla data_quality_issues.
 */
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('job_id');

    if (!jobId?.trim()) {
      return createErrorResponse('job_id query parameter is required', 400);
    }

    const { data, error } = await supabaseServer
      .from('data_quality_issues')
      .select('issue_id, row_number, severity, issue_code')
      .eq('job_id', jobId.trim())
      .order('row_number', { ascending: true });

    if (error) {
      console.error('[quality-issues] Supabase error:', error.message);
      return createErrorResponse(`Error al consultar calidad: ${error.message}`, 500);
    }

    return createSuccessResponse(data ?? []);
  } catch (err) {
    console.error('[quality-issues] Unexpected error:', err);
    return createErrorResponse('Internal server error', 500);
  }
}
