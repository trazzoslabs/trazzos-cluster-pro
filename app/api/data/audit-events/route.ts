import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { getAuditEvents } from '@/lib/services/audit-events';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entity_id');
    const correlationId = searchParams.get('correlation_id');
    const companyId = searchParams.get('company_id');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const rows = await getAuditEvents({
      entityId,
      correlationId,
      companyId,
      limit,
    });

    return createSuccessResponse(rows);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/audit-events:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
