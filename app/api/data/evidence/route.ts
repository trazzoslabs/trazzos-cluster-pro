import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    if (!entityType || !entityId) {
      return createErrorResponse(
        'entity_type and entity_id query parameters are required',
        400
      );
    }

    const { data, error } = await supabaseServer
      .from('evidence_records')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching evidence:', error);
      return createErrorResponse('Failed to fetch evidence', 500);
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/evidence:', error);
    return createErrorResponse('Internal server error', 500);
  }
}






