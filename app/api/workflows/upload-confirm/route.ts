import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_CONFIRM_WEBHOOK_URL = process.env.N8N_CONFIRM_WEBHOOK_URL;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validación estricta: el valor es inválido si es nulo, vacío, igual a "undefined"/"null"
 * o contiene la palabra "undefined". Usado para job_id, correlation_id y upload_id.
 */
function isInvalidTrackingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const s = typeof value === 'string' ? value.trim() : String(value).trim();
  if (s.length === 0) return true;
  const lower = s.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return true;
  if (lower.includes('undefined')) return true;
  return false;
}

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value.trim());
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

    const { job_id: rawJobId, correlation_id: rawCorrelationId, upload_id: rawUploadId } = (body ?? {}) as Record<string, unknown>;
    const rawUploadIdResolved = rawUploadId ?? (body?.uploadId as string | undefined);
    const jobId = typeof rawJobId === 'string' ? rawJobId.trim() : String(rawJobId ?? '').trim();
    const correlationIdValue = typeof rawCorrelationId === 'string' ? rawCorrelationId.trim() : String(rawCorrelationId ?? '').trim();
    const uploadIdValue = typeof rawUploadIdResolved === 'string' ? rawUploadIdResolved.trim() : String(rawUploadIdResolved ?? rawUploadId ?? '').trim();

    // Validación estricta antes del fetch a n8n: nulo, vacío o contiene "undefined" → 400 detallado
    const validationErrors: string[] = [];
    if (isInvalidTrackingValue(jobId)) {
      validationErrors.push('job_id es requerido y no puede ser nulo, vacío o contener la palabra "undefined"');
    }
    if (isInvalidTrackingValue(correlationIdValue)) {
      validationErrors.push('correlation_id es requerido y no puede ser nulo, vacío o contener la palabra "undefined"');
    }
    if (isInvalidTrackingValue(uploadIdValue)) {
      validationErrors.push('upload_id es requerido y no puede ser nulo, vacío o contener la palabra "undefined"');
    }
    if (validationErrors.length > 0) {
      const detail = validationErrors.join('; ');
      console.error('[upload-confirm] 400: validación fallida', { received: { job_id: rawJobId, correlation_id: rawCorrelationId, upload_id: rawUploadId }, errors: validationErrors });
      return createErrorResponse(detail, 400);
    }
    if (!isValidUUID(uploadIdValue)) {
      console.error('[upload-confirm] 400: upload_id no es un UUID válido', { received: uploadIdValue });
      return createErrorResponse('upload_id debe ser un UUID válido', 400);
    }

    if (!isValidUUID(jobId)) {
      console.error('[upload-confirm] 400: job_id no es un UUID válido', { received: jobId });
      return createErrorResponse('job_id debe ser un UUID válido', 400);
    }

    if (jobId === 'undefined') {
      console.error('[upload-confirm] 400: job_id es la cadena literal "undefined"');
      return createErrorResponse('job_id no puede ser la cadena literal "undefined"', 400);
    }

    const rawUserEmail = body?.user_email ?? body?.userEmail;
    const user_email =
      typeof rawUserEmail === 'string' ? rawUserEmail.trim() : String(rawUserEmail ?? '').trim();

    if (isInvalidTrackingValue(user_email)) {
      console.error('[upload-confirm] 400: user_email faltante');
      return createErrorResponse('user_email del perfil es requerido (V2-03)', 400);
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email);
    if (!emailOk) {
      return createErrorResponse('user_email debe ser un correo válido', 400);
    }

    /**
     * V2-02 / V2-03: cuerpo JSON hacia n8n solo con estos cuatro campos.
     * Dataset, company, app_url, etc. los resuelve el flujo en n8n/DB a partir de upload_id/job_id.
     */
    const finalPayload = {
      job_id: jobId,
      upload_id: uploadIdValue,
      correlation_id: correlationIdValue,
      user_email,
    };
    const correlationId = correlationIdValue;

    const baseConfirmUrl = N8N_CONFIRM_WEBHOOK_URL || `${N8N_WEBHOOK_BASE}/api/upload/confirm`;
    const url = `${baseConfirmUrl}?job_id=${encodeURIComponent(jobId)}&correlation_id=${encodeURIComponent(correlationIdValue)}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (N8N_WEBHOOK_TOKEN) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    console.log('[upload-confirm] URL de confirmación:', url);
    console.log('[upload-confirm] job_id=%s correlation_id=%s upload_id=%s', finalPayload.job_id, finalPayload.correlation_id, finalPayload.upload_id);
    console.log('[V2-05-Check] Enviando JobID a n8n: %s', jobId);
    console.log('[Payload-Debug]', JSON.stringify(finalPayload, null, 2));
    const payloadJson = JSON.stringify(finalPayload);
    console.log('[upload-confirm] JSON exacto enviado a n8n (body, upload_id incluido):', payloadJson);

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

