import { NextRequest } from 'next/server';
import { createErrorResponse } from '../../_lib/http';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

// Validar UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Generar SHA256 hash
function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    const rfpId = body?.rfp_id;
    const decision = body?.decision;
    const offerId = body?.offer_id;
    const justification = body?.justification;
    const decidedByUserId = body?.decided_by_user_id;
    const actorRole = body?.actor_role || 'committee';
    const companyId = body?.company_id;
    const correlationIdInput = body?.correlation_id;

    // Validar campos requeridos
    if (!rfpId) {
      return createErrorResponse('rfp_id is required', 400);
    }

    if (!decision) {
      return createErrorResponse('decision is required', 400);
    }

    if (decision !== 'approve' && decision !== 'reject') {
      return createErrorResponse('decision must be "approve" or "reject"', 400);
    }

    if (decision === 'approve' && !offerId) {
      return createErrorResponse('offer_id is required when decision is "approve"', 400);
    }

    // Generar correlation_id
    let correlationId: string;
    if (correlationIdInput && isValidUUID(correlationIdInput)) {
      correlationId = correlationIdInput;
    } else {
      correlationId = randomUUID();
    }

    const decidedAt = new Date().toISOString();

    // 1. Insertar en committee_decisions
    const decisionData: any = {
      rfp_id: rfpId,
      decision: decision,
      decided_at: decidedAt,
    };

    if (justification !== undefined && justification !== null) {
      decisionData.justification = justification;
    }

    if (decidedByUserId !== undefined && decidedByUserId !== null) {
      decisionData.decided_by_user_id = decidedByUserId;
    }

    const { data: decisionRow, error: decisionError } = await supabaseServer
      .from('committee_decisions')
      .insert(decisionData)
      .select('*')
      .single();

    if (decisionError) {
      console.error('Error inserting committee decision:', decisionError);
      return Response.json(
        { ok: false, error: `Failed to insert committee decision: ${decisionError.message}` },
        { status: 500 }
      );
    }

    // 2. Insertar audit_events para la decisión
    const decisionPayload = {
      rfp_id: rfpId,
      offer_id: offerId || null,
      decision: decision,
      justification: justification || null,
      decided_by_user_id: decidedByUserId || null,
      decided_at: decidedAt,
    };

    const decisionPayloadHash = sha256(JSON.stringify(decisionPayload));

    const auditDecisionData: any = {
      correlation_id: correlationId,
      event_type: 'committee_decision_recorded',
      entity_type: 'rfp',
      entity_id: rfpId,
      summary: `Committee decision: ${decision}`,
      payload_hash_sha256: decisionPayloadHash,
      created_at: decidedAt,
    };

    if (decidedByUserId !== undefined && decidedByUserId !== null) {
      auditDecisionData.actor_user_id = decidedByUserId;
    }

    if (actorRole) {
      auditDecisionData.actor_role = actorRole;
    }

    if (companyId !== undefined && companyId !== null) {
      auditDecisionData.company_id = companyId;
    }

    const { error: auditDecisionError } = await supabaseServer
      .from('audit_events')
      .insert(auditDecisionData);

    if (auditDecisionError) {
      console.error('Error inserting audit event for decision:', auditDecisionError);
      // No fallar, solo loguear
    }

    // 3. Si decision !== "approve", responder
    if (decision !== 'approve') {
      return Response.json(
        {
          ok: true,
          decision: decisionRow,
          purchase_order: null,
          evidence: null,
          correlation_id: correlationId,
        },
        { status: 200 }
      );
    }

    // 4. Si decision === "approve", crear PO y evidence
    // a) Insertar en purchase_orders
    const poData = {
      rfp_id: rfpId,
      offer_id: offerId,
      status: 'created',
      po_document_path: null,
      evidence_id: null,
      created_at: decidedAt,
    };

    const { data: purchaseOrderRow, error: poError } = await supabaseServer
      .from('purchase_orders')
      .insert(poData)
      .select('*')
      .single();

    if (poError) {
      console.error('Error inserting purchase order:', poError);
      return Response.json(
        { ok: false, error: `Failed to insert purchase order: ${poError.message}` },
        { status: 500 }
      );
    }

    // b) Crear evidence_records
    const evidencePayload = {
      decision_row: decisionRow,
      purchase_order_row: purchaseOrderRow,
    };

    const evidencePayloadHash = sha256(JSON.stringify(evidencePayload));

    const evidenceData = {
      entity_type: 'purchase_order',
      entity_id: purchaseOrderRow.po_id,
      payload_hash_sha256: evidencePayloadHash,
      tx_hash: null,
      created_at: decidedAt,
    };

    const { data: evidenceRow, error: evidenceError } = await supabaseServer
      .from('evidence_records')
      .insert(evidenceData)
      .select('*')
      .single();

    if (evidenceError) {
      console.error('Error inserting evidence record:', evidenceError);
      return Response.json(
        { ok: false, error: `Failed to insert evidence record: ${evidenceError.message}` },
        { status: 500 }
      );
    }

    // c) Actualizar purchase_orders con evidence_id
    const { data: updatedPORow, error: updatePOError } = await supabaseServer
      .from('purchase_orders')
      .update({ evidence_id: evidenceRow.evidence_id })
      .eq('po_id', purchaseOrderRow.po_id)
      .select('*')
      .single();

    if (updatePOError) {
      console.error('Error updating purchase order with evidence_id:', updatePOError);
      return Response.json(
        { ok: false, error: `Failed to update purchase order: ${updatePOError.message}` },
        { status: 500 }
      );
    }

    // d) Insertar audit_events para PO creado
    const auditPOData: any = {
      correlation_id: correlationId,
      event_type: 'purchase_order_created',
      entity_type: 'purchase_order',
      entity_id: purchaseOrderRow.po_id,
      summary: 'Purchase order created',
      payload_hash_sha256: evidencePayloadHash,
      created_at: decidedAt,
    };

    if (decidedByUserId !== undefined && decidedByUserId !== null) {
      auditPOData.actor_user_id = decidedByUserId;
    }

    if (actorRole) {
      auditPOData.actor_role = actorRole;
    }

    if (companyId !== undefined && companyId !== null) {
      auditPOData.company_id = companyId;
    }

    const { error: auditPOError } = await supabaseServer
      .from('audit_events')
      .insert(auditPOData);

    if (auditPOError) {
      console.error('Error inserting audit event for PO:', auditPOError);
      // No fallar, solo loguear
    }

    // Responder con éxito
    return Response.json(
      {
        ok: true,
        decision: decisionRow,
        purchase_order: updatedPORow,
        evidence: evidenceRow,
        correlation_id: correlationId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows/committee-decide:', error);
    return Response.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

