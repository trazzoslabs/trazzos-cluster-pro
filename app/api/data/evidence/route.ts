import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { queryEvidenceRecords } from '@/lib/services/evidence';
import { normalizeEntityType } from '@/lib/utils/normalization';

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

    const { data, error } = await queryEvidenceRecords(normalizeEntityType(entityType), entityId);

    if (error) {
      console.error('Error fetching evidence:', error);
      return createErrorResponse('Failed to fetch evidence', 500);
    }

    return createSuccessResponse(data);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/evidence:', error);
    return createErrorResponse('Internal server error', 500);
  }
}







