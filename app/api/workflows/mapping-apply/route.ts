import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { supabaseServer } from '../../_lib/supabaseServer';
import { normalizeDatasetType } from '@/lib/utils/normalization';
import { AUTH_BYPASS_COMPANY_ID, AUTH_BYPASS_USER_ID } from '@/lib/authBypass';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_MAPPING_APPLY_URL = process.env.N8N_MAPPING_APPLY_URL;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_DATASET_TYPES = new Set(['needs', 'stocks', 'offers', 'shutdowns', 'suppliers']);

type MappingPairN8n = { source_column: string; target_field: string };

function isValidUuid(s: string): boolean {
  return UUID_REGEX.test(s.trim());
}

/**
 * Acepta `mapping` como objeto { [source_column]: target_field } o array de pares n8n.
 */
function normalizeMappingInput(body: Record<string, unknown>): {
  pairs: MappingPairN8n[];
  record: Record<string, string>;
} | null {
  const m = body.mapping ?? body.mapping_json;
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    const record: Record<string, string> = {};
    const pairs: MappingPairN8n[] = [];
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      const source_column = String(k).trim();
      const target_field = String(v ?? '').trim();
      if (!source_column || !target_field) continue;
      record[source_column] = target_field;
      pairs.push({ source_column, target_field });
    }
    if (pairs.length === 0) return null;
    return { pairs, record };
  }
  if (Array.isArray(m)) {
    const pairs: MappingPairN8n[] = [];
    for (const item of m) {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const sc =
        typeof o.source_column === 'string'
          ? o.source_column.trim()
          : typeof o.source_field === 'string'
            ? o.source_field.trim()
            : '';
      const tf = typeof o.target_field === 'string' ? o.target_field.trim() : '';
      if (!sc || !tf) return null;
      pairs.push({ source_column: sc, target_field: tf });
    }
    if (pairs.length === 0) return null;
    const record = Object.fromEntries(pairs.map((p) => [p.source_column, p.target_field]));
    return { pairs, record };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!N8N_WEBHOOK_TOKEN || !String(N8N_WEBHOOK_TOKEN).trim()) {
      return createErrorResponse('N8N_WEBHOOK_TOKEN es requerido para llamar al webhook de n8n', 500);
    }

    if (!N8N_WEBHOOK_BASE && !N8N_MAPPING_APPLY_URL) {
      return createErrorResponse('N8N_WEBHOOK_BASE or N8N_MAPPING_APPLY_URL environment variable is not set', 500);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    const job_id =
      typeof body.job_id === 'string' ? body.job_id.trim() : String(body.job_id ?? '').trim();
    if (!job_id || !isValidUuid(job_id)) {
      return createErrorResponse('job_id válido (UUID) es requerido', 400);
    }

    const mapping_profile_id_raw =
      typeof body.mapping_profile_id === 'string'
        ? body.mapping_profile_id.trim()
        : String(body.mapping_profile_id ?? '').trim();
    if (!mapping_profile_id_raw || !isValidUuid(mapping_profile_id_raw)) {
      return createErrorResponse('mapping_profile_id válido (UUID) es requerido', 400);
    }
    const mapping_profile_id = mapping_profile_id_raw;

    const normalized = normalizeMappingInput(body);
    if (!normalized) {
      return createErrorResponse(
        'mapping o mapping_json es requerido: objeto { columna_origen: campo_destino } o array de { source_column, target_field }',
        400,
      );
    }
    const { pairs, record: mapping_json } = normalized;

    const { data: job, error: jobErr } = await supabaseServer
      .from('ingestion_jobs')
      .select('job_id, upload_id, mapping_profile_id, status')
      .eq('job_id', job_id)
      .maybeSingle();

    if (jobErr) {
      console.error('[mapping-apply] Error leyendo ingestion_jobs:', jobErr);
      return createErrorResponse('No se pudo verificar el job', 500);
    }
    if (!job) {
      return createErrorResponse('El job no existe o ya no está disponible', 404);
    }

    const statusLower = (job.status ?? '').trim().toLowerCase();
    if (statusLower !== 'awaiting_mapping') {
      return createErrorResponse(
        `El job debe estar en estado awaiting_mapping para aplicar mapeo (actual: ${job.status ?? 'desconocido'})`,
        409,
      );
    }

    const uploadId = job.upload_id ? String(job.upload_id).trim() : '';
    if (!uploadId) {
      return createErrorResponse('El job no tiene upload_id; no se puede persistir el perfil de mapeo', 400);
    }

    const { data: upload, error: upErr } = await supabaseServer
      .from('uploads')
      .select('company_id, declared_dataset_type')
      .eq('upload_id', uploadId)
      .maybeSingle();

    if (upErr || !upload?.company_id) {
      console.error('[mapping-apply] Error leyendo uploads:', upErr);
      return createErrorResponse('No se pudo resolver company_id del upload', 500);
    }

    const bodyDatasetRaw = normalizeDatasetType(
      typeof body.dataset_type === 'string' ? body.dataset_type : '',
    );
    const uploadDatasetRaw = normalizeDatasetType(upload.declared_dataset_type);
    const resolvedDatasetType = ALLOWED_DATASET_TYPES.has(bodyDatasetRaw)
      ? bodyDatasetRaw
      : ALLOWED_DATASET_TYPES.has(uploadDatasetRaw)
        ? uploadDatasetRaw
        : 'needs';

    const now = new Date().toISOString();

    const { error: upsertErr } = await supabaseServer.from('mapping_profiles').upsert(
      {
        mapping_profile_id,
        company_id: upload.company_id,
        dataset_type: resolvedDatasetType,
        schema_version: '1',
        mapping_json,
        active: true,
        updated_at: now,
      },
      { onConflict: 'mapping_profile_id' },
    );

    if (upsertErr) {
      console.error('[mapping-apply] upsert mapping_profiles falló:', upsertErr);
      return createErrorResponse(
        `No se pudo guardar el perfil de mapeo: ${upsertErr.message || 'error de base de datos'}`,
        500,
      );
    }

    const { error: linkErr } = await supabaseServer
      .from('ingestion_jobs')
      .update({ mapping_profile_id, dataset_type: resolvedDatasetType })
      .eq('job_id', job_id);

    if (linkErr) {
      console.error('[mapping-apply] No se pudo actualizar ingestion_jobs:', linkErr);
      return createErrorResponse('Perfil guardado pero no se pudo actualizar el job', 500);
    }

    const bodyCompanyRaw =
      typeof body.company_id === 'string' ? body.company_id.trim() : '';
    const bodyUserRaw = typeof body.user_id === 'string' ? body.user_id.trim() : '';
    const companyIdForN8n = isValidUuid(bodyCompanyRaw)
      ? bodyCompanyRaw
      : String(upload.company_id ?? AUTH_BYPASS_COMPANY_ID);
    const userIdForN8n = isValidUuid(bodyUserRaw) ? bodyUserRaw : AUTH_BYPASS_USER_ID;

    const fdRaw = body.field_defaults;
    let field_defaults: Record<string, string> | undefined;
    if (fdRaw && typeof fdRaw === 'object' && !Array.isArray(fdRaw)) {
      const acc: Record<string, string> = {};
      for (const [k, v] of Object.entries(fdRaw as Record<string, unknown>)) {
        const key = String(k).trim();
        const val = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
        if (key && val) acc[key] = val;
      }
      if (Object.keys(acc).length > 0) field_defaults = acc;
    }

    /** Contrato n8n: lista de pares + tenant/usuario (alineado con ingestion / profiles). */
    const n8nPayload = {
      job_id,
      mapping_profile_id,
      dataset_type: resolvedDatasetType,
      company_id: companyIdForN8n,
      user_id: userIdForN8n,
      mapping: pairs,
      ...(field_defaults ? { field_defaults } : {}),
    };

    const url = N8N_MAPPING_APPLY_URL || `${N8N_WEBHOOK_BASE}/api/mapping/apply`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${N8N_WEBHOOK_TOKEN.trim()}`,
    };

    console.log('[mapping-apply] n8n POST', url);
    console.log('[mapping-apply] body:', JSON.stringify(n8nPayload));

    let response: Response;
    try {
      response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(n8nPayload),
      });
    } catch (e) {
      const msg =
        e instanceof Error && /timeout|abort/i.test(e.message)
          ? 'n8n no respondió a tiempo, reintenta'
          : 'Error de red al contactar n8n';
      console.error('[mapping-apply] fetch n8n:', e);
      return createErrorResponse(msg, 504);
    }

    let data: unknown;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = text ? { message: text } : {};
      }
    } catch (parseErr) {
      console.error('[mapping-apply] Error parseando respuesta n8n:', parseErr);
      data = { error: 'Failed to parse response' };
    }

    if (!response.ok) {
      const msg =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error?: string }).error)
          : typeof data === 'object' && data !== null && 'message' in data
            ? String((data as { message?: string }).message)
            : response.statusText;
      console.error('[mapping-apply] n8n error:', data);
      return createErrorResponse(`n8n workflow failed: ${msg}`, response.status);
    }

    const { error: uploadDoneErr } = await supabaseServer
      .from('uploads')
      .update({ status: 'completed' })
      .eq('upload_id', uploadId)
      .in('status', ['processing', 'pending', 'running', 'uploading']);
    if (uploadDoneErr) {
      console.warn('[mapping-apply] No se pudo marcar upload como completed:', uploadDoneErr.message);
    }

    return createSuccessResponse(
      {
        ...(typeof data === 'object' && data !== null ? data : {}),
        mapping_profile_id,
        job_id,
      },
      response.status,
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows/mapping-apply:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
