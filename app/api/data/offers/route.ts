import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { getMockOffersData, isN8nMockEnabled, MOCK_RFP_ID } from '../../_lib/n8nMock';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rfpId = searchParams.get('rfp_id');
    const mockMode = isN8nMockEnabled();

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

    let rows = data || [];
    if (rows.length === 0 && mockMode && rfpId === MOCK_RFP_ID) {
      rows = getMockOffersData();
    }

    return createSuccessResponse(rows);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/offers:', error);
    return createErrorResponse('Internal server error', 500);
  }
}







