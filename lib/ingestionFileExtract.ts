/**
 * Utilidades para extraer filas/cabeceras de CSV y JSON en el flujo de ingesta.
 */

/**
 * Si la primera línea del CSV viene como un solo campo entre comillas que contiene todos los headers
 * (ej. `"col1,col2,col3"`), quita las comillas externas antes del split.
 * No altera líneas estilo RFC con columnas entre comillas (`"a","b"`).
 */
export function unwrapCsvHeaderLineIfWholeLineQuoted(line: string): string {
  const t = line.trim();
  if (t.length < 2 || t[0] !== '"' || t[t.length - 1] !== '"') return t;
  const inner = t.slice(1, -1);
  if (inner.includes('","')) return t;
  return inner;
}

function isPlainObjectRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Normaliza JSON anidado o envuelto: prioriza arrays de objetos; reconoce envoltorios típicos
 * (`data`, `rows`, etc.). Si solo hay un objeto raíz, devuelve una fila con sus claves de primer nivel.
 */
export function jsonDocumentToObjectRows(parsed: unknown): Record<string, unknown>[] {
  if (parsed === null || typeof parsed !== 'object') return [];

  if (Array.isArray(parsed)) {
    return parsed.filter(isPlainObjectRecord);
  }

  const o = parsed as Record<string, unknown>;
  const preferredKeys = ['data', 'rows', 'records', 'items', 'results', 'values', 'payload', 'content'];

  for (const k of preferredKeys) {
    const v = o[k];
    if (Array.isArray(v) && v.length > 0 && isPlainObjectRecord(v[0])) {
      return v.filter(isPlainObjectRecord);
    }
  }

  for (const v of Object.values(o)) {
    if (Array.isArray(v) && v.length > 0 && isPlainObjectRecord(v[0])) {
      return v.filter(isPlainObjectRecord);
    }
  }

  return [o];
}
