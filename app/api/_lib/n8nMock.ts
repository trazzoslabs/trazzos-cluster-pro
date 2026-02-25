import { createHash, randomUUID } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOCK_LATENCY_MS = 1500;

let stickyCorrelationId: string | null = null;
export const MOCK_CLUSTER_ID = 'c1057e40-aaaa-4bbb-8ccc-111111111111';
export const MOCK_SYNERGY_ID = 'de5d13d0-aaaa-4bbb-8ccc-222222222222';
export const MOCK_RFP_ID = 'f9c2f2d8-aaaa-4bbb-8ccc-333333333333';
export const MOCK_OFFER_ID = 'a7be1b75-aaaa-4bbb-8ccc-444444444444';
export const MOCK_CORRELATION_ID = '9f5f7f8a-aaaa-4bbb-8ccc-555555555555';

export function isN8nMockEnabled(): boolean {
  // Default ON for prototype navigation; set N8N_MOCK_MODE=false to disable.
  return process.env.N8N_MOCK_MODE !== 'false';
}

export async function waitForMockLatency(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

export function resolveMockCorrelationId(input?: string): string {
  if (input && UUID_RE.test(input)) {
    stickyCorrelationId = input;
    return input;
  }

  if (stickyCorrelationId) {
    return stickyCorrelationId;
  }

  stickyCorrelationId = MOCK_CORRELATION_ID;
  return stickyCorrelationId;
}

export function buildMockPayloadHash(seed: unknown): string {
  return createHash('sha256').update(JSON.stringify(seed)).digest('hex');
}

export function buildMockRfpOpenResponse(body: any, correlationId: string) {
  const now = new Date();
  const closingAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return {
    ok: true,
    rfp_id: MOCK_RFP_ID,
    synergy_id: body?.synergy_id ?? MOCK_SYNERGY_ID,
    status: 'open',
    published_at: now.toISOString(),
    closing_at: closingAt.toISOString(),
    rfp_pack_path: `https://mock-s3.trazzos.local/rfp-pack/${MOCK_RFP_ID}.pdf`,
    correlation_id: correlationId,
  };
}

export function buildMockScoringWeightsResponse(body: any, correlationId: string) {
  const nowIso = new Date().toISOString();

  return {
    ok: true,
    rfp_id: body?.rfp_id ?? null,
    ranking: {
      price_efficiency: 0.99,
      delivery_efficiency: 0.98,
      overall_efficiency: 0.99,
      generated_at: nowIso,
    },
    correlation_id: correlationId,
  };
}

export function getMockSynergiesData() {
  const now = new Date().toISOString();
  const windowStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      synergy_id: MOCK_SYNERGY_ID,
      cluster_id: MOCK_CLUSTER_ID,
      item_category: 'Rodamientos Industriales - Proyecto Cluster',
      window_start: windowStart,
      window_end: windowEnd,
      companies_involved_json: ['Empresa A', 'Empresa B', 'Empresa C'],
      volume_total_json: {
        total: 12800,
        unit: 'UN',
        consolidated_volume: 12800,
        estimated_savings_pct: 15,
        items: [
          'Rodamientos de alta precision',
          'Lubricantes industriales',
          'Sellos industriales',
        ],
      },
      status: 'rfp_open',
      created_at: now,
      updated_at: now,
    },
  ];
}

export function getMockRfpsData() {
  const now = new Date();
  const publishedAt = now.toISOString();
  const closingAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      rfp_id: MOCK_RFP_ID,
      synergy_id: MOCK_SYNERGY_ID,
      status: 'open',
      published_at: publishedAt,
      closing_at: closingAt,
      rfp_pack_path: `https://mock-s3.trazzos.local/rfp-pack/${MOCK_RFP_ID}.pdf`,
      created_by_user_id: null,
    },
  ];
}

export function getMockOffersData() {
  const now = new Date().toISOString();
  return [
    {
      offer_id: MOCK_OFFER_ID,
      rfp_id: MOCK_RFP_ID,
      supplier_id: null,
      price_total: 185000000,
      currency: 'COP',
      lead_time_days: 18,
      terms_json: {
        notes: 'Oferta mock para prototipo de Rodamientos Industriales',
      },
      attachments_path: null,
      status: 'submitted',
      submitted_at: now,
    },
  ];
}

export function getMockAuditEventsData(correlationId: string) {
  const now = Date.now();
  return [
    {
      event_id: randomUUID(),
      correlation_id: correlationId,
      event_type: 'PO_SIMULATED',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: null,
      entity_type: 'purchase_order',
      entity_id: MOCK_RFP_ID,
      summary: 'PO_SIMULATED con evidencia inmutable generada',
      payload_hash_sha256: buildMockPayloadHash({
        type: 'PO_SIMULATED',
        rfp_id: MOCK_RFP_ID,
        offer_id: MOCK_OFFER_ID,
      }),
      created_at: new Date(now - 60 * 1000).toISOString(),
    },
    {
      event_id: randomUUID(),
      correlation_id: correlationId,
      event_type: 'OFFER_RECEIVED',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: null,
      entity_type: 'offer',
      entity_id: MOCK_OFFER_ID,
      summary: 'OFFER_RECEIVED con hash de integridad',
      payload_hash_sha256: buildMockPayloadHash({
        type: 'OFFER_RECEIVED',
        offer_id: MOCK_OFFER_ID,
      }),
      created_at: new Date(now - 2 * 60 * 1000).toISOString(),
    },
    {
      event_id: randomUUID(),
      correlation_id: correlationId,
      event_type: 'RFP_OPENED',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: null,
      entity_type: 'rfp',
      entity_id: MOCK_RFP_ID,
      summary: 'RFP_OPENED por actor cluster_admin',
      payload_hash_sha256: buildMockPayloadHash({
        type: 'RFP_OPENED',
        rfp_id: MOCK_RFP_ID,
      }),
      created_at: new Date(now - 3 * 60 * 1000).toISOString(),
    },
  ];
}
