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

/** Clave sessionStorage para cabeceras extraídas en el cliente tras la subida (mismo job). */
export function trazzosMappingSourceColumnsStorageKey(jobId: string): string {
  return `trazzos_mapping_source_columns:${jobId}`;
}

/** Guarda cabeceras detectadas en el cliente para sobrevivir a F5 y evitar depender del staging en DB. */
export function persistMappingSourceColumns(jobId: string, headers: string[]): void {
  if (typeof window === 'undefined' || !jobId.trim() || headers.length === 0) return;
  try {
    sessionStorage.setItem(trazzosMappingSourceColumnsStorageKey(jobId), JSON.stringify(headers));
  } catch {
    /* quota u otro */
  }
}

/**
 * Nombres de columna del archivo (CSV / JSON / JSONL), para mapeo sin depender del staging en DB.
 * CSV: la primera línea pasa por unwrapCsvHeaderLineIfWholeLineQuoted antes del split por delimitador,
 * para quitar comillas envolventes cuando toda la línea viene como un solo campo.
 */
export async function extractHeaders(file: File): Promise<string[] | null> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  try {
    const text = await file.text();
    if (ext === 'csv') {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return null;
      const headerLine = unwrapCsvHeaderLineIfWholeLineQuoted(lines[0]);
      const delimiter = headerLine.includes(';') ? ';' : ',';
      const headers = headerLine
        .split(delimiter)
        .map((h) => h.trim().replace(/^"|"$/g, ''))
        .filter((h) => h.length > 0);
      return headers.length ? headers : null;
    }
    if (ext === 'jsonl') {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        try {
          const parsed = JSON.parse(lines[i]) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const keys = Object.keys(parsed as Record<string, unknown>);
            return keys.length ? keys : null;
          }
        } catch {
          /* siguiente línea */
        }
      }
      return null;
    }
    if (ext === 'json') {
      const parsed = JSON.parse(text) as unknown;
      const rows = jsonDocumentToObjectRows(parsed);
      if (rows.length === 0) return null;
      const keys = Object.keys(rows[0]);
      return keys.length ? keys : null;
    }
  } catch {
    return null;
  }
  return null;
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
