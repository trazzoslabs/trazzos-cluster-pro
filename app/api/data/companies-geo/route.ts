import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { getCompaniesGeo } from '@/lib/services/companies-geo';

export async function GET(request: NextRequest) {
  try {
    const result = await getCompaniesGeo();
    return createSuccessResponse(result);
  } catch (error) {
    console.error('[companies-geo] Error inesperado:', error);
    return createErrorResponse('Error al cargar empresas geoespaciales', 500);
  }
}
