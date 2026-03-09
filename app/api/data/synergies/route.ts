import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { getSynergies } from '@/lib/services/synergies';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clusterId = searchParams.get('cluster_id');
    const companyId = searchParams.get('company_id');
    const debug = searchParams.get('debug') === '1';

    const { rows, source, usedFallback, debug: debugInfo } = await getSynergies({
      clusterId,
      companyId,
      debug,
    });

    if (debugInfo) {
      return Response.json({ data: rows, _debug: debugInfo }, { status: 200 });
    }

    return createSuccessResponse(rows);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/synergies:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
