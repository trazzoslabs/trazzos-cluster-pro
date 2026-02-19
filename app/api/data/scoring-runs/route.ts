import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rfpId = searchParams.get('rfp_id');

    if (!rfpId) {
      return createErrorResponse('rfp_id query parameter is required', 400);
    }

    const { data, error } = await supabaseServer
      .from('scoring_runs')
      .select('*')
      .eq('rfp_id', rfpId)
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching scoring runs:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return createErrorResponse(`Failed to fetch scoring runs: ${error.message}`, 500);
    }

    console.log(`Found ${data?.length || 0} scoring runs for rfp_id: ${rfpId}`);
    
    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/scoring-runs:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

