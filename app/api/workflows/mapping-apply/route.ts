import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;

export async function POST(request: NextRequest) {
  try {
    if (!N8N_WEBHOOK_BASE) {
      return createErrorResponse('N8N_WEBHOOK_BASE environment variable is not set', 500);
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    const { job_id, mapping, correlation_id } = body;

    if (!job_id) {
      return createErrorResponse('job_id is required in request body', 400);
    }

    if (!mapping || typeof mapping !== 'object') {
      return createErrorResponse('mapping (object) is required in request body', 400);
    }

    const url = `${N8N_WEBHOOK_BASE}/api/mapping/apply`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (N8N_WEBHOOK_TOKEN) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    const payload = {
      job_id,
      mapping,
      correlation_id: correlation_id || null,
    };

    console.log('Calling n8n mapping-apply workflow:', url);
    console.log('Request body:', JSON.stringify(payload, null, 2));

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

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
      console.error('Error parsing n8n response:', error);
      data = { error: 'Failed to parse response' };
    }

    if (!response.ok) {
      console.error('n8n error:', data);
      return createErrorResponse(
        `n8n workflow failed: ${data.error || data.message || response.statusText}`,
        response.status,
        correlation_id
      );
    }

    return createSuccessResponse(data, response.status, correlation_id);
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows/mapping-apply:', error);
    return createErrorResponse('Internal server error', 500);
  }
}





