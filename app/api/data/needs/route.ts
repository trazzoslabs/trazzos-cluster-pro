import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { getMockNeedsData, isN8nMockEnabled } from '../../_lib/n8nMock';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clusterId = searchParams.get('cluster_id');
    const companyId = searchParams.get('company_id');
    const mockMode = isN8nMockEnabled();

    let query = supabaseServer.from('needs').select('*');

    // En modo mock no restringimos por perfil para mostrar alcance total.
    if (clusterId && !mockMode) query = query.eq('cluster_id', clusterId);
    if (companyId && !mockMode) query = query.eq('company_id', companyId);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching needs:', error);
      return createErrorResponse('Failed to fetch needs', 500);
    }

    let rows = data || [];
    if (rows.length === 0 && mockMode) {
      rows = getMockNeedsData();
    }

    return createSuccessResponse(rows);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/needs:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
