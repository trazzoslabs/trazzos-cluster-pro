import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { getMockRfpsData, isN8nMockEnabled } from '../../_lib/n8nMock';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const synergyId = searchParams.get('synergy_id');

    const mockMode = isN8nMockEnabled();

    let query = supabaseServer.from('rfps').select('*');

    if (synergyId && !mockMode) {
      query = query.eq('synergy_id', synergyId);
    }

    // Ordenar por closing_at (NOT NULL según schema)
    const { data, error } = await query.order('closing_at', { ascending: false });

    if (error) {
      console.error('Error fetching rfps:', error);
      return createErrorResponse('Failed to fetch rfps', 500);
    }

    let rows = data || [];
    if (rows.length === 0 && mockMode) {
      rows = getMockRfpsData();
    }

    return createSuccessResponse(rows);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/rfps:', error);
    return createErrorResponse('Internal server error', 500);
  }
}


