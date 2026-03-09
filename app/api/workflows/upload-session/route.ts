import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { supabaseServer } from '../../_lib/supabaseServer';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;
const SESSION_TIMEOUT_MS = 60_000;
const ALLOWED_DATASET_TYPES = new Set(['shutdowns', 'needs', 'suppliers']);

/** MIME types → tipo corto para n8n (V2-02-SW-Detect-File-Type). Siempre minúsculas. */
const MIME_TO_N8N_FILE_TYPE: Record<string, string> = {
  'text/csv': 'csv',
  'application/json': 'json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
};

/**
 * Devuelve el file_type que debe enviarse a n8n: tipo corto en minúsculas (csv, json, xlsx),
 * no el MIME completo. Vital para el Switch V2-02-SW-Detect-File-Type.
 */
function fileTypeForN8n(mimeOrType: string, fileName: string): string {
  const normalized = mimeOrType.trim().toLowerCase();
  if (MIME_TO_N8N_FILE_TYPE[normalized]) return MIME_TO_N8N_FILE_TYPE[normalized];
  if (normalized.includes('csv')) return 'csv';
  if (normalized.includes('json')) return 'json';
  if (normalized.includes('spreadsheet') || normalized.includes('excel') || normalized.includes('xlsx')) return 'xlsx';
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'json' || ext === 'jsonl') return 'json';
  if (ext === 'xlsx') return 'xlsx';
  return normalized || 'application/octet-stream';
}

const safeLog = (...args: any[]) => {
  try { console.log(...args); } catch { /* no-op */ }
};

const safeError = (...args: any[]) => {
  try { console.error(...args); } catch { /* no-op */ }
};

export async function POST(request: NextRequest) {
  try {
    if (!N8N_WEBHOOK_BASE && !N8N_WEBHOOK_URL) {
      return createErrorResponse('N8N_WEBHOOK_BASE or N8N_WEBHOOK_URL environment variable is not set', 500);
    }

    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');
    if (!isMultipart) {
      return createErrorResponse('Use multipart/form-data con el archivo', 400);
    }

    const form = await request.formData();
    const inboundFile = (form.get('file') as File) || null;
    if (!inboundFile) {
      return createErrorResponse('Archivo requerido en campo "file"', 400);
    }

    const companyId = String(form.get('company_id') || '').trim();
    const userId = String(form.get('user_id') || '').trim();
    const fileName = String(form.get('file_name') || inboundFile.name || '').trim();
    const fileType = String(form.get('file_type') || inboundFile.type || 'application/octet-stream').trim();
    const datasetType = String(form.get('dataset_type') || '').trim().toLowerCase();

    if (!companyId || !userId || !fileName || !fileType || !datasetType) {
      return createErrorResponse('company_id, user_id, file_name, file_type y dataset_type son requeridos', 400);
    }
    if (!ALLOWED_DATASET_TYPES.has(datasetType)) {
      return createErrorResponse("dataset_type inválido. Usa 'shutdowns', 'needs' o 'suppliers'", 400);
    }

    const generatedJobId = crypto.randomUUID();
    const generatedCorrelationId = crypto.randomUUID();

    const fileTypeForN8nValue = fileTypeForN8n(fileType, fileName);
    safeLog('[upload-session] file_type para n8n (V2-02-SW-Detect-File-Type):', fileTypeForN8nValue, '(original:', fileType + ')');

    const webhookBaseUrl = N8N_WEBHOOK_URL || `${N8N_WEBHOOK_BASE}/api/upload/session`;
    const payload = {
      company_id: companyId,
      file_name: fileName,
      file_type: fileTypeForN8nValue,
      user_id: userId,
      dataset_type: datasetType,
      job_id: generatedJobId,
      correlation_id: generatedCorrelationId,
    };

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (N8N_WEBHOOK_TOKEN && !N8N_WEBHOOK_TOKEN.startsWith('http')) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    safeLog('[upload-session] → POST %s  job_id=%s correlation_id=%s', webhookBaseUrl, generatedJobId, generatedCorrelationId);

    let response: Response;
    try {
      response = await fetchWithTimeout(webhookBaseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        timeout: SESSION_TIMEOUT_MS,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      safeError('[upload-session] n8n no respondió:', msg);
      if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('abort')) {
        return createErrorResponse(
          `Conexión con n8n fallida — no hubo respuesta en ${SESSION_TIMEOUT_MS / 1000}s. Verifica que el workflow esté activo.`,
          504,
        );
      }
      return createErrorResponse(`Conexión con n8n fallida: ${msg}`, 502);
    }

    let data: any;
    try {
      const n8nResponseType = response.headers.get('content-type');
      if (n8nResponseType?.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = text ? { message: text } : {};
      }
    } catch (error) {
      safeError('[upload-session] Error parsing n8n response:', error);
      data = { error: 'Failed to parse response' };
    }

    if (!response.ok) {
      safeError('[upload-session] n8n error %d:', response.status, data);
      console.error('[upload-session] Cuerpo completo de error n8n:', typeof data === 'string' ? data : JSON.stringify(data));
      return createErrorResponse(
        'Workflow de n8n falló. Revisa el historial de ejecuciones en n8n cloud.',
        response.status,
        generatedCorrelationId,
      );
    }

    const signedUrl =
      data?.signed_url ||
      data?.signedUrl ||
      data?.upload_url ||
      data?.url ||
      data?.data?.signed_url ||
      data?.data?.signedUrl ||
      data?.data?.upload_url ||
      data?.data?.url;

    if (!signedUrl) {
      safeError('[upload-session] n8n respondió sin signed_url:', data);
      return createErrorResponse('n8n no devolvió signed_url', 502, generatedCorrelationId);
    }

    const uploadIdRaw =
      data?.upload_id ??
      data?.uploadId ??
      data?.data?.upload_id ??
      data?.data?.uploadId;
    let upload_id = typeof uploadIdRaw === 'string' ? uploadIdRaw.trim() : '';

    if (!upload_id) {
      safeLog('[upload-session] n8n no devolvió upload_id; creando registro en uploads para persistir ID');
      const newUploadId = crypto.randomUUID();
      const { error: uploadInsertErr } = await supabaseServer.from('uploads').insert({
        upload_id: newUploadId,
        company_id: companyId,
        uploader_user_id: userId,
        file_name: fileName,
        file_type: fileType,
        declared_dataset_type: datasetType,
        status: 'pending',
      });
      if (uploadInsertErr) {
        safeError('[upload-session] Error insertando uploads:', uploadInsertErr);
        return createErrorResponse('No se pudo registrar el upload', 500, generatedCorrelationId);
      }
      upload_id = newUploadId;
    }

    const { error: insertErr } = await supabaseServer
      .from('ingestion_jobs')
      .insert({
        job_id: generatedJobId,
        status: 'running',
        correlation_id: generatedCorrelationId,
      });

    if (insertErr) {
      safeError('[upload-session] Error insertando ingestion_jobs:', insertErr);
      return createErrorResponse('No se pudo registrar el job en ingestion_jobs', 500, generatedCorrelationId);
    }

    safeLog('[upload-session] ← %d OK job_id=%s upload_id=%s', response.status, generatedJobId, upload_id);
    return createSuccessResponse(
      {
        job_id: generatedJobId,
        correlation_id: generatedCorrelationId,
        upload_id,
        signed_url: signedUrl,
      },
      200,
      generatedCorrelationId,
    );
  } catch (error) {
    safeError('Unexpected error in POST /api/workflows/upload-session:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

