import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_CONFIRM_WEBHOOK_URL = process.env.N8N_CONFIRM_WEBHOOK_URL;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;

const INVALID_ID_VALUES = new Set(['', 'undefined', 'null']);

function isInvalidId(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return INVALID_ID_VALUES.has(normalized) || normalized.length === 0;
}

export async function POST(request: NextRequest) {
  try {
    if (!N8N_CONFIRM_WEBHOOK_URL && !N8N_WEBHOOK_BASE) {
      return createErrorResponse('N8N_CONFIRM_WEBHOOK_URL or N8N_WEBHOOK_BASE environment variable is not set', 500);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    const rawJobId = body?.job_id;
    const rawCorrelationId = body?.correlation_id;
    const jobId = typeof rawJobId === 'string' ? rawJobId.trim() : String(rawJobId ?? '').trim();
    const correlationIdValue = typeof rawCorrelationId === 'string' ? rawCorrelationId.trim() : String(rawCorrelationId ?? '').trim();

    // Validación estricta: rechazar antes de llamar a n8n
    if (isInvalidId(jobId)) {
      console.error('[upload-confirm] 400: job_id inválido o ausente', { received: rawJobId });
      return createErrorResponse('job_id es requerido y no puede ser vacío ni la cadena "undefined"', 400);
    }
    if (isInvalidId(correlationIdValue)) {
      console.error('[upload-confirm] 400: correlation_id inválido o ausente', { received: rawCorrelationId });
      return createErrorResponse('correlation_id es requerido y no puede ser vacío ni la cadena "undefined"', 400);
    }

    const finalPayload = {
      job_id: jobId,
      correlation_id: correlationIdValue,
      id: jobId,
      external_id: jobId,
      uuid: jobId,
      data: { job_id: jobId },
    };
    const correlationId = finalPayload.correlation_id;

    const baseConfirmUrl = N8N_CONFIRM_WEBHOOK_URL || `${N8N_WEBHOOK_BASE}/api/upload/confirm`;
    const url = `${baseConfirmUrl}?job_id=${encodeURIComponent(jobId)}&correlation_id=${encodeURIComponent(correlationIdValue)}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (N8N_WEBHOOK_TOKEN) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    console.log('[upload-confirm] URL de confirmación:', url);
    console.log('[upload-confirm] job_id=%s correlation_id=%s', finalPayload.job_id, finalPayload.correlation_id);
    const payloadJson = JSON.stringify(finalPayload);
    console.log('[upload-confirm] JSON exacto enviado a n8n (body):', payloadJson);

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(finalPayload),
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();
      
      console.log('[upload-confirm] Response status:', response.status);
      console.log('[upload-confirm] Response content-type:', contentType);
      console.log('[upload-confirm] Response text length:', responseText?.length || 0);
      console.log('[upload-confirm] Body completo de respuesta n8n V2:', responseText);
      
      // Verificar si la respuesta está vacía
      if (!responseText || responseText.trim() === '' || responseText.trim() === '{}' || responseText.trim() === '[]') {
        console.warn('[upload-confirm] n8n retornó respuesta vacía');
        if (!response.ok) {
          return createErrorResponse(
            'n8n workflow failed: No item to return was found - La respuesta está vacía',
            response.status,
            correlationId
          );
        }
        // Si la respuesta es OK pero vacía, retornar un objeto vacío
        data = { message: 'Confirmación exitosa (sin datos adicionales)' };
      } else if (contentType?.includes('application/json')) {
        data = JSON.parse(responseText);
      } else {
        data = { message: responseText };
      }
    } catch (error) {
      console.error('[upload-confirm] Error parsing n8n response:', error);
      if (!response.ok) {
        return createErrorResponse(
          'n8n workflow failed: No item to return was found - Error al procesar respuesta',
          response.status,
          correlationId
        );
      }
      data = { error: 'Failed to parse response' };
    }

    if (!response.ok) {
      console.error('[upload-confirm] n8n error:', data);
      return createErrorResponse(
        `n8n workflow failed: ${data.error || data.message || response.statusText}`,
        response.status,
        correlationId
      );
    }

    console.log(
      '[V6 trigger ACK] n8n upload-confirm OK status=%d job_id=%s correlation_id=%s',
      response.status,
      finalPayload?.job_id,
      finalPayload?.correlation_id,
    );

    // Verificar que data tenga contenido válido
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0 && !data.message)) {
      console.warn('[upload-confirm] Data vacío después del parseo');
      return createErrorResponse(
        'n8n workflow failed: No item to return was found - El resultado está vacío',
        response.status,
        correlationId
      );
    }

    return createSuccessResponse(data, response.status, correlationId);
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows/upload-confirm:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

