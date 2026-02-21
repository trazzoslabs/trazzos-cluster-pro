import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { supabaseServer } from '../../_lib/supabaseServer';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;
const FIXED_CLUSTER_ID = 'c1057e40-5e34-4e3a-b856-42f2b4b8a248';

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

    let body: Record<string, any> = {};
    let inboundFile: File | null = null;
    try {
      if (isMultipart) {
        const form = await request.formData();
        inboundFile = (form.get('file') as File) || null;
        body = {
          company_id: form.get('company_id'),
          user_id: form.get('user_id'),
          job_id: form.get('job_id'),
          file_name: form.get('file_name') || inboundFile?.name,
          file_type: form.get('file_type') || inboundFile?.type,
          dataset_type: form.get('dataset_type'),
          cluster_id: form.get('cluster_id'),
          correlation_id: form.get('correlation_id'),
        };
      } else {
        body = await request.json();
      }
    } catch {
      return createErrorResponse('Invalid request body', 400);
    }

    const fileName = String(body?.file_name ?? '').toLowerCase();
    const isJsonUpload = fileName.endsWith('.json') || fileName.endsWith('.jsonl');
    const isCsvUpload = fileName.endsWith('.csv') || fileName.endsWith('.xlsx');
    const generatedJobId = crypto.randomUUID();

    // Normalize inbound body before creating outbound payload
    const normalizedBody: Record<string, any> = {
      ...(body as Record<string, any>),
      job_id: generatedJobId,
      cluster_id: FIXED_CLUSTER_ID,
      dataset_type: isJsonUpload ? 'needs' : isCsvUpload ? 'suppliers' : body?.dataset_type,
    };

    // Validate required fields that n8n needs for the hash
    if (!normalizedBody.company_id || String(normalizedBody.company_id).trim().length === 0) {
      return createErrorResponse('company_id es requerido', 400);
    }
    if (!normalizedBody.job_id || String(normalizedBody.job_id).trim().length === 0) {
      throw new Error('ERROR CRÍTICO: job_id undefined');
    }
    if (!normalizedBody.dataset_type || !['needs', 'suppliers'].includes(normalizedBody.dataset_type)) {
      return createErrorResponse(
        `dataset_type inválido: "${normalizedBody.dataset_type}". Valores aceptados: needs, suppliers`,
        400,
      );
    }

    // Registro silencioso previo en DB para asegurar trazabilidad del job
    const { error: insertErr } = await supabaseServer
      .from('ingestion_jobs')
      .insert({ job_id: generatedJobId, status: 'running' });

    if (insertErr) {
      safeError('[upload-session] Error insertando ingestion_jobs:', insertErr);
      return createErrorResponse('No se pudo registrar el job en ingestion_jobs', 500);
    }

    const webhookBaseUrl = N8N_WEBHOOK_URL || `${N8N_WEBHOOK_BASE}/api/upload/session`;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (N8N_WEBHOOK_TOKEN && !N8N_WEBHOOK_TOKEN.startsWith('http')) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    const payload = {
      company_id: String(normalizedBody.company_id),
      user_id: String(normalizedBody.user_id ?? ''),
      job_id: String(generatedJobId),
      id: String(generatedJobId),
      correlation_id: String(generatedJobId),
      file_name: String(normalizedBody.file_name ?? inboundFile?.name ?? 'data.csv'),
      file_type: String(normalizedBody.file_type ?? inboundFile?.type ?? 'text/csv'),
      dataset_type: String(normalizedBody.dataset_type),
      cluster_id: String(normalizedBody.cluster_id),
      data: {
        job_id: String(generatedJobId),
      },
    };

    const n8nUrl = `${webhookBaseUrl}?job_id=${generatedJobId}&id=${generatedJobId}`;

    safeLog('[upload-session] → POST %s  dataset_type=%s company_id=%s cluster_id=%s job_id=%s', n8nUrl, payload.dataset_type, payload.company_id, payload.cluster_id, payload.job_id);
    safeLog('[upload-session] payload JSON exacto a n8n: %s', JSON.stringify(payload));
    if (inboundFile) {
      safeLog('[upload-session] archivo multipart recibido: %s (%d bytes)', inboundFile.name, inboundFile.size);
    }

    console.log('Llamando a n8n vía URL:', n8nUrl);
    console.log('Cuerpo enviado a n8n:', JSON.stringify(payload));

    let response: Response;
    try {
      response = await fetchWithTimeout(n8nUrl, {
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
    const responseData = {
      ...(typeof data === 'object' && data !== null ? data : { message: data }),
      job_id: (data as any)?.job_id || payload.job_id,
    };
    return createSuccessResponse(responseData, response.status);
  } catch (error) {
    safeError('Unexpected error in POST /api/workflows/upload-session:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

