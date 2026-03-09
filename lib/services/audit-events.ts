/**
 * Servicio de eventos de auditoría. Mantiene correlation_id para trazabilidad.
 */

import { supabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  getMockAuditEventsData,
  isN8nMockEnabled,
  resolveMockCorrelationId,
} from '@/app/api/_lib/n8nMock';

export interface GetAuditEventsOptions {
  entityId?: string | null;
  correlationId?: string | null;
  companyId?: string | null;
  limit?: number;
}

export async function getAuditEvents(options: GetAuditEventsOptions = {}): Promise<Array<Record<string, unknown>>> {
  const { entityId, correlationId, companyId, limit } = options;
  const mockMode = isN8nMockEnabled();

  let query = supabaseServer.from('audit_events').select('*');

  if (entityId) query = query.eq('entity_id', entityId);
  if (correlationId) query = query.eq('correlation_id', correlationId);
  if (companyId && !mockMode) query = query.eq('company_id', companyId);

  const limitValue = limit ?? (!entityId && !correlationId && !companyId ? 50 : undefined);
  if (limitValue) query = query.limit(limitValue);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[audit-events service] Error fetching audit events:', error);
    throw new Error('Failed to fetch audit events');
  }

  let rows = (data ?? []) as Array<Record<string, unknown>>;

  if (rows.length === 0 && mockMode) {
    const resolvedCorrelationId = resolveMockCorrelationId(correlationId ?? undefined);
    rows = getMockAuditEventsData(resolvedCorrelationId).filter((event) => {
      const entityMatch = entityId ? event.entity_id === entityId : true;
      const correlationMatch = correlationId ? event.correlation_id === correlationId : true;
      return entityMatch && correlationMatch;
    }) as Array<Record<string, unknown>>;
  }

  return rows;
}
