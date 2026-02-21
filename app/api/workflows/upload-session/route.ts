import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;
const SESSION_TIMEOUT_MS = 60_000;

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
    const generatedJobId = crypto.randomUUID();
    if (!isMultipart) {
      return createErrorResponse('Use multipart/form-data con el archivo', 400);
    }

    const form = await request.formData();
    const inboundFile = (form.get('file') as File) || null;
    if (!inboundFile) {
      return createErrorResponse('Archivo requerido en campo "file"', 400);
    }

    const fileName = String(form.get('file_name') || inboundFile.name || '').toLowerCase();
    const datasetTypeFromFile = fileName.endsWith('.csv') || fileName.endsWith('.xlsx') ? 'suppliers' : 'needs';
    const datasetType = String(form.get('dataset_type') || datasetTypeFromFile);

    const webhookBaseUrl = N8N_WEBHOOK_URL || `${N8N_WEBHOOK_BASE}/api/upload/session`;
    const n8nUrl = `${webhookBaseUrl}?job_id=${generatedJobId}&id=${generatedJobId}`;

    const outboundForm = new FormData();
    outboundForm.append('file', inboundFile, inboundFile.name);
    outboundForm.append('job_id', generatedJobId);
    outboundForm.append('id', generatedJobId);
    outboundForm.append('correlation_id', generatedJobId);
    outboundForm.append('external_id', generatedJobId);
    outboundForm.append('company_id', String(form.get('company_id') || ''));
    outboundForm.append('user_id', String(form.get('user_id') || ''));
    outboundForm.append('cluster_id', String(form.get('cluster_id') || ''));
    outboundForm.append('dataset_type', datasetType);
    outboundForm.append('file_name', String(form.get('file_name') || inboundFile.name));
    outboundForm.append('file_type', String(form.get('file_type') || inboundFile.type || 'application/octet-stream'));

    const headers: HeadersInit = {};
    if (N8N_WEBHOOK_TOKEN && !N8N_WEBHOOK_TOKEN.startsWith('http')) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    safeLog('[upload-session] → POST multipart a n8n: %s', n8nUrl);

    let response: Response;
    try {
      response = await fetchWithTimeout(n8nUrl, {
        method: 'POST',
        headers,
        body: outboundForm,
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

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
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
      );
    }

    safeLog('[upload-session] ← %d OK', response.status);
    return createSuccessResponse(
      {
        job_id: generatedJobId,
        message: 'Archivo recibido, procesando sinergias...',
      },
      200,
    );
  } catch (error) {
    safeError('Unexpected error in POST /api/workflows/upload-session:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

