import { createHash, randomUUID } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOCK_LATENCY_MS = 1500;

let stickyCorrelationId: string | null = null;
export const MOCK_CLUSTER_ID = 'c1057e40-aaaa-4bbb-8ccc-111111111111';
export const MOCK_SYNERGY_ID = 'de5d13d0-aaaa-4bbb-8ccc-222222222222';
export const MOCK_CORRELATION_ID = '9f5f7f8a-aaaa-4bbb-8ccc-555555555555';
export const MOCK_SYNERGY_ID_2 = '6d0ec3d3-aaaa-4bbb-8ccc-666666666666';
export const MOCK_SYNERGY_ID_3 = '0a98d75c-aaaa-4bbb-8ccc-777777777777';
export const MOCK_SYNERGY_ID_4 = '4f2cf4b9-aaaa-4bbb-8ccc-888888888888';
export const MOCK_RFP_ID = 'f9c2f2d8-aaaa-4bbb-8ccc-333333333333'; // Lubricantes (activo)
export const MOCK_RFP_ID_SUCCESS = '4f9c31ea-aaaa-4bbb-8ccc-999999999999'; // Rodamientos (adjudicado)
export const MOCK_RFP_ID_3 = '7b6489d1-bbbb-4ccc-8ddd-101010101010'; // Valvulas (detected)
export const MOCK_OFFER_ID = 'a7be1b75-aaaa-4bbb-8ccc-444444444444';
export const MOCK_OFFER_ID_2 = 'd3adf0b0-aaaa-4bbb-8ccc-121212121212';
export const MOCK_OFFER_ID_3 = 'c17d9864-aaaa-4bbb-8ccc-131313131313';

export const COMPANY_REFICAR = 'COMPANY_001';
export const COMPANY_YARA = 'COMPANY_002';
export const COMPANY_ARGOS = 'COMPANY_003';
export const COMPANY_AJOVER = 'COMPANY_004';
export const COMPANY_ESENTTIA = 'COMPANY_005';
export const COMPANY_CABOT = 'COMPANY_006';

/** Siempre false: validación con backend real (Supabase/n8n). No se inyectan datos de prueba. */
export function isN8nMockEnabled(): boolean {
  return false;
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
      price_efficiency: 0.97,
      delivery_efficiency: 0.96,
      overall_efficiency: 0.97,
      generated_at: nowIso,
      supplier_ranking: [
        {
          offer_id: MOCK_OFFER_ID,
          supplier_name: 'Proveedor Atlas Bearings',
          price_efficiency: 0.97,
          delivery_efficiency: 0.95,
          total_score: 0.96,
          status: 'offer_received',
        },
        {
          offer_id: MOCK_OFFER_ID_2,
          supplier_name: 'Proveedor Orion LubeTech',
          price_efficiency: 0.95,
          delivery_efficiency: 0.97,
          total_score: 0.96,
          status: 'offer_received',
        },
        {
          offer_id: MOCK_OFFER_ID_3,
          supplier_name: 'Proveedor Sigma Flow',
          price_efficiency: 0.93,
          delivery_efficiency: 0.94,
          total_score: 0.94,
          status: 'offer_received',
        },
      ],
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
      item_category: 'Rodamientos de Alta Precision',
      ...mkWindow(-14, -2),
      companies_involved_json: [
        { company_id: COMPANY_REFICAR, company_name: 'Reficar' },
        { company_id: COMPANY_ARGOS, company_name: 'Argos' },
        { company_id: COMPANY_ESENTTIA, company_name: 'Esenttia' },
      ],
      volume_total_json: {
        total: 18600,
        unit: 'UN',
        consolidated_volume: 18600,
        estimated_savings_pct: 19,
        items: [
          'Rodamientos de alta precision',
          'Rodamientos axiales',
          'Sellos industriales',
        ],
      },
      status: 'approved',
      lifecycle_status: 'completed',
      score_relevancia: 0.97,
      created_at: now,
      updated_at: now,
    },
    {
      synergy_id: MOCK_SYNERGY_ID_2,
      cluster_id: MOCK_CLUSTER_ID,
      item_category: 'Lubricantes Industriales',
      ...mkWindow(-3, 18),
      companies_involved_json: [
        { company_id: COMPANY_YARA, company_name: 'Yara' },
        { company_id: COMPANY_CABOT, company_name: 'Cabot' },
      ],
      volume_total_json: {
        total: 12100,
        unit: 'L',
        consolidated_volume: 12100,
        estimated_savings_pct: 12,
        items: [
          'Lubricante sintetico alta temperatura',
          'Grasa industrial EP2',
          'Aditivos antidesgaste',
        ],
      },
      status: 'rfp_open',
      score_relevancia: 0.93,
      created_at: now,
      updated_at: now,
    },
    {
      synergy_id: MOCK_SYNERGY_ID_4,
      cluster_id: MOCK_CLUSTER_ID,
      item_category: 'Valvulas y Actuadores',
      ...mkWindow(-1, 24),
      companies_involved_json: [
        { company_id: COMPANY_REFICAR, company_name: 'Reficar' },
        { company_id: COMPANY_AJOVER, company_name: 'Ajover' },
      ],
      volume_total_json: {
        total: 7800,
        unit: 'UN',
        consolidated_volume: 7800,
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
  const openClosingAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const closedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      rfp_id: MOCK_RFP_ID_SUCCESS,
      synergy_id: MOCK_SYNERGY_ID,
      status: 'completed',
      published_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      closing_at: closedAt,
      rfp_pack_path: `https://mock-s3.trazzos.local/rfp-pack/${MOCK_RFP_ID_SUCCESS}.pdf`,
      created_by_user_id: null,
    },
    {
      rfp_id: MOCK_RFP_ID,
      synergy_id: MOCK_SYNERGY_ID_2,
      status: 'open',
      published_at: now.toISOString(),
      closing_at: openClosingAt,
      rfp_pack_path: `https://mock-s3.trazzos.local/rfp-pack/${MOCK_RFP_ID}.pdf`,
      created_by_user_id: null,
    },
    {
      rfp_id: MOCK_RFP_ID_3,
      synergy_id: MOCK_SYNERGY_ID_4,
      status: 'draft',
      published_at: null,
      closing_at: openClosingAt,
      rfp_pack_path: null,
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
      price_total: 172000000,
      currency: 'COP',
      lead_time_days: 19,
      terms_json: {
        notes: 'Oferta activa para Lubricantes Industriales',
      },
      attachments_path: null,
      status: 'submitted',
      submitted_at: now,
    },
    {
      offer_id: MOCK_OFFER_ID_2,
      rfp_id: MOCK_RFP_ID,
      supplier_id: null,
      price_total: 168500000,
      currency: 'COP',
      lead_time_days: 21,
      terms_json: {
        notes: 'Oferta recibida - condiciones comerciales ajustadas',
      },
      attachments_path: null,
      status: 'submitted',
      submitted_at: now,
    },
    {
      offer_id: MOCK_OFFER_ID_3,
      rfp_id: MOCK_RFP_ID,
      supplier_id: null,
      price_total: 176200000,
      currency: 'COP',
      lead_time_days: 17,
      terms_json: {
        notes: 'Oferta recibida - mejor tiempo de entrega',
      },
      attachments_path: null,
      status: 'submitted',
      submitted_at: now,
    },
  ];
}

export function getMockAuditEventsData(correlationId: string) {
  const now = Date.now();
  const poPayload = {
    po_id: 'PO-MOCK-0001',
    rfp_id: MOCK_RFP_ID_SUCCESS,
    supplier_awarded: 'Proveedor Atlas Bearings',
    approved_by: ['Reficar', 'Argos', 'Esenttia'],
    generated_at: new Date(now - 60 * 1000).toISOString(),
  };
  const poPayloadHash = buildMockPayloadHash(poPayload);

  return [
    {
      event_id: randomUUID(),
      correlation_id: correlationId,
      event_type: 'RFP_OPENED',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: COMPANY_YARA,
      entity_type: 'rfp',
      entity_id: MOCK_RFP_ID,
      summary: 'Yara y Cabot abrieron RFP para Lubricantes Industriales',
      payload_hash_sha256: buildMockPayloadHash({
        type: 'RFP_OPENED',
        rfp_id: MOCK_RFP_ID,
      }),
      created_at: new Date(now - 5 * 60 * 1000).toISOString(),
    },
    {
      event_id: randomUUID(),
      correlation_id: correlationId,
      event_type: 'OFFER_RECEIVED',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: COMPANY_CABOT,
      entity_type: 'offer',
      entity_id: MOCK_OFFER_ID,
      summary: 'Cabot recibio ranking activo con 3 ofertas para Lubricantes Industriales',
      payload_hash_sha256: buildMockPayloadHash({
        type: 'OFFER_RECEIVED',
        rfp_id: MOCK_RFP_ID,
        offer_id: MOCK_OFFER_ID,
      }),
      created_at: new Date(now - 4 * 60 * 1000).toISOString(),
    },
    {
      event_id: randomUUID(),
      correlation_id: correlationId,
      event_type: 'SYNERGY_ACTIVITY',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: COMPANY_ARGOS,
      entity_type: 'synergy',
      entity_id: MOCK_SYNERGY_ID,
      summary: 'Argos se unio a la sinergia de Rodamientos de Alta Precision',
      payload_hash_sha256: buildMockPayloadHash({
        type: 'SYNERGY_ACTIVITY',
        company: 'Argos',
        synergy_id: MOCK_SYNERGY_ID,
      }),
      created_at: new Date(now - 3 * 60 * 1000).toISOString(),
    },
    {
      event_id: randomUUID(),
      correlation_id: correlationId,
      event_type: 'COMMITTEE_APPROVED',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: COMPANY_ESENTTIA,
      entity_type: 'rfp',
      entity_id: MOCK_RFP_ID_SUCCESS,
      summary: 'Esenttia aprobo la decision del comite para Rodamientos de Alta Precision',
      payload_hash_sha256: buildMockPayloadHash({
        type: 'COMMITTEE_APPROVED',
        company: 'Esenttia',
        rfp_id: MOCK_RFP_ID_SUCCESS,
      }),
      created_at: new Date(now - 2 * 60 * 1000).toISOString(),
    },
    {
      event_id: randomUUID(),
      correlation_id: correlationId,
      event_type: 'PO_SIMULATED',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: COMPANY_REFICAR,
      entity_type: 'purchase_order',
      entity_id: MOCK_RFP_ID_SUCCESS,
      summary: 'PO generada para Rodamientos de Alta Precision con evidencia inmutable (Reficar, Argos, Esenttia)',
      payload_hash_sha256: poPayloadHash,
      created_at: new Date(now - 60 * 1000).toISOString(),
    },
    {
      event_id: randomUUID(),
      correlation_id: correlationId,
      event_type: 'PO_GENERATED_WITH_EVIDENCE',
      actor_user_id: null,
      actor_role: 'cluster_admin',
      company_id: COMPANY_REFICAR,
      entity_type: 'purchase_order',
      entity_id: MOCK_RFP_ID_SUCCESS,
      summary: 'Orden de compra adjudicada y anclada a hash SHA-256 verificable',
      payload_hash_sha256: poPayloadHash,
      created_at: new Date(now - 30 * 1000).toISOString(),
    },
  ];
}

export function getMockNeedsData() {
  const now = new Date().toISOString();
  const categories = [
    'Rodamientos de Alta Precision',
    'Lubricantes Industriales',
    'Valvulas y Actuadores',
    'Sellos Industriales',
  ];

  const baseNeeds = [
    'Rodamiento 6205 ZZ',
    'Rodamiento 6312 C3',
    'Kit de sellos para rodamientos',
    'Lubricante sintetico ISO VG 220',
    'Grasa de litio alta temperatura',
    'Aditivo anti-friccion industrial',
    'Valvula globo 2 pulgadas',
    'Valvula mariposa 4 pulgadas',
    'Actuador neumatico doble efecto',
    'Posicionador electro-neumatico',
    'Kit de mantenimiento de actuadores',
    'Sello mecanico tipo cartridge',
    'Empaque espiralado para bombas',
    'Rodamiento axial 51108',
    'Lubricante grado alimenticio NSF',
    'Kit de valvula de alivio',
    'Actuador electrico industrial',
    'Sello de labio NBR',
    'Acople elastico industrial',
    'Kit de retenedores de eje',
  ];

  return baseNeeds.map((description, index) => {
    const category = categories[index % categories.length];
    const companyIdPool = [
      COMPANY_REFICAR,
      COMPANY_YARA,
      COMPANY_ARGOS,
      COMPANY_AJOVER,
      COMPANY_ESENTTIA,
      COMPANY_CABOT,
    ];
    const companyId = companyIdPool[index % companyIdPool.length];
    return {
      need_id: `NEED_${String(index + 1).padStart(3, '0')}`,
      company_id: companyId,
      cluster_id: MOCK_CLUSTER_ID,
      item_category: category,
      description,
      quantity: 40 + index * 6,
      unit: ['UN', 'L', 'KIT'][index % 3],
      priority: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low',
      status: 'consolidated',
      created_at: now,
      updated_at: now,
    };
  });
}
