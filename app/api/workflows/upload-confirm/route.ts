import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { resolveAuthenticatedProfile } from '../../_lib/resolveAuthenticatedProfile';
import { AUTH_BYPASS_USER_ID } from '@/lib/authBypass';

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

function mappingUrlForUploadId(uploadId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (base) return `${base}/ingestion/mapping/${encodeURIComponent(uploadId)}`;
  const vercel = (process.env.VERCEL_URL || '').trim().replace(/^https?:\/\//, '');
  if (vercel) return `https://${vercel}/ingestion/mapping/${encodeURIComponent(uploadId)}`;
  return '';
}

/** URL fija de demo cuando n8n falla (segmento = bypass user id, como en el spec de demo). */
function simulatedDemoMappingUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (base) return `${base}/ingestion/mapping/${AUTH_BYPASS_USER_ID}`;
  const vercel = (process.env.VERCEL_URL || '').trim().replace(/^https?:\/\//, '');
  if (vercel) return `https://${vercel}/ingestion/mapping/${AUTH_BYPASS_USER_ID}`;
  return `https://tu-app.vercel.app/ingestion/mapping/${AUTH_BYPASS_USER_ID}`;
}

/**
 * Demo Cartagena: activa éxito simulado si n8n devuelve error de servidor (≥500),
 * mensaje "No item to return", o 200 con cuerpo vacío/inútil. No simula 4xx.
 */
function n8nFailureIndicatesSimulatedSuccess(
  response: Response,
  responseText: string,
  parsed: unknown,
): boolean {
  if (response.status >= 500) return true;

  const raw = (responseText || '').trim();
  const lower = raw.toLowerCase();
  if (lower.includes('no item to return')) return true;

  if (!response.ok) return false;

  if (!raw || raw === '{}' || raw === '[]') return true;
  if (lower.includes('no item')) return true;
  if (parsed && typeof parsed === 'object' && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    const err = String(o.error ?? o.message ?? '').toLowerCase();
    if (err.includes('no item to return')) return true;
  }
  return false;
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

    const auth = await resolveAuthenticatedProfile(request);
    if (!auth.ok) {
      console.error('[upload-confirm] Sin sesión o perfil:', auth.status, auth.message);
      return createErrorResponse(auth.message, auth.status);
    }

    let user_email = (auth.email ?? '').trim();
    if (isInvalidTrackingValue(user_email)) {
      console.error('[upload-confirm] 400: email ausente en perfil/sesión (V2-03 requiere correo para notificación)');
      return createErrorResponse(
        'No hay email en el perfil del usuario autenticado. Inicia sesión con una cuenta que tenga correo para recibir el enlace de mapeo (V2-03).',
        400,
      );
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email);
    if (!emailOk) {
      return createErrorResponse(
        'El email del perfil autenticado no es válido; actualiza tu cuenta o contacta soporte (V2-03).',
        400,
      );
    }

    const bodyEmailRaw = body?.user_email ?? body?.userEmail;
    const bodyEmail =
      typeof bodyEmailRaw === 'string' ? bodyEmailRaw.trim() : String(bodyEmailRaw ?? '').trim();
    if (bodyEmail && bodyEmail.toLowerCase() !== user_email.toLowerCase()) {
      console.warn(
        '[upload-confirm] user_email del body distinto al del perfil; usando solo perfil para n8n. body=%s perfil=%s',
        bodyEmail,
        user_email,
      );
    }

    /**
     * V2-02 / V2-03: cuerpo JSON hacia n8n solo con estos cuatro campos.
     * Dataset, company, app_url, etc. los resuelve el flujo en n8n/DB a partir de upload_id/job_id.
     */
    const mapping_url = mappingUrlForUploadId(uploadIdValue);

    const finalPayload = {
      job_id: jobId,
      upload_id: uploadIdValue,
      correlation_id: correlationIdValue,
      user_email,
      ...(mapping_url ? { mapping_url, mapping_url_upload_id: mapping_url } : {}),
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

    const simulatedBody = (reason: string) => {
      const mapping_url = simulatedDemoMappingUrl();
      console.warn('[upload-confirm] Éxito simulado (200):', reason, '| mapping_url=', mapping_url);
      return createSuccessResponse(
        {
          simulated: true,
          simulated_reason: reason,
          message: 'Confirmación aceptada en modo demo (n8n no devolvió un ítem válido).',
          mapping_url,
          mapping_url_upload_id: mapping_url,
          job_id: jobId,
          upload_id: uploadIdValue,
          correlation_id: correlationIdValue,
          user_email,
        },
        200,
        correlationId,
      );
    };

    let response: Response;
    let responseText = '';
    try {
      response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(finalPayload),
      });
      responseText = await response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload-confirm] Error de red / timeout llamando a n8n:', msg);
      return simulatedBody(`fetch n8n falló: ${msg}`);
    }

    const contentType = response.headers.get('content-type') || '';
    console.log('[upload-confirm] Response status:', response.status);
    console.log('[upload-confirm] Response content-type:', contentType);
    console.log('[upload-confirm] Response text length:', responseText?.length || 0);
    console.log('[upload-confirm] Body completo de respuesta n8n V2:', responseText);

    let data: unknown;
    try {
      if (contentType.includes('application/json') && responseText.trim()) {
        data = JSON.parse(responseText);
      } else if (responseText.trim()) {
        data = { message: responseText };
      } else {
        data = {};
      }
    } catch (parseErr) {
      console.error('[upload-confirm] Error parseando JSON de n8n:', parseErr);
      data = { raw: responseText };
    }

    if (n8nFailureIndicatesSimulatedSuccess(response, responseText, data)) {
      return simulatedBody(
        !response.ok
          ? `HTTP ${response.status}`
          : 'respuesta vacía o "No item to return"',
      );
    }

    const dataObj = data as Record<string, unknown>;
    if (
      data &&
      typeof data === 'object' &&
      Object.keys(dataObj).length === 0 &&
      !('message' in dataObj)
    ) {
      return simulatedBody('objeto de respuesta sin campos útiles');
    }

    console.log(
      '[V6 trigger ACK] n8n upload-confirm OK status=%d job_id=%s correlation_id=%s',
      response.status,
      finalPayload?.job_id,
      finalPayload?.correlation_id,
    );

    return createSuccessResponse(data, response.status, correlationId);
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows/upload-confirm:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

