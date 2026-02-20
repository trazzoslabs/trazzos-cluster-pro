import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entity_id');

    if (!entityId) {
      return createErrorResponse('entity_id query parameter is required', 400);
    }

    const { data, error } = await supabaseServer
      .from('audit_events')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching audit events:', error);
      return createErrorResponse('Failed to fetch audit events', 500);
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/audit:', error);
    return createErrorResponse('Internal server error', 500);
  }
}






