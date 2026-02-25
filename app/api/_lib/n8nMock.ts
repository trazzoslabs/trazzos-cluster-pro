import { createHash, randomUUID } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOCK_LATENCY_MS = 1500;

let stickyCorrelationId: string | null = null;
export const MOCK_CLUSTER_ID = 'c1057e40-aaaa-4bbb-8ccc-111111111111';
export const MOCK_SYNERGY_ID = 'de5d13d0-aaaa-4bbb-8ccc-222222222222';
export const MOCK_RFP_ID = 'f9c2f2d8-aaaa-4bbb-8ccc-333333333333';
export const MOCK_OFFER_ID = 'a7be1b75-aaaa-4bbb-8ccc-444444444444';
export const MOCK_CORRELATION_ID = '9f5f7f8a-aaaa-4bbb-8ccc-555555555555';
export const MOCK_SYNERGY_ID_2 = '6d0ec3d3-aaaa-4bbb-8ccc-666666666666';
export const MOCK_SYNERGY_ID_3 = '0a98d75c-aaaa-4bbb-8ccc-777777777777';
export const MOCK_SYNERGY_ID_4 = '4f2cf4b9-aaaa-4bbb-8ccc-888888888888';

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
  const day = 24 * 60 * 60 * 1000;
  const mkWindow = (startDeltaDays: number, endDeltaDays: number) => ({
    window_start: new Date(Date.now() + startDeltaDays * day).toISOString(),
    window_end: new Date(Date.now() + endDeltaDays * day).toISOString(),
  });

  return [
    {
      synergy_id: MOCK_SYNERGY_ID,
      cluster_id: MOCK_CLUSTER_ID,
      item_category: 'Rodamientos Industriales - Proyecto Cluster',
      ...mkWindow(-2, 12),
      companies_involved_json: [
        { company_id: 'COMPANY_001', company_name: 'Minera A' },
        { company_id: 'COMPANY_002', company_name: 'Cementera B' },
      ],
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
      score_relevancia: 0.98,
      created_at: now,
      updated_at: now,
    },
    {
      synergy_id: MOCK_SYNERGY_ID_2,
      cluster_id: MOCK_CLUSTER_ID,
      item_category: 'Lubricantes de Alta Temperatura',
      ...mkWindow(-5, 20),
      companies_involved_json: [
        { company_id: 'COMPANY_003', company_name: 'Suministros Industriales SA' },
        { company_id: 'COMPANY_004', company_name: 'Energia C' },
      ],
      volume_total_json: {
        total: 9400,
        unit: 'L',
        consolidated_volume: 9400,
        estimated_savings_pct: 12,
        items: [
          'Lubricante sintetico alta temperatura',
          'Grasa industrial EP2',
          'Aditivos antidesgaste',
        ],
      },
      status: 'detected',
      score_relevancia: 0.91,
      created_at: now,
      updated_at: now,
    },
    {
      synergy_id: MOCK_SYNERGY_ID_3,
      cluster_id: MOCK_CLUSTER_ID,
      item_category: 'EPP y Seguridad Industrial',
      ...mkWindow(-18, -2),
      companies_involved_json: [
        { company_id: 'COMPANY_005', company_name: 'Petroquimica D' },
        { company_id: 'COMPANY_006', company_name: 'Acero E' },
      ],
      volume_total_json: {
        total: 15300,
        unit: 'KIT',
        consolidated_volume: 15300,
        estimated_savings_pct: 22,
        items: [
          'Cascos dielctricos',
          'Guantes anti-corte',
          'Arneses de seguridad',
        ],
      },
      status: 'completed',
      score_relevancia: 0.75,
      created_at: now,
      updated_at: now,
    },
    {
      synergy_id: MOCK_SYNERGY_ID_4,
      cluster_id: MOCK_CLUSTER_ID,
      item_category: 'Valvulas y Actuadores',
      ...mkWindow(-1, 16),
      companies_involved_json: [
        { company_id: 'COMPANY_007', company_name: 'Operaciones F' },
        { company_id: 'COMPANY_008', company_name: 'Refineria G' },
      ],
      volume_total_json: {
        total: 6200,
        unit: 'UN',
        consolidated_volume: 6200,
        estimated_savings_pct: 18,
        items: [
          'Valvulas de control',
          'Actuadores neumaticos',
          'Kits de mantenimiento',
        ],
      },
      status: 'rfp_open',
      score_relevancia: 0.86,
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
      event_type: 'VALIDACION_INTEGRIDAD',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: 'COMPANY_005',
      entity_type: 'synergy',
      entity_id: MOCK_SYNERGY_ID_3,
      summary: 'Validacion de Integridad completada para EPP y Seguridad Industrial',
      payload_hash_sha256: buildMockPayloadHash({
        type: 'VALIDACION_INTEGRIDAD',
        synergy_id: MOCK_SYNERGY_ID_3,
      }),
      created_at: new Date(now - 20 * 1000).toISOString(),
    },
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
      event_type: 'MAPEO_HEURISTICO_EXITOSO',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: 'COMPANY_003',
      entity_type: 'synergy',
      entity_id: MOCK_SYNERGY_ID_2,
      summary: 'Mapeo Heuristico exitoso para Lubricantes de Alta Temperatura',
      payload_hash_sha256: buildMockPayloadHash({
        type: 'MAPEO_HEURISTICO_EXITOSO',
        synergy_id: MOCK_SYNERGY_ID_2,
      }),
      created_at: new Date(now - 90 * 1000).toISOString(),
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

export function getMockNeedsData() {
  const now = new Date().toISOString();
  const categories = [
    'Rodamientos Industriales - Proyecto Cluster',
    'Lubricantes de Alta Temperatura',
    'EPP y Seguridad Industrial',
    'Valvulas y Actuadores',
  ];

  const baseNeeds = [
    'Rodamiento 6205 ZZ',
    'Rodamiento 6312 C3',
    'Kit de sellos para rodamientos',
    'Lubricante sintetico ISO VG 220',
    'Grasa de litio alta temperatura',
    'Aditivo anti-friccion industrial',
    'Casco de seguridad clase E',
    'Guantes anti-corte nivel 5',
    'Gafas de seguridad anti-impacto',
    'Arnes de cuerpo completo',
    'Valvula globo 2 pulgadas',
    'Valvula mariposa 4 pulgadas',
    'Actuador neumatico doble efecto',
    'Posicionador electro-neumatico',
    'Kit de mantenimiento de actuadores',
  ];

  return baseNeeds.map((description, index) => {
    const category = categories[index % categories.length];
    const companyCode = String((index % 8) + 1).padStart(3, '0');
    return {
      need_id: `NEED_${String(index + 1).padStart(3, '0')}`,
      company_id: `COMPANY_${companyCode}`,
      cluster_id: MOCK_CLUSTER_ID,
      item_category: category,
      description,
      quantity: 50 + index * 7,
      unit: ['UN', 'L', 'KIT'][index % 3],
      priority: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low',
      status: 'consolidated',
      created_at: now,
      updated_at: now,
    };
  });
}
