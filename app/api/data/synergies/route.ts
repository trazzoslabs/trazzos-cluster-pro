import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clusterId = searchParams.get('cluster_id');

    let query = supabaseServer
      .from('synergies')
      .select('*');

    // Si hay cluster_id, filtrar por él; si no, traer todas
    if (clusterId) {
      query = query.eq('cluster_id', clusterId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching synergies:', error);
      return createErrorResponse('Failed to fetch synergies', 500);
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/synergies:', error);
    return createErrorResponse('Internal server error', 500);
  }
}


