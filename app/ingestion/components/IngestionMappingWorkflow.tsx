'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SectionCard from '../../components/ui/SectionCard';

export interface IngestionJobMappingSnapshot {
  job_id: string;
  upload_id: string | null;
  mapping_profile_id: string | null;
  status: string | null;
  dataset_type?: string | null;
}

interface StagingColumn {
  source_column: string;
  detected_at: string;
}

type ColumnMapping = Record<string, string>;

function getTargetFields(type: string | null): string[] {
  if (!type) return [];
  const typeLower = type.toLowerCase();
  if (typeLower === 'shutdowns') {
    return ['company_id', 'site_id', 'asset_area', 'start_date', 'end_date', 'criticality'];
  }
  if (typeLower === 'needs') {
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
  if (typeLower === 'suppliers') {
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
  if (!type) return [];
  const typeLower = type.toLowerCase();
  if (typeLower === 'shutdowns') return ['company_id', 'start_date', 'end_date'];
  if (typeLower === 'needs') return ['company_id', 'item_name', 'item_category', 'quantity'];
  if (typeLower === 'suppliers') return ['supplier_name'];
  return [];
}

function suggestTargetField(sourceColumn: string, type: string | null): string {
  const normalized = sourceColumn.trim().toLowerCase().replace(/\s+/g, '_');
  const typeLower = (type ?? '').toLowerCase();

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
    typeLower === 'shutdowns' ? shutdownsMap : typeLower === 'suppliers' ? suppliersMap : needsMap;
  const allowed = new Set(getTargetFields(type));

  if (map[normalized] && allowed.has(map[normalized])) return map[normalized];

  for (const [key, target] of Object.entries(map)) {
    if (allowed.has(target) && (normalized.includes(key) || key.includes(normalized))) return target;
  }
  return '';
}

function mapApplyErrorToUserMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(fallback);
  const lower = raw.toLowerCase();
  if (lower.includes('timeout') || lower.includes('abort') || lower.includes('tiempo')) {
    return 'n8n no respondió a tiempo, reintenta';
  }
  return raw || fallback;
}

type Props = {
  jobId: string;
  /** Si el padre ya cargó el job (p. ej. página /ingestion/jobs/[id]), evita un fetch inicial duplicado. */
  initialJob?: IngestionJobMappingSnapshot | null;
  /** Enlace opcional arriba del bloque (ruta /ingestion/mapping/...). */
  showBackToJobsLink?: boolean;
};

export default function IngestionMappingWorkflow({
  jobId,
  initialJob,
  showBackToJobsLink,
}: Props) {
  const router = useRouter();
  const [job, setJob] = useState<IngestionJobMappingSnapshot | null>(initialJob ?? null);
  const [jobLoadError, setJobLoadError] = useState<string | null>(null);
  const [loadingJob, setLoadingJob] = useState(!initialJob);

  const [stagingColumns, setStagingColumns] = useState<StagingColumn[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [errorColumns, setErrorColumns] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [applyingMapping, setApplyingMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingToast, setMappingToast] = useState<{ message: string; variant: 'error' } | null>(
    null,
  );
  const autoMatchAppliedRef = useRef(false);

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

  const fetchStagingColumns = async () => {
    if (!jobId) return;
    try {
      setLoadingColumns(true);
      setErrorColumns(null);
      const response = await fetch(`/api/data/staging-columns?job_id=${encodeURIComponent(jobId)}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const result = await response.json();
      setStagingColumns(result.data || []);
    } catch (err) {
      setErrorColumns(err instanceof Error ? err.message : 'Error cargando columnas');
    } finally {
      setLoadingColumns(false);
    }
  };

  useEffect(() => {
    if (job?.status?.toLowerCase() === 'awaiting_mapping') {
      fetchStagingColumns();
    }
  }, [job?.status, jobId]);

  const datasetType = job?.dataset_type || null;
  const targetFields = getTargetFields(datasetType);
  const requiredFields = getRequiredFields(datasetType);

  useEffect(() => {
    if (autoMatchAppliedRef.current || stagingColumns.length === 0 || !datasetType) return;
    autoMatchAppliedRef.current = true;
    const suggested: ColumnMapping = {};
    stagingColumns.forEach((col) => {
      const target = suggestTargetField(col.source_column, datasetType);
      if (target) suggested[col.source_column] = target;
    });
    if (Object.keys(suggested).length > 0) setColumnMapping(suggested);
  }, [stagingColumns, datasetType]);

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

    const validation = validateMapping();
    if (!validation.valid) {
      const missingList = validation.missingFields.join(', ');
      setMappingError(`Faltan campos obligatorios: ${missingList}`);
      alert(`⚠ No se puede aprobar. Faltan campos obligatorios: ${missingList}`);
      return;
    }

    const mapping: Record<string, string> = {};
    for (const [source_column, target_field] of Object.entries(columnMapping)) {
      if (target_field) mapping[source_column] = target_field;
    }

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

      const response = await fetch('/api/workflows/mapping-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          mapping_profile_id,
          mapping,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const errorMessage =
          errorData.error || errorData.message || `Error al aplicar mapeo: ${response.statusText}`;
        throw new Error(errorMessage);
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
        {loadingColumns ? (
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
              No se detectaron columnas. El archivo puede estar vacío o no procesado aún.
            </p>
          </div>
        ) : (
          <>
            {!datasetType && (
              <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-900/20 p-3">
                <p className="text-sm text-yellow-300">
                  No se pudo determinar el tipo de dataset. Algunas opciones pueden no estar disponibles.
                </p>
              </div>
            )}

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
                            onChange={(e) => {
                              const newMapping = { ...columnMapping };
                              if (e.target.value) newMapping[sourceCol] = e.target.value;
                              else delete newMapping[sourceCol];
                              setColumnMapping(newMapping);
                              setMappingError(null);
                            }}
                            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
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
                className="rounded-md bg-zinc-700 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-600"
              >
                Auto-asignar sugerencias
              </button>
              <button
                type="button"
                onClick={handleValidateMapping}
                disabled={Object.keys(columnMapping).length === 0}
                className="rounded-md bg-zinc-700 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Validar mapeo
              </button>
              <button
                type="button"
                onClick={handleApplyMapping}
                disabled={applyingMapping || Object.keys(columnMapping).length === 0}
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
