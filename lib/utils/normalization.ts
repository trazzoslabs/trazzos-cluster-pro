/**
 * Normalización de tipos para comparaciones estables (entidades, dataset_type).
 */

function toSnakeCaseLower(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

/**
 * Canonicaliza tipos de entidad relacionados con orden de compra.
 * `PO`, `purchase_order`, `PurchaseOrder`, `purchase-order` → `purchase_order`.
 * Otros valores se devuelven en snake_case minúsculas.
 */
export function normalizeEntityType(type: string): string {
  const raw = String(type ?? '').trim();
  if (!raw) return '';

  const lower = raw.toLowerCase();
  if (lower === 'po' || lower === 'purchase_order') {
    return 'purchase_order';
  }

  const snake = toSnakeCaseLower(raw);
  if (snake === 'purchase_order' || snake === 'po') {
    return 'purchase_order';
  }

  const compact = raw.replace(/[\s_-]/g, '').toLowerCase();
  if (compact === 'purchaseorder' || compact === 'po') {
    return 'purchase_order';
  }

  return snake || lower;
}

/** Valor canónico para queries de evidencia de PO (coincide con normalizeEntityType). */
export const CANONICAL_PURCHASE_ORDER_ENTITY_TYPE = 'purchase_order' as const;

/**
 * dataset_type case-insensitive: trim + minúsculas.
 * Usar para comparar o indexar contra listas permitidas en minúsculas.
 */
export function normalizeDatasetType(type: string | null | undefined): string {
  if (type == null) return '';
  return String(type).trim().toLowerCase();
}

export function datasetTypesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeDatasetType(a) === normalizeDatasetType(b);
}
