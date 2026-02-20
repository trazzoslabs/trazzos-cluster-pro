import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseServer
      .from('clusters')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching clusters:', error);
      return createErrorResponse('Failed to fetch clusters', 500);
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/clusters:', error);
    return createErrorResponse('Internal server error', 500);
  }
}





