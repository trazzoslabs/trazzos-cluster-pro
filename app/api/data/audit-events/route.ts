import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entity_id');
    const correlationId = searchParams.get('correlation_id');
    const companyId = searchParams.get('company_id');

    let query = supabaseServer.from('audit_events').select('*');

    // Aplicar filtros si vienen en los query params
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    if (correlationId) {
      query = query.eq('correlation_id', correlationId);
    }

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    // Aplicar límite si viene en los query params, o usar 50 por defecto si no hay filtros
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : (!entityId && !correlationId && !companyId ? 50 : undefined);
    
    if (limit) {
      query = query.limit(limit);
    }

    // Ordenar por created_at descendente
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching audit events:', error);
      return createErrorResponse('Failed to fetch audit events', 500);
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/audit-events:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

