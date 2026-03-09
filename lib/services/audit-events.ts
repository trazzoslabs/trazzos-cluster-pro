/**
 * Servicio de eventos de auditoría. Mantiene correlation_id para trazabilidad.
 * Sin datos en Supabase se retorna [].
 */

import { supabaseServer } from '@/app/api/_lib/supabaseServer';

export interface GetAuditEventsOptions {
  entityId?: string | null;
  correlationId?: string | null;
  companyId?: string | null;
  limit?: number;
}

export async function getAuditEvents(options: GetAuditEventsOptions = {}): Promise<Array<Record<string, unknown>>> {
  const { entityId, correlationId, companyId, limit } = options;

  let query = supabaseServer.from('audit_events').select('*');

  if (entityId) query = query.eq('entity_id', entityId);
  if (correlationId) query = query.eq('correlation_id', correlationId);
  if (companyId) query = query.eq('company_id', companyId);

  const limitValue = limit ?? (!entityId && !correlationId && !companyId ? 50 : undefined);
  if (limitValue) query = query.limit(limitValue);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[audit-events service] Error fetching audit events:', error);
    throw new Error('Failed to fetch audit events');
  }

  return (data ?? []) as Array<Record<string, unknown>>;
}
