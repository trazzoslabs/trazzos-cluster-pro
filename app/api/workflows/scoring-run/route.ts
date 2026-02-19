import { NextRequest } from 'next/server';
import { fetchWithTimeout, createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { supabaseServer } from '../../_lib/supabaseServer';

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

    const correlationId = body?.correlation_id;
    const rfpId = body?.rfp_id;

    if (!rfpId) {
      return createErrorResponse('rfp_id is required in request body', 400);
    }

    // 1. Reenviar el body a n8n
    const url = `${N8N_WEBHOOK_BASE}/scoring/weights`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (N8N_WEBHOOK_TOKEN) {
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_TOKEN}`;
    }

    let n8nResponse;
    try {
      console.log(`Calling n8n workflow at: ${url}`);
      console.log('Request body:', JSON.stringify(body, null, 2));
      
      n8nResponse = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body), // Reenvía el body tal cual
      });
      
      console.log(`n8n response status: ${n8nResponse.status} ${n8nResponse.statusText}`);
    } catch (error) {
      console.error('Error calling n8n workflow:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url,
      });
      return createErrorResponse(
        `Failed to connect to n8n workflow at ${url}: ${error instanceof Error ? error.message : 'Unknown error'}. Check N8N_WEBHOOK_BASE environment variable.`,
        502,
        correlationId
      );
    }

    // 2. Capturar la respuesta del webhook como texto
    let resultsJson: any;
    try {
      const raw = await n8nResponse.text();
      
      if (raw.trim() === '') {
        // Si el body está vacío, usar objeto por defecto
        resultsJson = { ok: true, note: "n8n returned empty body" };
        console.log('n8n returned empty body, using default response');
      } else {
        // Intentar parsear como JSON
        try {
          resultsJson = JSON.parse(raw);
          console.log('n8n response parsed as JSON:', JSON.stringify(resultsJson, null, 2));
        } catch (parseError) {
          // Si falla el parse, guardar el raw
          resultsJson = { ok: true, raw: raw };
          console.log('n8n response is not valid JSON, saving as raw:', raw.substring(0, 200));
        }
      }
    } catch (error) {
      console.error('Error reading n8n response:', error);
      // Si falla completamente, usar objeto por defecto
      resultsJson = { ok: true, note: "failed to read n8n response", error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // 3. Si n8n devuelve error HTTP, responder 502 con mensaje claro
    if (!n8nResponse.ok) {
      console.error('n8n workflow HTTP error:', {
        status: n8nResponse.status,
        statusText: n8nResponse.statusText,
        resultsJson,
      });
      const errorMessage = resultsJson.error || resultsJson.message || n8nResponse.statusText || 'n8n workflow failed';
      return createErrorResponse(
        `n8n workflow error (${n8nResponse.status}): ${errorMessage}`,
        502,
        correlationId
      );
    }
    
    console.log('n8n workflow succeeded, results_json:', JSON.stringify(resultsJson, null, 2));

    // 4. Obtener el weights_version_id más reciente para ese rfp_id
    const { data: weightsVersions, error: weightsError } = await supabaseServer
      .from('scoring_weights_versions')
      .select('weights_version_id')
      .eq('rfp_id', rfpId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (weightsError) {
      console.error('Error fetching weights version:', weightsError);
      return createErrorResponse(
        `Failed to fetch weights version: ${weightsError.message}`,
        500,
        correlationId
      );
    }

    const weightsVersionId = weightsVersions?.weights_version_id || null;

    // 5. Insertar una fila en scoring_runs
    const { data: insertedRun, error: insertError } = await supabaseServer
      .from('scoring_runs')
      .insert({
        rfp_id: rfpId,
        weights_version_id: weightsVersionId,
        results_json: resultsJson, // Objeto JSON, no string
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting scoring run:', insertError);
      return createErrorResponse(
        `Failed to insert scoring run: ${insertError.message}`,
        500,
        correlationId
      );
    }

    // 6. Responder con el formato especificado
    return Response.json(
      {
        ok: true,
        weights_version_id: weightsVersionId,
        results_json: resultsJson,
        ...(correlationId && { correlation_id: correlationId }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows/scoring-run:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

