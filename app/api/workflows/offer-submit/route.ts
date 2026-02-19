import { NextRequest } from 'next/server';
import { createErrorResponse } from '../../_lib/http';
import { supabaseServer } from '../../_lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    const correlationId = body?.correlation_id;
    const rfpId = body?.rfp_id;
    const priceTotal = body?.price_total;

    // Validar campos requeridos
    if (!rfpId) {
      return createErrorResponse('rfp_id is required in request body', 400);
    }

    if (priceTotal === undefined || priceTotal === null) {
      return createErrorResponse('price_total is required in request body', 400);
    }

    // Preparar datos para insertar
    const offerData: any = {
      rfp_id: rfpId,
      price_total: priceTotal,
      currency: body?.currency || 'COP',
      status: body?.status || 'submitted',
      submitted_at: new Date().toISOString(),
    };

    // Campos opcionales
    if (body?.supplier_id !== undefined && body?.supplier_id !== null) {
      offerData.supplier_id = body.supplier_id;
    }

    if (body?.lead_time_days !== undefined && body?.lead_time_days !== null) {
      offerData.lead_time_days = body.lead_time_days;
    }

    if (body?.terms_json !== undefined && body?.terms_json !== null) {
      offerData.terms_json = body.terms_json;
    }

    if (body?.attachments_path !== undefined && body?.attachments_path !== null) {
      offerData.attachments_path = body.attachments_path;
    }

    console.log('Inserting offer:', JSON.stringify(offerData, null, 2));

    // Insertar en Supabase
    const { data: insertedOffer, error: insertError } = await supabaseServer
      .from('offers')
      .insert(offerData)
      .select('*')
      .single();

    if (insertError) {
      console.error('Error inserting offer:', insertError);
      return Response.json(
        {
          ok: false,
          error: insertError.message,
          ...(correlationId && { correlation_id: correlationId }),
        },
        { status: 500 }
      );
    }

    console.log('Offer created successfully:', insertedOffer.offer_id);

    // Responder con el formato especificado
    return Response.json(
      {
        ok: true,
        offer: insertedOffer,
        ...(correlationId && { correlation_id: correlationId }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows/offer-submit:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

