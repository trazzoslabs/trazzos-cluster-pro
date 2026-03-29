import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { supabaseServer } from '../../_lib/supabaseServer';
import { normalizeDatasetType } from '@/lib/utils/normalization';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;
const SESSION_TIMEOUT_MS = 60_000;
const ALLOWED_DATASET_TYPES = new Set(['shutdowns', 'needs', 'suppliers']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publicAppBaseUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const vercel = (process.env.VERCEL_URL || '').trim().replace(/^https?:\/\//, '');
  if (vercel) return `https://${vercel}`;
  return '';
}

/**
 * Si n8n devuelve solo la ruta (p. ej. /storage/v1/object/sign/...), antepone SUPABASE_URL.
 * Las URLs absolutas http(s) se devuelven sin cambios.
 */
function resolveSupabaseSignedUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

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
    const datasetType = normalizeDatasetType(String(form.get('dataset_type') || ''));

    if (!companyId || !userId || !fileName || !fileType || !datasetType) {
      return createErrorResponse('company_id, user_id, file_name, file_type y dataset_type son requeridos', 400);
    }
    if (!ALLOWED_DATASET_TYPES.has(datasetType)) {
      return createErrorResponse("dataset_type inválido. Usa 'shutdowns', 'needs' o 'suppliers'", 400);
    }

    const formJobIdRaw = String(form.get('job_id') || '').trim();
    const generatedJobId = UUID_REGEX.test(formJobIdRaw) ? formJobIdRaw : crypto.randomUUID();
    /** Mismo valor que correlation_id en V2-02 (auditoría y trazabilidad por carga). */
    const canonicalUploadId = crypto.randomUUID();

    const appBase = publicAppBaseUrl();
    const mappingUrlForUploadId = appBase
      ? `${appBase}/ingestion/mapping/${encodeURIComponent(canonicalUploadId)}`
      : '';
    const mappingUrlForJobId = appBase
      ? `${appBase}/ingestion/mapping/${encodeURIComponent(generatedJobId)}`
      : '';

    const fileTypeForN8nValue = fileTypeForN8n(fileType, fileName);
    safeLog('[upload-session] file_type para n8n (V2-02-SW-Detect-File-Type):', fileTypeForN8nValue, '(original:', fileType + ')');

    const webhookBaseUrl = N8N_WEBHOOK_URL || `${N8N_WEBHOOK_BASE}/api/upload/session`;
    const payload = {
      // 1. Esquema original (Documentación)
      company_id: companyId,
      user_id: userId,
      file_name: fileName,
      file_type: fileTypeForN8nValue,
      dataset_type: datasetType,
      job_id: generatedJobId,
      correlation_id: canonicalUploadId,
      upload_id: canonicalUploadId,

      // 2. Redundancia de Base de datos y camelCase
      companyId: companyId,
      userId: userId,
      fileName: fileName,
      fileType: fileTypeForN8nValue,
      datasetType: datasetType,
      uploader_user_id: userId,
      declared_dataset_type: datasetType,
      uploadId: canonicalUploadId,

      // 3. ESQUEMA DE EVENTOS DE N8N (La clave para pasar el filtro)
      actor_user_id: userId,
      summary: fileName,
      content_type: fileTypeForN8nValue,
      mime_type: fileTypeForN8nValue,
      entity_type: 'upload',

      /** Para el correo / deep link: debe usar el mismo upload_id que `ingestion_jobs` y `uploads`. */
      mapping_url: mappingUrlForUploadId,
      mapping_url_upload_id: mappingUrlForUploadId,
      mapping_url_job_id: mappingUrlForJobId,
    };

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (N8N_WEBHOOK_TOKEN && !N8N_WEBHOOK_TOKEN.startsWith('http')) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    safeLog('[upload-session] → POST %s  job_id=%s upload_id/correlation_id=%s', webhookBaseUrl, generatedJobId, canonicalUploadId);

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
        canonicalUploadId,
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
      return createErrorResponse('n8n no devolvió signed_url', 502, canonicalUploadId);
    }

    const signedUrlAbsolute = resolveSupabaseSignedUrl(String(signedUrl));

    const uploadIdRaw =
      data?.upload_id ??
      data?.uploadId ??
      data?.data?.upload_id ??
      data?.data?.uploadId;
    const fromN8n = typeof uploadIdRaw === 'string' ? uploadIdRaw.trim() : '';
    let upload_id = fromN8n || canonicalUploadId;

    /** Service role: siempre asegurar fila en `uploads` (evita carga infinita si n8n devolvió upload_id pero no insertó). */
    const { error: uploadUpsertErr } = await supabaseServer.from('uploads').upsert(
      {
        upload_id,
        company_id: companyId,
        uploader_user_id: userId,
        file_name: fileName,
        file_type: fileType,
        declared_dataset_type: datasetType,
        status: 'pending',
      },
      { onConflict: 'upload_id' },
    );
    if (uploadUpsertErr) {
      safeError('[upload-session] Error upsert uploads (service role):', uploadUpsertErr);
      return createErrorResponse('No se pudo registrar el upload en la base de datos', 500, upload_id);
    }
    if (!fromN8n) {
      safeLog('[upload-session] n8n no devolvió upload_id; usando canonicalUploadId ya persistido en uploads');
    }

    const { error: insertErr } = await supabaseServer
      .from('ingestion_jobs')
      .insert({
        job_id: generatedJobId,
        upload_id,
        status: 'running',
        correlation_id: upload_id,
      });

    if (insertErr) {
      safeError('[upload-session] Error insertando ingestion_jobs:', insertErr);
      return createErrorResponse('No se pudo registrar el job en ingestion_jobs', 500, canonicalUploadId);
    }

    const resolvedMappingUrl = appBase
      ? `${appBase}/ingestion/mapping/${encodeURIComponent(upload_id)}`
      : '';

    safeLog('[upload-session] ← %d OK job_id=%s upload_id=%s', response.status, generatedJobId, upload_id);
    return createSuccessResponse(
      {
        job_id: generatedJobId,
        correlation_id: upload_id,
        upload_id,
        signed_url: signedUrlAbsolute,
        mapping_url: resolvedMappingUrl,
      },
      200,
      upload_id,
    );
  } catch (error) {
    safeError('Unexpected error in POST /api/workflows/upload-session:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

