import { createHash, randomUUID } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOCK_LATENCY_MS = 1500;

let stickyCorrelationId: string | null = null;

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

  stickyCorrelationId = randomUUID();
  return stickyCorrelationId;
}

export function buildMockPayloadHash(seed: unknown): string {
  return createHash('sha256').update(JSON.stringify(seed)).digest('hex');
}

export function buildMockRfpOpenResponse(body: any, correlationId: string) {
  const now = new Date();
  const closingAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const rfpId = randomUUID();

  return {
    ok: true,
    rfp_id: rfpId,
    synergy_id: body?.synergy_id ?? null,
    status: 'open',
    published_at: now.toISOString(),
    closing_at: closingAt.toISOString(),
    rfp_pack_path: `https://mock-s3.trazzos.local/rfp-pack/${rfpId}.pdf`,
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
