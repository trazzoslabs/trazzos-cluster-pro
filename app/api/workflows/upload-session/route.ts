import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { supabaseServer } from '../../_lib/supabaseServer';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;
const SESSION_TIMEOUT_MS = 60_000;
const ALLOWED_DATASET_TYPES = new Set(['shutdowns', 'needs', 'suppliers']);

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

    const webhookBaseUrl = N8N_WEBHOOK_URL || `${N8N_WEBHOOK_BASE}/api/upload/session`;
    const payload = {
      company_id: companyId,
      file_name: fileName,
      file_type: fileType,
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

    safeLog('[upload-session] ← %d OK', response.status);
    return createSuccessResponse(
      {
        job_id: generatedJobId,
        correlation_id: generatedCorrelationId,
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

