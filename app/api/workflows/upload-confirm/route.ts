import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;
const N8N_WEBHOOK_TOKEN = process.env.N8N_WEBHOOK_TOKEN;

/**
 * Renombra campos de salida de n8n al esquema de Supabase:
 *   companies_involved  → companies_involved_json
 *   volume_total        → volume_total_json
 * Funciona recursivamente en objetos y arrays.
 */
function mapN8nFields(obj: any): any {
  if (Array.isArray(obj)) return obj.map(mapN8nFields);
  if (obj === null || typeof obj !== 'object') return obj;

  const RENAMES: Record<string, string> = {
    companies_involved: 'companies_involved_json',
    volume_total: 'volume_total_json',
  };

  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const newKey = RENAMES[key] ?? key;
    out[newKey] = (typeof val === 'object' && val !== null) ? mapN8nFields(val) : val;
  }
  return out;
}

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

    const correlationId = body?.correlation_id;

    const url = `${N8N_WEBHOOK_BASE}/api/upload/confirm`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (N8N_WEBHOOK_TOKEN) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();
      
      console.log('[upload-confirm] Response status:', response.status);
      console.log('[upload-confirm] Response content-type:', contentType);
      console.log('[upload-confirm] Response text length:', responseText?.length || 0);
      
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

    // Verificar que data tenga contenido válido
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0 && !data.message)) {
      console.warn('[upload-confirm] Data vacío después del parseo');
      return createErrorResponse(
        'n8n workflow failed: No item to return was found - El resultado está vacío',
        response.status,
        correlationId
      );
    }

    // Mapear campos de salida de n8n al esquema de Supabase
    const mapped = mapN8nFields(data);

    return createSuccessResponse(mapped, response.status, correlationId);
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows/upload-confirm:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

