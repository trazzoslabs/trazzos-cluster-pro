'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageTitle from '../../../components/ui/PageTitle';
import SectionCard from '../../../components/ui/SectionCard';
import StatusBadge from '../../../components/ui/StatusBadge';
import CopyButton from '../../../components/ui/CopyButton';
import QualityAlertTable, {
  type QualityIssueRow,
} from '../../components/QualityAlertTable';
import IngestionMappingWorkflow from '../../components/IngestionMappingWorkflow';

interface IngestionJob {
  job_id: string;
  upload_id: string | null;
  pipeline_version: string | null;
  mapping_profile_id: string | null;
  status: string | null;
  rows_total: number | null;
  rows_ok: number | null;
  rows_error: number | null;
  started_at: string | null;
  ended_at: string | null;
  correlation_id: string | null;
  dataset_type?: string | null;
}

interface AuditEvent {
  event_id: string;
  correlation_id: string | null;
  event_type: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  company_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  payload_hash_sha256: string | null;
  created_at: string | null;
}

export default function IngestionJobPage() {
  const params = useParams();
  const jobId = params.job_id as string;

  const [job, setJob] = useState<IngestionJob | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAudit, setErrorAudit] = useState<string | null>(null);

  const [qualityIssues, setQualityIssues] = useState<QualityIssueRow[]>([]);
  const [loadingQuality, setLoadingQuality] = useState(false);
  const [errorQuality, setErrorQuality] = useState<string | null>(null);

  // Fetch job data
  const fetchJob = async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`/api/data/ingestion-jobs?job_id=${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch job: ${response.statusText}`);
      }

      const result = await response.json();
      setJob(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
      console.error('Error fetching job:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch audit events
  const fetchAuditEvents = async (correlationId: string) => {
    try {
      setLoadingAudit(true);
      setErrorAudit(null);

      const response = await fetch(`/api/data/audit-events?correlation_id=${correlationId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audit events: ${response.statusText}`);
      }

      const result = await response.json();
      setAuditEvents(result.data || []);
    } catch (err) {
      setErrorAudit(err instanceof Error ? err.message : 'Failed to load audit events');
      console.error('Error fetching audit events:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchJob();
  }, [jobId]);

  // Fetch audit events when job has correlation_id
  useEffect(() => {
    if (job?.correlation_id) {
      fetchAuditEvents(job.correlation_id);
    } else {
      setAuditEvents([]);
    }
  }, [job?.correlation_id]);

  // data_quality_issues cuando el job está terminado/analizado y hubo filas con error
  useEffect(() => {
    if (!jobId || !job) return;

    const st = job.status?.toLowerCase() ?? '';
    const showQuality =
      (st === 'completed' || st === 'analyzed') && (job.rows_error ?? 0) > 0;

    if (!showQuality) {
      setQualityIssues([]);
      setErrorQuality(null);
      setLoadingQuality(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingQuality(true);
        setErrorQuality(null);

        const response = await fetch(
          `/api/data/quality-issues?job_id=${encodeURIComponent(jobId)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch quality issues: ${response.statusText}`);
        }

        const result = await response.json();
        if (!cancelled) {
          setQualityIssues(Array.isArray(result.data) ? result.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorQuality(
            err instanceof Error ? err.message : 'Failed to load quality issues'
          );
          setQualityIssues([]);
        }
        console.error('Error fetching quality issues:', err);
      } finally {
        if (!cancelled) setLoadingQuality(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, job?.rows_error]);

  // Polling: refresh every 5-10 seconds while job is not completed/error
  useEffect(() => {
    if (!job || !job.status) return;

    const status = job.status.toLowerCase();
    const isFinished = status === 'completed' || status === 'error' || status === 'failed';

    if (isFinished) return;

    const interval = setInterval(() => {
      fetchJob();
    }, 7000); // 7 seconds

    return () => clearInterval(interval);
  }, [job?.status, jobId]);

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };


  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!job?.rows_total || job.rows_total === 0) return null;
    if (!job.rows_ok) return 0;
    return Math.round((job.rows_ok / job.rows_total) * 100);
  };

  const progressPercentage = getProgressPercentage();
  const isProcessing = job?.status && 
    !['completed', 'error', 'failed'].includes(job.status.toLowerCase());

  if (loading) {
    return (
      <div>
        <PageTitle title="Estado de Ingesta" />
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d] mb-4"></div>
          <p className="text-secondary">Cargando estado del job...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div>
        <PageTitle title="Estado de Ingesta" />
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-300">
            {error || 'Job no encontrado'}
          </p>
        </div>
      </div>
    );
  }

  // Get status explanation
  const getStatusExplanation = (status: string | null) => {
    if (!status) return null;
    
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'awaiting_mapping') {
      return 'Falta mapeo de columnas. Se requiere aprobación/corrección.';
    }
    
    if (statusLower === 'analyzed') {
      return 'Archivo analizado. Preparando normalización.';
    }
    
    if (statusLower === 'completed') {
      return 'Carga completa.';
    }
    
    return null;
  };

  const statusExplanation = getStatusExplanation(job.status);

  const showQualityAlerts = (job.rows_error ?? 0) > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PageTitle 
          title="Estado de Ingesta"
          subtitle="Seguimiento del procesamiento y trazabilidad del archivo"
        />
        <Link
          href="/ingestion/jobs"
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors text-sm font-medium"
        >
          ← Volver a Jobs
        </Link>
      </div>

      {/* Status Explanation */}
      {statusExplanation && (
        <div className="card mb-6 border-[#9aff8d]/30">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[#9aff8d] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-white font-medium mb-1">Qué significa este estado</h3>
              <p className="text-secondary text-sm">{statusExplanation}</p>
            </div>
          </div>
        </div>
      )}

      {job.status?.toLowerCase() === 'awaiting_mapping' && (
        <IngestionMappingWorkflow jobId={jobId} initialJob={job} />
      )}

      {/* Card 1: Resumen del Job */}
      <SectionCard 
        title="Resumen del Job"
        description="Información básica del job de ingesta"
      >

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-secondary">Job ID:</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-sm">{job.job_id}</span>
              <CopyButton textToCopy={job.job_id} />
            </div>
          </div>

          {job.upload_id && (
            <div className="flex items-center justify-between">
              <span className="text-secondary">Upload ID:</span>
              <span className="text-white font-mono text-sm">{job.upload_id}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-secondary">Status:</span>
            <StatusBadge status={job.status} />
          </div>

          {job.pipeline_version && (
            <div className="flex items-center justify-between">
              <span className="text-secondary">Pipeline Version:</span>
              <span className="text-white text-sm">{job.pipeline_version}</span>
            </div>
          )}

          {job.mapping_profile_id && (
            <div className="flex items-center justify-between">
              <span className="text-secondary">Mapping Profile ID:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-sm">{job.mapping_profile_id}</span>
                <CopyButton textToCopy={job.mapping_profile_id!} label="Ver mapeo" />
              </div>
            </div>
          )}

          {job.correlation_id && (
            <div className="flex items-center justify-between">
              <span className="text-secondary">Correlation ID:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-sm">{job.correlation_id}</span>
                <CopyButton textToCopy={job.correlation_id!} />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Card 2: Progreso */}
      <SectionCard 
        title="Progreso"
        description="Estado del procesamiento de filas"
      >

        {job.rows_total !== null && job.rows_total > 0 ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-secondary text-sm">Progreso</span>
                <span className="text-white font-medium">{progressPercentage || 0}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-[#9aff8d] h-full transition-all duration-500"
                  style={{ width: `${progressPercentage || 0}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-secondary">Total:</span>
                <span className="text-white font-medium ml-2">{job.rows_total}</span>
              </div>
              <div>
                <span className="text-secondary">OK:</span>
                <span className="text-green-400 font-medium ml-2">{job.rows_ok || 0}</span>
              </div>
              <div>
                <span className="text-secondary">Error:</span>
                <span className="text-red-400 font-medium ml-2">{job.rows_error || 0}</span>
              </div>
            </div>
          </div>
        ) : job.rows_total === 0 && job.status?.toLowerCase() === 'awaiting_mapping' ? (
          <div className="space-y-2">
            <p className="text-secondary">Esperando mapeo</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-secondary">Total:</span>
                <span className="text-white font-medium ml-2">0</span>
              </div>
              <div>
                <span className="text-secondary">OK:</span>
                <span className="text-green-400 font-medium ml-2">0</span>
              </div>
              <div>
                <span className="text-secondary">Error:</span>
                <span className="text-red-400 font-medium ml-2">0</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-secondary">
              {isProcessing ? 'Procesando...' : 'Sin datos de progreso disponibles'}
            </p>
            {isProcessing && (
              <div className="flex items-center gap-2">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#9aff8d]"></div>
                <span className="text-secondary text-sm">Actualizando automáticamente...</span>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {showQualityAlerts && (
        <SectionCard
          title="Alertas de Calidad"
          description="Errores detectados en canonicalización / upsert (V2-04): filas con issue_code en data_quality_issues"
          className="border-amber-600/30"
        >
          <QualityAlertTable
            rows={qualityIssues}
            loading={loadingQuality}
            error={errorQuality}
          />
        </SectionCard>
      )}

      {/* Card 3: Tiempos */}
      <SectionCard 
        title="Tiempos"
        description="Inicio y fin del procesamiento"
      >

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-secondary">Inicio:</span>
            <span className="text-white text-sm">{formatDate(job.started_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-secondary">Fin:</span>
            <span className="text-white text-sm">{formatDate(job.ended_at)}</span>
          </div>
          {job.started_at && job.ended_at && (
            <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
              <span className="text-secondary">Duración:</span>
              <span className="text-white text-sm">
                {Math.round((new Date(job.ended_at).getTime() - new Date(job.started_at).getTime()) / 1000)} segundos
              </span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Card 4: Bitácora (Audit) */}
      <SectionCard 
        title="Bitácora (Audit)"
        description="Eventos de auditoría y trazabilidad"
      >

        {!job.correlation_id ? (
          <p className="text-secondary">
            Aún no hay correlation_id registrado
          </p>
        ) : (
          <>
            {loadingAudit ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#9aff8d] mb-2"></div>
                <p className="text-secondary text-sm">Cargando eventos de auditoría...</p>
              </div>
            ) : errorAudit ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">Error: {errorAudit}</p>
              </div>
            ) : auditEvents.length === 0 ? (
              <p className="text-secondary">No hay eventos de auditoría disponibles</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Tipo</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Resumen</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Entidad</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Entity ID</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-700">
                    {auditEvents.map((event) => (
                      <tr key={event.event_id} className="hover:bg-zinc-700/50">
                        <td className="px-3 py-2 text-xs text-zinc-400">
                          {formatDate(event.created_at)}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-400">
                          {event.event_type || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-400">
                          {event.summary || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-400">
                          {event.entity_type || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-400 font-mono">
                          {event.entity_id ? event.entity_id.substring(0, 8) + '...' : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-400 font-mono">
                          {event.payload_hash_sha256 ? (
                            <div className="flex items-center gap-2">
                              <span>{event.payload_hash_sha256.substring(0, 12)}...</span>
                              <CopyButton textToCopy={event.payload_hash_sha256!} />
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}

