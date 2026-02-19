import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rfpId = searchParams.get('rfp_id');

    let query = supabaseServer.from('purchase_orders').select('*');

    if (rfpId) {
      query = query.eq('rfp_id', rfpId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching purchase orders:', error);
      return createErrorResponse('Failed to fetch purchase orders', 500);
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/purchase-orders:', error);
    return createErrorResponse('Internal server error', 500);
  }
}


