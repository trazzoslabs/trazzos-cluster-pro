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
      .from('offers')
      .select('*')
      .eq('rfp_id', rfpId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching offers:', error);
      return createErrorResponse('Failed to fetch offers', 500);
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/offers:', error);
    return createErrorResponse('Internal server error', 500);
  }
}





