import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { getIngestionJobs, getIngestionJobByJobIdOrUploadId, updateIngestionJobStatus } from '@/lib/services/ingestion-jobs';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { job_id } = body;

    if (!job_id) {
      return createErrorResponse('job_id es requerido', 400);
    }

    const current = await getIngestionJobs(job_id);
    if (!current || Array.isArray(current)) {
      return createErrorResponse('Job no encontrado', 404);
    }

    if (current.status === 'completed') {
      return createSuccessResponse({ message: 'Job ya estaba completado', job_id });
    }

    await updateIngestionJobStatus(job_id, 'completed');
    return createSuccessResponse({ message: 'Job marcado como completado', job_id });
  } catch (error) {
    console.error('[PATCH ingestion-jobs] Error inesperado:', error);
    return createErrorResponse('Error interno', 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('job_id');
    const id = searchParams.get('id');

    if (id !== null) {
      const trimmed = id.trim();
      if (!trimmed) {
        return createErrorResponse('id no puede estar vacío', 400);
      }
      // Resolver en orden: job_id → upload_id → correlation_id → mapping_profile_id (n8n puede guardar upload_id en correlation_id)
      const job = await getIngestionJobByJobIdOrUploadId(trimmed);
      if (!job) return createErrorResponse('Job no encontrado', 404);
      return createSuccessResponse(job);
    }

    const data = await getIngestionJobs(jobId);

    if (jobId) {
      return createSuccessResponse(data);
    }

    return createSuccessResponse(data ?? []);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/ingestion-jobs:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
