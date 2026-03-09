import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clusterId = searchParams.get('cluster_id');
    const companyId = searchParams.get('company_id');

    let query = supabaseServer.from('needs').select('*');

    if (clusterId) query = query.eq('cluster_id', clusterId);
    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching needs:', error);
      return createErrorResponse('Failed to fetch needs', 500);
    }

    return createSuccessResponse(data ?? []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/needs:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
