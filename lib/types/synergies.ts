/**
 * Tipado estricto para columnas JSONB de la tabla synergies (docs01_DB_SCHEMA.md).
 * Elimina chequeos manuales de typeof en todo el proyecto.
 */

/** Entrada de empresa en companies_involved_json (puede ser UUID, nombre, u objeto) */
export type CompaniesInvolvedEntry =
  | string
  | {
      company_id?: string;
      id?: string;
      name?: string;
      company_name?: string;
      short_name?: string;
    };

/** companies_involved_json: array de empresas involucradas en la sinergia */
export type CompaniesInvolvedJson = CompaniesInvolvedEntry[];

/** volume_total_json: totales de volumen (número o objeto con total/total_units/quantity/amount) */
export interface VolumeTotalJson {
  total?: number;
  total_units?: number;
  quantity?: number;
  amount?: number;
  estimated_savings_pct?: number;
  [key: string]: unknown;
}

/** Tipo aceptado por la columna volume_total_json (nullable en DB) */
export type VolumeTotalJsonValue = number | VolumeTotalJson | null | undefined;

/**
 * Extrae un número de volume_total_json sin chequeos manuales de typeof.
 */
export function extractVolumeTotal(v: VolumeTotalJsonValue): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    const n = v.total ?? v.total_units ?? v.quantity ?? v.amount ?? 0;
    return typeof n === 'number' ? n : Number(n) || 0;
  }
  return Number(v) || 0;
}

/** Objeto con propiedades opcionales de empresa (para narrowing en companyEntryName) */
interface CompanyEntryObject {
  name?: string;
  company_name?: string;
  short_name?: string;
  company_id?: string;
  id?: string;
}

/**
 * Obtiene nombre legible de una entrada de companies_involved_json.
 * Retorna siempre string; usa ?? para precedencia clara (sin mezclar con ||).
 */
export function companyEntryName(entry: CompaniesInvolvedEntry): string {
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object' && entry !== null) {
    const obj = entry as CompanyEntryObject;
    const value =
      obj.name ?? obj.company_name ?? obj.short_name ?? obj.company_id ?? obj.id ?? '';
    return typeof value === 'string' ? value : String(value);
  }
  return String(entry ?? '');
}

/**
 * Obtiene el ID de empresa de una entrada (si es objeto con company_id/id).
 */
export function companyEntryId(entry: CompaniesInvolvedEntry): string | null {
  if (typeof entry === 'object' && entry !== null) {
    const obj = entry as CompanyEntryObject;
    const id = obj.company_id ?? obj.id ?? null;
    return typeof id === 'string' && id ? id : null;
  }
  return null;
}
