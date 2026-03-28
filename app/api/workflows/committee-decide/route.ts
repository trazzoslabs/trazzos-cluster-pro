import { NextRequest } from 'next/server';
import {
  createErrorResponse,
  createSuccessResponse,
  fetchWithTimeout,
} from '../../_lib/http';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deepPickString(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const o = data as Record<string, unknown>;
  const v = o[key];
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (o.data && typeof o.data === 'object') return deepPickString(o.data, key);
  return undefined;
}

function extractCorrelationIdFromPayload(data: unknown): string | undefined {
  const raw = deepPickString(data, 'correlation_id');
  if (!raw || !UUID_RE.test(raw)) return undefined;
  return raw;
}

function extractPayloadHashFromPayload(data: unknown): string | undefined {
  const raw = deepPickString(data, 'payload_hash_sha256');
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) return undefined;
  return raw.toLowerCase();
}

/**
 * POST /api/workflows/committee-decide
 * Proxy hacia n8n ({N8N_WEBHOOK_BASE}/committee/decide).
 * El backend industrial crea PO/evidencia; el correlation_id para polling viene en la respuesta de n8n.
 */
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    const rfpId = body?.rfp_id;
    const decision = body?.decision;
    const offerId = body?.offer_id;
    const justification = body?.justification;

    if (!rfpId || typeof rfpId !== 'string') {
      return createErrorResponse('rfp_id is required', 400);
    }

    if (!decision || typeof decision !== 'string') {
      return createErrorResponse('decision is required', 400);
    }

    if (decision !== 'approve' && decision !== 'reject') {
      return createErrorResponse('decision must be "approve" or "reject"', 400);
    }

    if (decision === 'approve' && (offerId === undefined || offerId === null || offerId === '')) {
      return createErrorResponse('offer_id is required when decision is "approve"', 400);
    }

    if (!N8N_WEBHOOK_BASE) {
      return createErrorResponse('N8N_WEBHOOK_BASE environment variable is not set', 500);
    }

    const url = `${N8N_WEBHOOK_BASE.replace(/\/$/, '')}/committee/decide`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (N8N_WEBHOOK_TOKEN) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    // V2-09: cuerpo mínimo hacia n8n; offer_id solo si aprueba (V2-10 PO + evidencia).
    const outbound: Record<string, unknown> = {
      rfp_id: rfpId,
      decision,
      justification: justification ?? null,
    };
    if (decision === 'approve' && offerId != null && String(offerId).trim() !== '') {
      outbound.offer_id = offerId;
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(outbound),
    });

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
      console.error('[committee-decide] Error parsing n8n response:', parseErr);
      data = { error: 'Failed to parse response' };
    }

    const requestCorrelation =
      typeof body.correlation_id === 'string' && UUID_RE.test(body.correlation_id)
        ? body.correlation_id
        : undefined;

    if (!response.ok) {
      const errPayload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      const message =
        (typeof errPayload.error === 'string' && errPayload.error) ||
        (typeof errPayload.message === 'string' && errPayload.message) ||
        response.statusText;
      console.error('[committee-decide] n8n error:', message, data);
      return createErrorResponse(
        `n8n workflow failed: ${message}`,
        response.status,
        requestCorrelation
      );
    }

    const correlationFromN8n = extractCorrelationIdFromPayload(data);
    const payloadHashFromN8n = extractPayloadHashFromPayload(data);

    const responsePayload =
      data && typeof data === 'object'
        ? {
            ...(data as Record<string, unknown>),
            ...(correlationFromN8n ? { correlation_id: correlationFromN8n } : {}),
            ...(payloadHashFromN8n ? { payload_hash_sha256: payloadHashFromN8n } : {}),
          }
        : {
            correlation_id: correlationFromN8n,
            payload_hash_sha256: payloadHashFromN8n,
          };

    return createSuccessResponse(responsePayload, response.status, correlationFromN8n);
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows/committee-decide:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
