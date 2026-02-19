import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rfpId = searchParams.get('rfp_id');

    let query = supabaseServer.from('committee_decisions').select('*');

    if (rfpId) {
      query = query.eq('rfp_id', rfpId);
    } else {
      // Si no hay rfp_id, limitar a 100 resultados más recientes
      query = query.limit(100);
    }

    const { data, error } = await query.order('decided_at', { ascending: false });

    if (error) {
      console.error('Error fetching committee decisions:', error);
      return createErrorResponse('Failed to fetch committee decisions', 500);
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/committee-decisions:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

