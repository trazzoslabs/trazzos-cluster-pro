'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  extractHeaders,
  persistMappingSourceColumns,
  trazzosMappingSourceColumnsStorageKey,
} from '@/lib/ingestionFileExtract';
import { normalizeDatasetType } from '@/lib/utils/normalization';
import { AUTH_BYPASS_COMPANY_ID, AUTH_BYPASS_USER_ID } from '@/lib/authBypass';
import SectionCard from '../../components/ui/SectionCard';

export interface IngestionJobMappingSnapshot {
  job_id: string;
  upload_id: string | null;
  mapping_profile_id: string | null;
  status: string | null;
  dataset_type?: string | null;
  /** Reservado si el backend expone columnas; hoy suele faltar y el cliente lee el archivo. */
  source_columns?: string[] | null;
}

interface StagingColumn {
  source_column: string;
  detected_at: string;
}

type ColumnMapping = Record<string, string>;

/** Valores persistidos en ingestion_jobs / enviados a mapping-apply (alineado con el BFF). */
const DATASET_TYPE_OPTIONS = ['needs', 'stocks', 'offers', 'shutdowns', 'suppliers'] as const;

function schemaKeyForDatasetType(type: string | null): string | null {
  const t = normalizeDatasetType(type);
  if (!t) return null;
  if (t === 'stocks') return 'suppliers';
  if (t === 'offers') return 'needs';
  return t;
}

function getTargetFields(type: string | null): string[] {
  const key = schemaKeyForDatasetType(type);
  if (!key) return [];
  if (key === 'shutdowns') {
    return ['company_id', 'site_id', 'asset_area', 'start_date', 'end_date', 'criticality'];
  }
  if (key === 'needs') {
    return [
      'company_id',
      'site_id',
      'shutdown_id',
      'item_name',
      'item_category',
      'specs',
      'quantity',
      'uom',
      'required_by_date',
      'lead_time_days',
    ];
  }
  if (key === 'suppliers') {
    return [
      'supplier_name',
      'country',
      'is_national',
      'categories_json',
      'coverage_json',
      'verification_status',
      'quality_score',
      'sla_score',
    ];
  }
  return [];
}

function getRequiredFields(type: string | null): string[] {
  const key = schemaKeyForDatasetType(type);
  if (!key) return [];
  if (key === 'shutdowns') return ['company_id', 'start_date', 'end_date'];
  if (key === 'needs') return ['company_id', 'item_name', 'item_category', 'quantity'];
  if (key === 'suppliers') return ['supplier_name'];
  return [];
}

function suggestTargetField(sourceColumn: string, type: string | null): string {
  const normalized = sourceColumn.trim().toLowerCase().replace(/\s+/g, '_');
  const schemaKey = schemaKeyForDatasetType(type) ?? '';

  const needsMap: Record<string, string> = {
    company_id: 'company_id',
    company: 'company_id',
    empresa: 'company_id',
    site_id: 'site_id',
    site: 'site_id',
    sede: 'site_id',
    shutdown_id: 'shutdown_id',
    parada: 'shutdown_id',
    item_name: 'item_name',
    item: 'item_name',
    nombre: 'item_name',
    descripcion: 'item_name',
    item_category: 'item_category',
    category: 'item_category',
    categoria: 'item_category',
    specs: 'specs',
    especificaciones: 'specs',
    quantity: 'quantity',
    cant: 'quantity',
    cantidad: 'quantity',
    qty: 'quantity',
    uom: 'uom',
    unit: 'uom',
    unidad: 'uom',
    required_by_date: 'required_by_date',
    fecha_requerida: 'required_by_date',
    lead_time_days: 'lead_time_days',
    dias_entrega: 'lead_time_days',
  };

  const shutdownsMap: Record<string, string> = {
    company_id: 'company_id',
    company: 'company_id',
    site_id: 'site_id',
    site: 'site_id',
    asset_area: 'asset_area',
    area: 'asset_area',
    start_date: 'start_date',
    inicio: 'start_date',
    end_date: 'end_date',
    fin: 'end_date',
    criticality: 'criticality',
    criticidad: 'criticality',
  };

  const suppliersMap: Record<string, string> = {
    supplier_name: 'supplier_name',
    supplier: 'supplier_name',
    proveedor: 'supplier_name',
    country: 'country',
    pais: 'country',
    is_national: 'is_national',
    nacional: 'is_national',
    verification_status: 'verification_status',
    quality_score: 'quality_score',
    sla_score: 'sla_score',
  };

  const map =
    schemaKey === 'shutdowns' ? shutdownsMap : schemaKey === 'suppliers' ? suppliersMap : needsMap;
  const allowed = new Set(getTargetFields(type));

  if (map[normalized] && allowed.has(map[normalized])) return map[normalized];

  for (const [key, target] of Object.entries(map)) {
    if (allowed.has(target) && (normalized.includes(key) || key.includes(normalized))) return target;
  }
  return '';
}

function jobHasDbColumnMetadata(job: IngestionJobMappingSnapshot | null): boolean {
  const cols = job?.source_columns;
  return Array.isArray(cols) && cols.length > 0;
}

function mapApplyErrorToUserMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(fallback);
  const lower = raw.toLowerCase();
  if (lower.includes('timeout') || lower.includes('abort') || lower.includes('tiempo')) {
    return 'n8n no respondió a tiempo, reintenta';
  }
  return raw || fallback;
}

function mappingColumnDraftStorageKey(jobId: string): string {
  return `trazzos_ingestion_column_mapping_draft:${jobId}`;
}

function filterDraftToStaging(draft: ColumnMapping, staging: StagingColumn[]): ColumnMapping {
  const keys = new Set(staging.map((c) => c.source_column));
  const out: ColumnMapping = {};
  for (const [k, v] of Object.entries(draft)) {
    if (keys.has(k) && typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

function parseColumnMappingDraft(raw: string): ColumnMapping | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const rec = o as Record<string, unknown>;
    const cm = rec.columnMapping;
    if (!cm || typeof cm !== 'object' || Array.isArray(cm)) return null;
    const out: ColumnMapping = {};
    for (const [k, v] of Object.entries(cm as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Mínimo para aprobar cuando el esquema es tipo needs (incl. offers). */
const MINIMUM_SUBMIT_TARGETS_NEEDS = ['company_id', 'item_name', 'quantity'] as const;

export type MappingSubmitValidation = {
  ok: boolean;
  missingFields: string[];
  datasetTypeInvalid: boolean;
  jobDatasetTypeMissing: boolean;
};

/**
 * Validación previa a Aprobar: para datasets needs-like exige company_id, item_name y quantity;
 * en otros esquemas usa getRequiredFields.
 */
export function validateMappingBeforeSubmit(
  columnMapping: ColumnMapping,
  selectedDatasetType: string,
  job: IngestionJobMappingSnapshot | null,
): MappingSubmitValidation {
  const values = Object.values(columnMapping);
  const schemaKey = schemaKeyForDatasetType(selectedDatasetType);
  const missingFields =
    schemaKey === 'needs'
      ? MINIMUM_SUBMIT_TARGETS_NEEDS.filter((f) => !values.includes(f))
      : getRequiredFields(selectedDatasetType).filter((f) => !values.includes(f));

  const dt = normalizeDatasetType(selectedDatasetType);
  const datasetTypeInvalid =
    !dt || !(DATASET_TYPE_OPTIONS as readonly string[]).includes(dt);
  const jobDatasetTypeMissing = !normalizeDatasetType(job?.dataset_type);

  return {
    ok: missingFields.length === 0 && !datasetTypeInvalid,
    missingFields,
    datasetTypeInvalid,
    jobDatasetTypeMissing,
  };
}

type Props = {
  jobId: string;
  /** Si el padre ya cargó el job (p. ej. página /ingestion/jobs/[id]), evita un fetch inicial duplicado. */
  initialJob?: IngestionJobMappingSnapshot | null;
  /** Archivo en el navegador; con job sin columnas en DB, aquí se llama a extractHeaders(file). */
  file?: File | null;
  /** @deprecated Usa `file`. */
  sourceFile?: File | null;
  /** Enlace opcional arriba del bloque (ruta /ingestion/mapping/...). */
  showBackToJobsLink?: boolean;
};

export default function IngestionMappingWorkflow({
  jobId,
  initialJob,
  file: fileProp = null,
  sourceFile: sourceFileProp = null,
  showBackToJobsLink,
}: Props) {
  const localFile = fileProp ?? sourceFileProp;
  const router = useRouter();
  const [job, setJob] = useState<IngestionJobMappingSnapshot | null>(initialJob ?? null);
  const [jobLoadError, setJobLoadError] = useState<string | null>(null);
  const [loadingJob, setLoadingJob] = useState(!initialJob);

  const [stagingColumns, setStagingColumns] = useState<StagingColumn[]>([]);
  /** Carga solo del API staging-columns (no bloquea la UI si ya hay columnas locales). */
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [localExtracting, setLocalExtracting] = useState(false);
  const [errorColumns, setErrorColumns] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [applyingMapping, setApplyingMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingToast, setMappingToast] = useState<{ message: string; variant: 'error' } | null>(
    null,
  );
  const autoMatchAppliedRef = useRef(false);
  const localDraftCheckedRef = useRef(false);

  /** Borrador en localStorage pendiente de decisión del usuario (no aplicar auto-match hasta resolver). */
  const [recoverDraft, setRecoverDraft] = useState<ColumnMapping | null>(null);

  const [selectedDatasetType, setSelectedDatasetType] = useState<string>('needs');

  useEffect(() => {
    const raw = normalizeDatasetType(job?.dataset_type);
    if (raw && (DATASET_TYPE_OPTIONS as readonly string[]).includes(raw)) {
      setSelectedDatasetType(raw);
    } else if (job?.job_id) {
      setSelectedDatasetType('needs');
    }
  }, [job?.job_id, job?.dataset_type]);

  const fetchJobLocal = async () => {
    if (!jobId) return;
    try {
      setLoadingJob(true);
      setJobLoadError(null);
      const response = await fetch(`/api/data/ingestion-jobs?job_id=${encodeURIComponent(jobId)}`);
      if (!response.ok) throw new Error(`No se pudo cargar el job (${response.status})`);
      const result = await response.json();
      setJob(result.data as IngestionJobMappingSnapshot);
    } catch (e) {
      setJobLoadError(e instanceof Error ? e.message : 'Error al cargar el job');
    } finally {
      setLoadingJob(false);
    }
  };

  useEffect(() => {
    if (initialJob) {
      setJob(initialJob);
      setLoadingJob(false);
    }
  }, [
    initialJob?.job_id,
    initialJob?.status,
    initialJob?.mapping_profile_id,
    initialJob?.dataset_type,
    initialJob?.upload_id,
  ]);

  useEffect(() => {
    if (initialJob) return;
    fetchJobLocal();
  }, [jobId]);

  useEffect(() => {
    autoMatchAppliedRef.current = false;
    localDraftCheckedRef.current = false;
    setRecoverDraft(null);
    setStagingColumns([]);
    setColumnMapping({});
    setErrorColumns(null);
    setLocalExtracting(false);
    setLoadingColumns(false);
  }, [jobId]);

  useEffect(() => {
    if (job?.status?.toLowerCase() !== 'awaiting_mapping' || !jobId) return;

    let cancelled = false;
    const storageKey = trazzosMappingSourceColumnsStorageKey(jobId);

    const toStaging = (names: string[]): StagingColumn[] => {
      const detected_at = new Date().toISOString();
      return names.map((source_column) => ({ source_column, detected_at }));
    };

    const applyLocalColumnNames = (names: string[] | null | undefined): boolean => {
      if (cancelled || !names?.length) return false;
      setStagingColumns(toStaging(names));
      setErrorColumns(null);
      return true;
    };

    (async () => {
      setErrorColumns(null);
      let haveLocalColumns = false;

      // 0) Si el backend envía columnas en el job, usarlas (caso futuro).
      if (!cancelled && jobHasDbColumnMetadata(job) && job?.source_columns) {
        if (applyLocalColumnNames(job.source_columns)) {
          haveLocalColumns = true;
          setLoadingColumns(false);
          persistMappingSourceColumns(jobId, job.source_columns);
        }
      }

      // 1) Sesión: al refrescar no hay File; la clave por job_id restaura cabeceras al instante.
      if (!cancelled && !haveLocalColumns && typeof window !== 'undefined') {
        try {
          const raw = sessionStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
              if (applyLocalColumnNames(parsed as string[])) {
                haveLocalColumns = true;
                setLoadingColumns(false);
              }
            }
          }
        } catch {
          /* session inválida */
        }
      }

      // 2) Archivo en navegador: sin columnas en el job (caso actual) → extractHeaders(file).
      if (!cancelled && !haveLocalColumns && localFile && !jobHasDbColumnMetadata(job)) {
        setLocalExtracting(true);
        try {
          const names = await extractHeaders(localFile);
          if (!cancelled && names?.length && applyLocalColumnNames(names)) {
            haveLocalColumns = true;
            setLoadingColumns(false);
            persistMappingSourceColumns(jobId, names);
          }
        } finally {
          if (!cancelled) setLocalExtracting(false);
        }
      }

      if (!haveLocalColumns) setLoadingColumns(true);
      try {
        const response = await fetch(`/api/data/staging-columns?job_id=${encodeURIComponent(jobId)}`);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const result = await response.json();
        const serverCols: StagingColumn[] = result.data || [];
        if (!cancelled && serverCols.length > 0) {
          setStagingColumns((prev) => (prev.length > 0 ? prev : serverCols));
        }
      } catch (err) {
        if (!cancelled && !haveLocalColumns) {
          setErrorColumns(err instanceof Error ? err.message : 'Error cargando columnas');
        }
      } finally {
        if (!cancelled) setLoadingColumns(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [job?.status, job?.source_columns, jobId, localFile]);

  const datasetType = selectedDatasetType;
  const targetFields = getTargetFields(datasetType);
  const requiredFields = getRequiredFields(datasetType);

  const submitValidation = useMemo(
    () => validateMappingBeforeSubmit(columnMapping, selectedDatasetType, job),
    [columnMapping, selectedDatasetType, job],
  );

  useEffect(() => {
    if (!jobId || stagingColumns.length === 0 || !datasetType.trim()) return;
    if (recoverDraft !== null) return;
    if (autoMatchAppliedRef.current) return;

    if (typeof window !== 'undefined' && !localDraftCheckedRef.current) {
      localDraftCheckedRef.current = true;
      try {
        const raw = localStorage.getItem(mappingColumnDraftStorageKey(jobId));
        const parsed = raw ? parseColumnMappingDraft(raw) : null;
        const filtered = parsed ? filterDraftToStaging(parsed, stagingColumns) : {};
        if (Object.keys(filtered).length > 0) {
          setRecoverDraft(filtered);
          return;
        }
      } catch {
        /* noop */
      }
    }

    autoMatchAppliedRef.current = true;
    const suggested: ColumnMapping = {};
    stagingColumns.forEach((col) => {
      const target = suggestTargetField(col.source_column, datasetType);
      if (target) suggested[col.source_column] = target;
    });
    if (Object.keys(suggested).length > 0) setColumnMapping(suggested);
  }, [stagingColumns, datasetType, jobId, recoverDraft]);

  useEffect(() => {
    if (!jobId || typeof window === 'undefined') return;
    const keys = Object.keys(columnMapping);
    if (keys.length === 0) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          mappingColumnDraftStorageKey(jobId),
          JSON.stringify({ columnMapping, updatedAt: Date.now() }),
        );
      } catch {
        /* quota */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [columnMapping, jobId]);

  useEffect(() => {
    if (!mappingToast) return;
    const t = window.setTimeout(() => setMappingToast(null), 12000);
    return () => window.clearTimeout(t);
  }, [mappingToast]);

  const validateMapping = (): { valid: boolean; missingFields: string[] } => {
    const missingFields: string[] = [];
    requiredFields.forEach((field) => {
      if (!Object.values(columnMapping).includes(field)) missingFields.push(field);
    });
    return { valid: missingFields.length === 0, missingFields };
  };

  const applySuggestedAutoMatch = () => {
    const suggested: ColumnMapping = {};
    stagingColumns.forEach((col) => {
      const target = suggestTargetField(col.source_column, datasetType);
      if (target) suggested[col.source_column] = target;
    });
    if (Object.keys(suggested).length > 0) setColumnMapping(suggested);
  };

  const handleRecoverLocalDraft = () => {
    if (!recoverDraft) return;
    setColumnMapping({ ...recoverDraft });
    setRecoverDraft(null);
    autoMatchAppliedRef.current = true;
    setMappingError(null);
  };

  const handleDismissRecoverDraft = () => {
    setRecoverDraft(null);
    autoMatchAppliedRef.current = false;
    applySuggestedAutoMatch();
    autoMatchAppliedRef.current = true;
    setMappingError(null);
  };

  const handleAutoMatch = () => {
    const suggested: ColumnMapping = {};
    stagingColumns.forEach((col) => {
      const target = suggestTargetField(col.source_column, datasetType);
      if (target) suggested[col.source_column] = target;
    });
    setColumnMapping((prev) => ({ ...suggested, ...prev }));
    setMappingError(null);
  };

  const handleValidateMapping = () => {
    const validation = validateMapping();
    if (validation.valid) {
      setMappingError(null);
      alert('✓ Mapeo válido. Todos los campos obligatorios están asignados.');
    } else {
      const missingList = validation.missingFields.join(', ');
      setMappingError(`Faltan campos obligatorios: ${missingList}`);
      alert(`⚠ Mapeo incompleto. Faltan campos obligatorios: ${missingList}`);
    }
  };

  const handleApplyMapping = async () => {
    if (!jobId) {
      setMappingError('Job ID no encontrado');
      return;
    }

    const pre = validateMappingBeforeSubmit(columnMapping, selectedDatasetType, job);
    if (pre.datasetTypeInvalid) {
      const msg =
        'El tipo de dataset no es válido o está vacío. Selecciona un tipo antes de enviar el mapeo a n8n.';
      setMappingError(msg);
      setMappingToast({ variant: 'error', message: msg });
      return;
    }
    if (!pre.ok) {
      const missingList = pre.missingFields.join(', ');
      setMappingError(
        schemaKeyForDatasetType(selectedDatasetType) === 'needs'
          ? `Faltan asignar al menos: ${missingList} (requeridos para aprobar).`
          : `Faltan campos obligatorios: ${missingList}`,
      );
      alert(`⚠ No se puede aprobar. ${missingList ? `Falta: ${missingList}` : 'Revisa el mapeo.'}`);
      return;
    }

    const mapping: Record<string, string> = {};
    for (const col of stagingColumns) {
      const target = (columnMapping[col.source_column] ?? '').trim();
      if (target) mapping[col.source_column] = target;
    }

    if (Object.keys(mapping).length === 0) {
      setMappingError('No hay mapeos para enviar; asigna campos destino a las columnas detectadas.');
      setMappingToast({
        variant: 'error',
        message: 'El objeto de mapeo está vacío. Completa la tabla antes de aprobar.',
      });
      return;
    }

    const dataset_type = normalizeDatasetType(selectedDatasetType);

    const mapping_profile_id =
      job?.mapping_profile_id?.trim() ||
      (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '');

    if (!mapping_profile_id) {
      setMappingError('No se pudo determinar mapping_profile_id');
      setMappingToast({ variant: 'error', message: 'Falta mapping_profile_id. Recarga el job.' });
      return;
    }

    try {
      setApplyingMapping(true);
      setMappingError(null);
      setMappingToast(null);

      const bffRequestBody = {
        job_id: jobId,
        mapping_profile_id,
        dataset_type,
        company_id: AUTH_BYPASS_COMPANY_ID,
        user_id: AUTH_BYPASS_USER_ID,
        mapping,
        mapping_json: mapping,
      };
      const n8nPayloadPreview = {
        job_id: jobId,
        mapping_profile_id,
        dataset_type,
        company_id: AUTH_BYPASS_COMPANY_ID,
        user_id: AUTH_BYPASS_USER_ID,
        mapping: Object.entries(mapping).map(([source_column, target_field]) => ({
          source_column,
          target_field,
        })),
      };
      console.log(
        '[IngestionMappingWorkflow] mapping-apply → cuerpo JSON enviado al BFF (POST /api/workflows/mapping-apply):',
        JSON.stringify(bffRequestBody, null, 2),
      );
      console.log(
        '[IngestionMappingWorkflow] Vista previa del payload equivalente hacia n8n (mapping como pares; el BFF reenvía este shape):',
        JSON.stringify(n8nPayloadPreview, null, 2),
      );

      const response = await fetch('/api/workflows/mapping-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bffRequestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const errorMessage =
          errorData.error || errorData.message || `Error al aplicar mapeo: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(trazzosMappingSourceColumnsStorageKey(jobId));
          localStorage.removeItem(mappingColumnDraftStorageKey(jobId));
        } catch {
          /* noop */
        }
      }
      router.push('/ingestion?success=mapping_applied');
    } catch (err) {
      const errorMessage = mapApplyErrorToUserMessage(
        err,
        'No se pudo aplicar el mapeo. Reintenta en unos segundos.',
      );
      setMappingError(errorMessage);
      setMappingToast({ variant: 'error', message: errorMessage });
      console.error('Error applying mapping:', err);
    } finally {
      setApplyingMapping(false);
    }
  };

  if (loadingJob) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#9aff8d] border-t-transparent" />
        <p className="mt-2 text-sm text-zinc-400">Cargando job…</p>
      </div>
    );
  }

  if (jobLoadError || !job) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
        <p className="text-red-300 text-sm">{jobLoadError || 'Job no encontrado'}</p>
        <Link href="/ingestion/jobs" className="mt-2 inline-block text-sm text-[#9aff8d] hover:underline">
          Volver a jobs
        </Link>
      </div>
    );
  }

  if (job.status?.toLowerCase() !== 'awaiting_mapping') {
    return (
      <SectionCard
        title="Mapeo no disponible"
        description="Este job no está esperando mapeo de columnas."
        className="mb-6 border-zinc-700"
      >
        <p className="text-zinc-400 text-sm mb-4">Estado actual: {job.status ?? '—'}</p>
        <Link
          href={`/ingestion/jobs/${encodeURIComponent(jobId)}`}
          className="inline-flex rounded-md bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600"
        >
          Ver detalle del job
        </Link>
      </SectionCard>
    );
  }

  return (
    <>
      {mappingToast && mappingToast.variant === 'error' && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-[100] max-w-md rounded-lg border border-red-600 bg-red-950/95 px-4 py-3 text-sm text-red-100 shadow-lg"
        >
          <p className="font-semibold text-red-200">Error al aplicar mapeo</p>
          <p className="mt-1 text-red-100/90">{mappingToast.message}</p>
          <button
            type="button"
            onClick={() => setMappingToast(null)}
            className="mt-2 text-xs font-medium text-red-300 underline hover:text-red-200"
          >
            Cerrar
          </button>
        </div>
      )}

      {showBackToJobsLink && (
        <div className="mb-4 flex justify-end">
          <Link
            href="/ingestion/jobs"
            className="rounded-md bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600"
          >
            ← Volver a Jobs
          </Link>
        </div>
      )}

      <SectionCard
        title="Mapeo de columnas (requerido)"
        description="Asigna cada columna detectada a un campo destino del esquema"
        className="mb-6 border-[#9aff8d]/30"
      >
        {stagingColumns.length === 0 && (localExtracting || loadingColumns) ? (
          <div className="py-8 text-center">
            <div className="mb-2 inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#9aff8d] border-t-transparent" />
            <p className="text-secondary text-sm">Cargando columnas detectadas...</p>
          </div>
        ) : errorColumns ? (
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
            <p className="text-sm text-red-300">Error: {errorColumns}</p>
          </div>
        ) : stagingColumns.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-secondary">
              No se pudieron detectar columnas en el archivo. Por favor, verifica el formato
            </p>
          </div>
        ) : (
          <>
            {recoverDraft !== null && (
              <div
                role="status"
                className="mb-4 rounded-lg border border-sky-700/60 bg-sky-950/50 px-4 py-3 text-sm text-sky-100"
              >
                <p className="font-medium text-sky-50">Hay un mapeo guardado en este navegador</p>
                <p className="mt-1 text-xs text-sky-200/90">
                  ¿Deseas recuperar las asignaciones que tenías para este job?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRecoverLocalDraft}
                    className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
                  >
                    Recuperar mapeo anterior
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissRecoverDraft}
                    className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    No, empezar de nuevo
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4 max-w-md">
              <label htmlFor="ingestion-dataset-type" className="mb-1 block text-sm font-medium text-zinc-300">
                Tipo de dataset
              </label>
              <p className="mb-2 text-xs text-zinc-500">
                Se guarda en el job antes de llamar a n8n (needs, stocks, offers, …).
              </p>
              {submitValidation.jobDatasetTypeMissing && (
                <div
                  role="alert"
                  className="mb-3 rounded-lg border border-amber-600/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
                >
                  <p className="font-medium text-amber-50">Advertencia: dataset_type del job es nulo</p>
                  <p className="mt-1 text-amber-200/90">
                    El servidor no trajo tipo de dataset para este job. Confirma que el selector anterior
                    refleja el archivo que subiste antes de aprobar; si envías con un tipo incorrecto, n8n
                    puede fallar.
                  </p>
                </div>
              )}
              <select
                id="ingestion-dataset-type"
                value={selectedDatasetType}
                disabled={recoverDraft !== null}
                onChange={(e) => {
                  setSelectedDatasetType(e.target.value);
                  setMappingError(null);
                }}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {DATASET_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {mappingError && (
              <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-4">
                <p className="mb-1 text-sm font-medium text-red-300">Qué falta para continuar:</p>
                <p className="text-sm text-red-200">{mappingError}</p>
              </div>
            )}

            <div className="mb-6 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">
                      Columna Origen
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">
                      Campo Destino
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {stagingColumns.map((col) => {
                    const sourceCol = col.source_column;
                    const mappedField = columnMapping[sourceCol] || '';
                    const isRequired = requiredFields.includes(mappedField);
                    const isMapped = !!mappedField;

                    return (
                      <tr key={sourceCol} className="transition-colors hover:bg-zinc-700/50">
                        <td className="px-4 py-3 font-mono text-sm text-zinc-300">{sourceCol}</td>
                        <td className="px-4 py-3">
                          <select
                            value={mappedField}
                            disabled={recoverDraft !== null}
                            onChange={(e) => {
                              const newMapping = { ...columnMapping };
                              if (e.target.value) newMapping[sourceCol] = e.target.value;
                              else delete newMapping[sourceCol];
                              setColumnMapping(newMapping);
                              setMappingError(null);
                            }}
                            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">-- Sin asignar --</option>
                            {targetFields.map((field) => (
                              <option key={field} value={field}>
                                {field} {requiredFields.includes(field) ? '(requerido)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {isMapped ? (
                            <span
                              className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
                                isRequired
                                  ? 'border border-green-800 bg-green-900/30 text-green-400'
                                  : 'border border-blue-800 bg-blue-900/30 text-blue-400'
                              }`}
                            >
                              {isRequired ? 'Asignado (requerido)' : 'Asignado'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-300">
                              Sin asignar
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleAutoMatch}
                disabled={recoverDraft !== null}
                className="rounded-md bg-zinc-700 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Auto-asignar sugerencias
              </button>
              <button
                type="button"
                onClick={handleValidateMapping}
                disabled={recoverDraft !== null || Object.keys(columnMapping).length === 0}
                className="rounded-md bg-zinc-700 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Validar mapeo
              </button>
              <button
                type="button"
                onClick={handleApplyMapping}
                disabled={
                  recoverDraft !== null ||
                  applyingMapping ||
                  Object.keys(columnMapping).length === 0 ||
                  !submitValidation.ok
                }
                className="rounded-md bg-[#9aff8d] px-6 py-2.5 font-medium text-[#232323] transition-colors hover:bg-[#9aff8d]/80 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {applyingMapping ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#232323] border-t-transparent align-middle" />
                    Aplicando cambios...
                  </>
                ) : (
                  'Aprobar y Continuar'
                )}
              </button>
            </div>
          </>
        )}
      </SectionCard>
    </>
  );
}
