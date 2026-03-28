/**
 * Consultas a evidence_records (PO vs purchase_order, normalización de hashes sandbox).
 */

import { supabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  CANONICAL_PURCHASE_ORDER_ENTITY_TYPE,
  normalizeEntityType,
} from '@/lib/utils/normalization';

/** Valores posibles en DB para la misma entidad (consulta IN). */
export const PURCHASE_ORDER_EVIDENCE_ENTITY_TYPES = ['PO', 'purchase_order'] as const;

export type NormalizedEvidenceRecord = Record<string, unknown> & {
  tx_hash: string | null;
  simulated_transaction_hash?: string | null;
  is_sandbox_transaction: boolean;
  /** Tipo de entidad canónico (p. ej. purchase_order). */
  entity_type_normalized: string;
};

/**
 * Expone un único tx_hash de lectura y marca si proviene del flujo sandbox.
 */
export function normalizeEvidenceRecord(row: Record<string, unknown>): NormalizedEvidenceRecord {
  const tx =
    typeof row.tx_hash === 'string' && row.tx_hash.trim() ? row.tx_hash.trim() : '';
  const sim =
    typeof row.simulated_transaction_hash === 'string' && row.simulated_transaction_hash.trim()
      ? row.simulated_transaction_hash.trim()
      : '';

  const effectiveTx = tx || sim || null;
  const isSandbox = Boolean(sim);
  const entity_type_normalized = normalizeEntityType(String(row.entity_type ?? ''));

  return {
    ...row,
    tx_hash: effectiveTx,
    is_sandbox_transaction: isSandbox,
    entity_type_normalized,
  };
}

export async function queryEvidenceRecords(
  entityType: string,
  entityId: string,
): Promise<{ data: NormalizedEvidenceRecord[]; error: Error | null }> {
  const id = entityId.trim();
  if (!id) {
    return { data: [], error: new Error('entity_id vacío') };
  }

  let query = supabaseServer.from('evidence_records').select('*').eq('entity_id', id);

  if (normalizeEntityType(entityType) === CANONICAL_PURCHASE_ORDER_ENTITY_TYPE) {
    query = query.in('entity_type', [...PURCHASE_ORDER_EVIDENCE_ENTITY_TYPES]);
  } else {
    const canonical = normalizeEntityType(entityType);
    query = canonical
      ? query.ilike('entity_type', canonical)
      : query.eq('entity_type', entityType.trim());
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    data: rows.map(normalizeEvidenceRecord),
    error: null,
  };
}
