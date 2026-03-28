'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabaseClient';
import PageTitle from '../components/ui/PageTitle';
import SectionCard from '../components/ui/SectionCard';
import StatusBadge from '../components/ui/StatusBadge';
import CopyButton from '../components/ui/CopyButton';
import { publishMartsRefreshCompleted } from '@/lib/trazzosMartsBroadcast';

interface SessionResponse {
  [key: string]: any;
}

interface IngestionJob {
  job_id: string;
  status: string | null;
}

interface PreparedUpload {
  fileName: string;
  contentType: string;
  body: Blob;
  originalName: string;
  wasJsonConverted: boolean;
}
type DatasetType = 'shutdowns' | 'needs' | 'suppliers';
type UploadPhase = 'idle' | 'validating' | 'uploading' | 'processing';

export default function IngestionPage() {
  // IDs fijos según requerimiento
  const FIXED_COMPANY_ID = 'aaaa1111-1111-4111-a111-111111111111'; // Reficar
  const FIXED_USER_ID = 'bff82884-0263-4bc1-8895-3567c2c02b55';
  const FIXED_CLUSTER_ID = 'c1057e40-5e34-4e3a-b856-42f2b4b8a248';

  // Form inputs
  const [companyId, setCompanyId] = useState<string>(FIXED_COMPANY_ID);
  const [userId, setUserId] = useState<string>(FIXED_USER_ID);
  const [userEmail, setUserEmail] = useState<string>('');
  const [appUrl, setAppUrl] = useState<string>('http://localhost:3000');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [datasetType, setDatasetType] = useState<DatasetType>('needs');
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');

  const inferDatasetType = (f: File | null): DatasetType => {
    if (!f) return 'needs';
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'xlsx') return 'suppliers';
    return 'needs';
  };

  const normalizeTrackingId = (value: unknown): string => {
    const str = String(value ?? '').trim();
    if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') return '';
    return str;
  };

  // Error global para mostrar en alerta roja
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [mappingAppliedBanner, setMappingAppliedBanner] = useState(false);

  // User profile loading state
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  // Step 1 - Session
  const [sessionResponse, setSessionResponse] = useState<SessionResponse | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [errorSession, setErrorSession] = useState<string | null>(null);
  const [successSession, setSuccessSession] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  // Step 2 - Upload
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<number | null>(null);
  const [errorUpload, setErrorUpload] = useState<string | null>(null);
  const [successUpload, setSuccessUpload] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // Step 3 - Confirm
  const [confirmResponse, setConfirmResponse] = useState<any>(null);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [errorConfirm, setErrorConfirm] = useState<string | null>(null);
  const [successConfirm, setSuccessConfirm] = useState(false);

  // Helpers (declarados antes de su primer uso)
  const findNestedValue = (obj: any, keys: string[]): string | null => {
    for (const key of keys) {
      if (obj[key]) return obj[key];
      for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          const found = findNestedValue(obj[k], [key]);
          if (found) return found;
        }
      }
    }
    return null;
  };

  const extractIds = (response: SessionResponse) => {
    const jobIdKeys = ['job_id', 'jobId'];
    const uploadIdKeys = ['upload_id', 'uploadId'];
    const correlationIdKeys = ['correlation_id', 'correlationId'];
    const hashKeys = ['hash', 'payload_hash', 'payload_hash_sha256'];
    return {
      jobId: findNestedValue(response, jobIdKeys),
      uploadId: findNestedValue(response, uploadIdKeys),
      correlationId: findNestedValue(response, correlationIdKeys),
      hash: findNestedValue(response, hashKeys),
    };
  };

  const isInvalidTrackingId = (value: string | null | undefined): boolean => {
    if (value == null) return true;
    const s = String(value).trim().toLowerCase();
    return s === '' || s === 'undefined' || s === 'null';
  };

  const extractSignedUrl = (response: SessionResponse): string | null => {
    const possibleKeys = ['signed_url', 'signedUrl', 'url', 'upload_url', 'signedUploadUrl'];
    for (const key of possibleKeys) {
      if (response[key]) return response[key];
    }
    return null;
  };

  const createClientJobId = (): string => {
    try {
      return crypto.randomUUID();
    } catch {
      return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  };

  /**
   * Extrae las primeras 3 filas del archivo (JSON, JSONL o CSV) para sample_data.
   * Devuelve array de objetos para que n8n Workflow 3 pueda usar sugerencias de mapeo.
   */
  const extractSampleDataFromFile = async (inputFile: File): Promise<Record<string, unknown>[] | null> => {
    const ext = inputFile.name.split('.').pop()?.toLowerCase();
    try {
      const text = await inputFile.text();
      if (ext === 'csv') {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;
        const delimiter = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows: Record<string, unknown>[] = [];
        for (let i = 1; i < Math.min(4, lines.length); i++) {
          const values = lines[i].split(delimiter);
          const obj: Record<string, unknown> = {};
          headers.forEach((h, j) => { obj[h] = values[j]?.trim().replace(/^"|"$/g, '') ?? ''; });
          rows.push(obj);
        }
        return rows.length ? rows : null;
      }
      if (ext === 'jsonl') {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const out: Record<string, unknown>[] = [];
        for (let i = 0; i < Math.min(3, lines.length); i++) {
          try {
            const parsed = JSON.parse(lines[i]) as Record<string, unknown>;
            if (parsed && typeof parsed === 'object') out.push(parsed);
          } catch { /* skip invalid line */ }
        }
        return out.length ? out : null;
      }
      if (ext === 'json') {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.slice(0, 3).filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
        if (parsed && typeof parsed === 'object') return [parsed as Record<string, unknown>];
        return null;
      }
    } catch (e) {
      console.warn('[extractSampleDataFromFile] Error leyendo archivo:', e);
    }
    return null;
  };

  /**
   * Extrae todas las filas del archivo (JSON, JSONL o CSV) para enviar como data a upload-confirm.
   * Usado para que n8n reciba las filas a procesar (no solo sample_data).
   */
  const extractAllRowsFromFile = async (inputFile: File): Promise<Record<string, unknown>[]> => {
    const ext = inputFile.name.split('.').pop()?.toLowerCase();
    try {
      const text = await inputFile.text();
      if (ext === 'csv') {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) return [];
        const delimiter = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows: Record<string, unknown>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter);
          const obj: Record<string, unknown> = {};
          headers.forEach((h, j) => { obj[h] = values[j]?.trim().replace(/^"|"$/g, '') ?? ''; });
          rows.push(obj);
        }
        return rows;
      }
      if (ext === 'jsonl') {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const out: Record<string, unknown>[] = [];
        for (let i = 0; i < lines.length; i++) {
          try {
            const parsed = JSON.parse(lines[i]) as Record<string, unknown>;
            if (parsed && typeof parsed === 'object') out.push(parsed);
          } catch { /* skip invalid line */ }
        }
        return out;
      }
      if (ext === 'json') {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
        if (parsed && typeof parsed === 'object') return [parsed as Record<string, unknown>];
        return [];
      }
    } catch (e) {
      console.warn('[extractAllRowsFromFile] Error leyendo archivo:', e);
    }
    return [];
  };

  /** Escapa un valor de celda CSV (RFC-style). No usar sobre la línea de cabecera completa. */
  const csvEscape = (value: unknown): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const cellPlainText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  /**
   * JSON/JSONL → CSV: primera línea = nombres de columna separados por comas (texto plano, una celda por columna).
   * Cada nombre se escapa solo si lleva comas/comillas/saltos; nunca se envuelve toda la cabecera en un solo campo.
   */
  const buildPreparedUpload = async (inputFile: File): Promise<PreparedUpload> => {
    const ext = inputFile.name.split('.').pop()?.toLowerCase();
    const isJsonLike = ext === 'json' || ext === 'jsonl';

    if (!isJsonLike) {
      return {
        fileName: inputFile.name,
        contentType: inputFile.type || 'application/octet-stream',
        body: inputFile,
        originalName: inputFile.name,
        wasJsonConverted: false,
      };
    }

    const rows: Record<string, unknown>[] = [];

    if (ext === 'jsonl') {
      const text = await inputFile.text();
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        try {
          const parsed = JSON.parse(t) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            rows.push(parsed as Record<string, unknown>);
          }
        } catch {
          /* línea inválida: omitir */
        }
      }
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await inputFile.text());
      } catch {
        throw new Error('El archivo JSON no es válido');
      }
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            rows.push(item as Record<string, unknown>);
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        rows.push(parsed as Record<string, unknown>);
      }
    }

    if (rows.length === 0) {
      throw new Error('El JSON no contiene objetos (filas) para convertir a CSV');
    }

    const columnOrder: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (!seen.has(key)) {
          seen.add(key);
          columnOrder.push(key);
        }
      }
    }

    const headerLine = columnOrder.map((name) => csvEscape(name)).join(',');
    const csvRows = rows.map((row) =>
      columnOrder.map((key) => csvEscape(cellPlainText(row[key]))).join(','),
    );
    const csv = [headerLine, ...csvRows].join('\n');

    return {
      fileName: 'data.csv',
      contentType: 'text/csv',
      body: new Blob([csv], { type: 'text/csv' }),
      originalName: inputFile.name,
      wasJsonConverted: true,
    };
  };

  const phaseLabel: Record<UploadPhase, string> = {
    idle: '',
    validating: 'Validando archivo',
    uploading: 'Subiendo a la nube',
    processing: 'Procesando sinergias',
  };
  const formBusy = loadingSession || uploadPhase === 'processing';
  const buttonText = formBusy ? (phaseLabel[uploadPhase] || 'Procesando…') : 'Subir archivo';

  /** Job que pasó a awaiting_mapping tras esta carga: CTA a pantalla de mapeo. */
  const [awaitingMappingJobId, setAwaitingMappingJobId] = useState<string | null>(null);

  // Recent Jobs
  const [recentJobs, setRecentJobs] = useState<IngestionJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Notificación de job completado
  const [completionToast, setCompletionToast] = useState<string | null>(null);
  const [refreshingMarts, setRefreshingMarts] = useState(false);
  const [forcingComplete, setForcingComplete] = useState<string | null>(null);
  const prevJobStatusRef = useRef<Map<string, string | null>>(new Map());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabaseClient.channel> | null>(null);
  const autoCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionResponseRef = useRef<SessionResponse | null>(null);
  /** job_id canónico V2-01: misma referencia para confirm (V2-03) y polling; no depende solo del estado async. */
  const jobIdRef = useRef<string | null>(null);
  const sampleDataRef = useRef<Record<string, unknown>[] | null>(null);
  const fileRowsRef = useRef<Record<string, unknown>[] | null>(null);

  // Persistir / restaurar IDs de tracking en localStorage
  const persistTrackingIds = (ids: { jobId?: string | null; uploadId?: string | null; correlationId?: string | null }) => {
    try {
      if (ids.jobId) localStorage.setItem('trazzos_tracked_job_id', ids.jobId);
      if (ids.uploadId) localStorage.setItem('trazzos_tracked_upload_id', ids.uploadId);
      if (ids.correlationId) localStorage.setItem('trazzos_tracked_correlation_id', ids.correlationId);
    } catch { /* quota exceeded o SSR */ }
  };

  const clearTrackingIds = () => {
    try {
      localStorage.removeItem('trazzos_tracked_job_id');
      localStorage.removeItem('trazzos_tracked_upload_id');
      localStorage.removeItem('trazzos_tracked_correlation_id');
    } catch { /* noop */ }
  };

  // Consultas de estado usan solo job_id (UUID) como llave. correlation_id es solo metadato de auditoría.
  const getTrackedJobId = useCallback((): string | null => {
    const raw = jobIdRef.current ?? jobId ?? (typeof window !== 'undefined' ? localStorage.getItem('trazzos_tracked_job_id') : null);
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || id.toLowerCase() === 'undefined' || id.toLowerCase() === 'null') return null;
    return id;
  }, [jobId]);

  // Load user profile on mount + restore persisted tracking IDs (solo job_id para estado; correlation_id no se usa para búsqueda)
  useEffect(() => {
    fetchUserProfile();
    fetchRecentJobs();

    try {
      const savedJobId = localStorage.getItem('trazzos_tracked_job_id');
      const savedUploadId = localStorage.getItem('trazzos_tracked_upload_id');
      const validJobId = savedJobId?.trim() && savedJobId.toLowerCase() !== 'undefined' ? savedJobId : null;
      if (validJobId) {
        jobIdRef.current = validJobId;
        setJobId(validJobId);
        startJobPolling();
      }
      if (savedUploadId || validJobId) {
        setSessionResponse((prev) => prev ?? {
          upload_id: savedUploadId || undefined,
          job_id: validJobId ?? undefined,
        });
      }
    } catch { /* noop */ }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (autoCompleteTimeoutRef.current) clearTimeout(autoCompleteTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('success') === 'mapping_applied' || q.get('mappingSuccess') === '1') {
      setMappingAppliedBanner(true);
      q.delete('success');
      q.delete('mappingSuccess');
      const qs = q.toString();
      const path = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
      window.history.replaceState(null, '', path);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoadingProfile(true);

      const response = await fetch('/api/auth/profile');
      
      if (!response.ok) {
        // No bloquear la página si el perfil falla; los IDs fijos son suficientes
        console.warn('[fetchUserProfile] Perfil no disponible (status %d). Usando IDs fijos.', response.status);
        return;
      }

      const result = await response.json();
      const profile = result.data;

      if (profile) {
        setUserEmail(profile.email || '');
      }
    } catch (err) {
      // Silencioso: los IDs fijos ya están configurados, el email es opcional
      console.warn('[fetchUserProfile] No se pudo cargar el perfil, usando IDs fijos:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Listado de jobs: API usa job_id cuando se consulta uno; aquí traemos todos. Sin correlation_id como llave.
  const fetchRecentJobs = async () => {
    try {
      setLoadingJobs(true);
      const response = await fetch('/api/data/ingestion-jobs');
      if (response.ok) {
        const result = await response.json();
        const jobs: IngestionJob[] = (result.data || []).slice(0, 10);
        setRecentJobs(jobs);
        // Guardar estado inicial para detección de transiciones
        if (prevJobStatusRef.current.size === 0) {
          jobs.forEach(j => prevJobStatusRef.current.set(j.job_id, j.status));
        }
      }
    } catch (err) {
      console.error('Error fetching recent jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleRefreshMarts = useCallback(async () => {
    try {
      setRefreshingMarts(true);
      const res = await fetch('/api/workflows/refresh-marts', { method: 'POST' });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const counts = body.data?.counts;
        if (counts) {
          console.log('[refreshMarts] Conteos post-refresh:', counts);
          if (counts.mv_cluster_companies === 0) {
            console.warn('[refreshMarts] ⚠ mv_cluster_companies tiene 0 filas después del refresh');
          }
        }
        publishMartsRefreshCompleted(counts);
      } else {
        console.warn('[refreshMarts] Status:', res.status);
      }
    } catch (err) {
      console.warn('[refreshMarts] Error:', err);
    } finally {
      setRefreshingMarts(false);
    }
  }, []);

  const runJobCompletedLogic = useCallback((jobId: string) => {
    setCompletionToast(`Job ${jobId.substring(0, 8)}… completado`);
    handleRefreshMarts();
    clearTrackingIds();
    setAwaitingMappingJobId(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (autoCompleteTimeoutRef.current) {
      clearTimeout(autoCompleteTimeoutRef.current);
      autoCompleteTimeoutRef.current = null;
    }
    setTimeout(() => setCompletionToast(null), 8000);
  }, [handleRefreshMarts]);

  const runAwaitingMappingLogic = useCallback((targetJobId: string) => {
    setAwaitingMappingJobId(targetJobId);
    setUploadPhase('idle');
    setLoadingSession(false);
    setLoadingConfirm(false);
    if (autoCompleteTimeoutRef.current) {
      clearTimeout(autoCompleteTimeoutRef.current);
      autoCompleteTimeoutRef.current = null;
    }
    setCompletionToast('Mapeo de columnas requerido');
    setTimeout(() => setCompletionToast(null), 10_000);
    fetchRecentJobs();
  }, []);

  // Polling de estado: solo job_id identifica cada job. correlation_id no se usa para búsqueda (evita 'undefined' si el flujo se reinició).
  const startJobPolling = useCallback(() => {
    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/data/ingestion-jobs');
        if (!response.ok) return;
        const result = await response.json();
        const jobs: IngestionJob[] = (result.data || []).slice(0, 10);
        const tracked = getTrackedJobId();

        const trackedJobRow = tracked ? jobs.find((j) => j.job_id === tracked) : undefined;
        if (trackedJobRow?.status?.toLowerCase() === 'awaiting_mapping') {
          if (autoCompleteTimeoutRef.current) {
            clearTimeout(autoCompleteTimeoutRef.current);
            autoCompleteTimeoutRef.current = null;
          }
          setUploadPhase('idle');
          setLoadingSession(false);
          setLoadingConfirm(false);
          setAwaitingMappingJobId(tracked!);
        }

        jobs.forEach(job => {
          const prev = prevJobStatusRef.current.get(job.job_id);
          const curr = job.status?.toLowerCase();
          const wasRunning = prev && ['running', 'processing', 'pending', 'uploading', 'updating'].includes(prev.toLowerCase());
          if (wasRunning && curr === 'completed') {
            runJobCompletedLogic(job.job_id);
          }
          if (
            tracked &&
            job.job_id === tracked &&
            curr === 'awaiting_mapping' &&
            prev?.toLowerCase() !== 'awaiting_mapping'
          ) {
            runAwaitingMappingLogic(job.job_id);
          }
        });

        const newMap = new Map<string, string | null>();
        jobs.forEach(j => newMap.set(j.job_id, j.status));
        prevJobStatusRef.current = newMap;
        setRecentJobs(jobs);

        const hasActive = jobs.some(j =>
          ['running', 'processing', 'pending', 'uploading', 'updating'].includes(j.status?.toLowerCase() || '')
        );
        if (!hasActive && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {
        // Silenciar errores de polling
      }
    }, 10_000);
  }, [runJobCompletedLogic, runAwaitingMappingLogic, getTrackedJobId]);

  // Suscripción Realtime: solo job_id (UUID) como llave de búsqueda. correlation_id no se usa aquí (es auditoría).
  useEffect(() => {
    const trackedId = getTrackedJobId();
    if (!trackedId) return;

    const channel = supabaseClient
      .channel(`ingestion_job:${trackedId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ingestion_jobs',
          filter: `job_id=eq.${trackedId}`,
        },
        (payload) => {
          const newRow = payload.new as { job_id?: string; status?: string };
          const status = newRow?.status?.toLowerCase();
          if (status === 'completed') {
            runJobCompletedLogic(newRow.job_id ?? trackedId);
            fetchRecentJobs();
            realtimeChannelRef.current?.unsubscribe();
            realtimeChannelRef.current = null;
          } else if (status === 'awaiting_mapping') {
            runAwaitingMappingLogic(newRow.job_id ?? trackedId);
            fetchRecentJobs();
            realtimeChannelRef.current?.unsubscribe();
            realtimeChannelRef.current = null;
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
      realtimeChannelRef.current = null;
    };
  }, [jobId, runJobCompletedLogic, runAwaitingMappingLogic, getTrackedJobId]);

  const handleForceComplete = useCallback(async (forceJobId: string) => {
    try {
      setForcingComplete(forceJobId);
      const res = await fetch('/api/data/ingestion-jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: forceJobId }),
      });
      if (res.ok) {
        setCompletionToast(`Job ${forceJobId.substring(0, 8)}… marcado como completado`);
        handleRefreshMarts();
        clearTrackingIds();
        setTimeout(() => setCompletionToast(null), 8000);
        fetchRecentJobs();
      } else {
        const err = await res.json().catch(() => ({}));
        setGlobalError(err.error || 'Error al forzar completado');
      }
    } catch (err) {
      console.error('[forceComplete] Error:', err);
      setGlobalError('Error de red al forzar completado');
    } finally {
      setForcingComplete(null);
    }
  }, [handleRefreshMarts]);

  const autoCompleteIfStuck = useCallback(async (targetJobId: string) => {
    try {
      // Verificar estado actual antes de forzar cierre
      const res = await fetch('/api/data/ingestion-jobs');
      if (!res.ok) return;
      const payload = await res.json().catch(() => ({}));
      const jobs: IngestionJob[] = (payload.data || []).slice(0, 50);
      const target = jobs.find(j => j.job_id === targetJobId);
      const curr = target?.status?.toLowerCase() || '';
      const stillActive = ['running', 'processing', 'pending', 'uploading', 'updating'].includes(curr);
      if (!stillActive) return;

      console.warn('[autoCompleteIfStuck] Job sigue activo tras 10s, cerrando manualmente:', targetJobId, curr);
      const patch = await fetch('/api/data/ingestion-jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: targetJobId }),
      });
      if (patch.ok) {
        setCompletionToast(`Job ${targetJobId.substring(0, 8)}… marcado como completado (fallback 10s)`);
        clearTrackingIds();
        fetchRecentJobs();
        handleRefreshMarts();
        setTimeout(() => setCompletionToast(null), 8000);
      }
    } catch (err) {
      console.warn('[autoCompleteIfStuck] No se pudo aplicar cierre automático:', err);
    }
  }, [handleRefreshMarts]);

  // Step 1: Create session
  const handleCreateSession = async (preparedUpload?: PreparedUpload, forcedJobId?: string) => {
    console.log('[handleCreateSession] Iniciando creación de sesión...');
    setGlobalError(null);
    
    if (!file) {
      const errorMsg = 'Por favor selecciona un archivo';
      console.error('[handleCreateSession] Error:', errorMsg);
      setErrorSession(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    console.log('[handleCreateSession] Archivo seleccionado:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Validar tipo de archivo
    const validExtensions = ['.csv', '.json', '.jsonl', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      const errorMsg = `Tipo de archivo no soportado. Use: ${validExtensions.join(', ')}`;
      console.error('[handleCreateSession] Error:', errorMsg);
      setErrorSession(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    // Usar IDs fijos siempre
    const finalCompanyId = FIXED_COMPANY_ID;
    const finalUserId = FIXED_USER_ID;

    console.log('[handleCreateSession] IDs a usar:', {
      company_id: finalCompanyId,
      user_id: finalUserId,
    });

    try {
      setLoadingSession(true);
      setErrorSession(null);
      setSuccessSession(false);

      const detectedType = preparedUpload?.wasJsonConverted ? 'needs' : inferDatasetType(file);
      const uploadBlob = preparedUpload?.body || file;
      const uploadFileName = preparedUpload?.fileName || file.name;
      const uploadContentType = preparedUpload?.contentType || file.type || 'application/octet-stream';
      /** V2-02 Parser-CSV: el switch de n8n espera tipo corto `csv`, no solo MIME. */
      const sessionFileType = preparedUpload?.wasJsonConverted ? 'csv' : uploadContentType;
      const generatedJobId = forcedJobId || createClientJobId();

      const formData = new FormData();
      formData.append('file', uploadBlob, uploadFileName);
      formData.append('company_id', finalCompanyId);
      formData.append('user_id', finalUserId);
      formData.append('job_id', generatedJobId);
      formData.append('file_name', uploadFileName);
      formData.append('file_type', sessionFileType);
      formData.append('dataset_type', detectedType);
      formData.append('cluster_id', FIXED_CLUSTER_ID);

      // Respaldo inmediato: persistir job_id y ref (V2-01 = misma id en confirm/polling).
      persistTrackingIds({ jobId: generatedJobId });
      jobIdRef.current = generatedJobId;
      setJobId(generatedJobId);

      console.log('[handleCreateSession] Enviando request multipart a /api/workflows/upload-session:', {
        company_id: finalCompanyId,
        user_id: finalUserId,
        job_id: generatedJobId,
        file_name: uploadFileName,
        file_type: sessionFileType,
        dataset_type: detectedType,
        cluster_id: FIXED_CLUSTER_ID,
      });
      console.log('Enviando FormData con archivo de', uploadBlob.size, 'bytes');

      const controller = new AbortController();
      const uiTimeout = setTimeout(() => controller.abort(), 8_000);

      let response: Response;
      try {
        response = await fetch('/api/workflows/upload-session', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(uiTimeout);
        if (fetchErr?.name === 'AbortError') {
          throw new Error('Conexión con n8n fallida — no hubo respuesta en 8 s. Verifica que el workflow esté activo.');
        }
        throw fetchErr;
      }
      clearTimeout(uiTimeout);

      console.log('[handleCreateSession] Respuesta recibida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const errorMsg = errorData.error || errorData.message || `Failed to create session: ${response.statusText}`;
        console.error('[handleCreateSession] Error en respuesta:', errorMsg);
        throw new Error(errorMsg);
      }

      const result = await response.json();
      const data = result.data || result;
      const dataWithGuaranteedJobId = { ...data, job_id: data?.job_id || generatedJobId };

      sessionResponseRef.current = dataWithGuaranteedJobId;

      const ids = extractIds(dataWithGuaranteedJobId);
      const resolvedJobId = ids.jobId ?? dataWithGuaranteedJobId?.job_id ?? generatedJobId;
      jobIdRef.current = resolvedJobId ?? null;
      if (ids.jobId) {
        setJobId(ids.jobId);
        console.log('[handleCreateSession] Job ID extraído (estado + ref):', ids.jobId);
      }

      console.log('[handleCreateSession] Datos recibidos (upload_id incluido para confirm):', dataWithGuaranteedJobId);
      console.log('%c[V2 Completado] ✓ Sesión creada con éxito — esperando procesamiento de sinergias…', 'color: #9aff8d; font-weight: bold');

      setSessionResponse(dataWithGuaranteedJobId);
      setSuccessSession(true);
      setCompletionToast('Procesamiento iniciado');
      setTimeout(() => setCompletionToast(null), 5000);
      setFile(null);
      setPreviewData([]);
      if (ids.uploadId) {
        console.log('[handleCreateSession] Upload ID extraído (para V2-02-DB-Get-Upload-Metadata):', ids.uploadId);
      }

      persistTrackingIds({ jobId: ids.jobId, uploadId: ids.uploadId, correlationId: ids.correlationId });
      
      const url = extractSignedUrl(dataWithGuaranteedJobId);
      if (url) {
        setSignedUrl(url);
        console.log('[handleCreateSession] Signed URL obtenida');
      }

      return { data: dataWithGuaranteedJobId, signedUrl: url, uploadId: ids.uploadId };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      console.error('[handleCreateSession] Error capturado:', err);
      setErrorSession(errorMessage);
      setGlobalError(errorMessage);
      setSuccessSession(false);
      return null; // Retornar null en caso de error
    } finally {
      setLoadingSession(false);
      console.log('[handleCreateSession] Finalizado, loadingSession:', false);
    }
  };

  // Step 2: Upload file
  // urlOverride permite pasar la URL directamente sin esperar el re-render de React
  const handleUploadFile = async (urlOverride?: string, preparedUpload?: PreparedUpload) => {
    console.log('[handleUploadFile] Iniciando subida de archivo...');
    setGlobalError(null);

    const targetUrl = urlOverride || signedUrl;
    
    if (!file && !preparedUpload) {
      const errorMsg = 'Archivo es requerido';
      console.error('[handleUploadFile] Error:', errorMsg);
      setErrorUpload(errorMsg);
      setGlobalError(errorMsg);
      return false;
    }

    if (!targetUrl) {
      const errorMsg = 'Falta signed_url. Por favor crea una sesión primero.';
      console.error('[handleUploadFile] Error:', errorMsg);
      setErrorUpload(errorMsg);
      setGlobalError(errorMsg);
      return false;
    }

    const fallbackFile = file ?? undefined;
    const bodyToUpload = preparedUpload?.body ?? fallbackFile;
    const contentTypeToUpload = preparedUpload?.contentType ?? fallbackFile?.type ?? 'application/octet-stream';
    const uploadName = preparedUpload?.fileName ?? fallbackFile?.name ?? 'data.csv';
    if (!bodyToUpload) {
      const errorMsg = 'No hay contenido para subir';
      console.error('[handleUploadFile] Error:', errorMsg);
      setErrorUpload(errorMsg);
      setGlobalError(errorMsg);
      return false;
    }
    const uploadSize = bodyToUpload.size;

    console.log('[handleUploadFile] Subiendo archivo:', {
      name: uploadName,
      original_name: preparedUpload?.originalName ?? fallbackFile?.name ?? uploadName,
      size: uploadSize,
      type: contentTypeToUpload,
      converted_from_json: Boolean(preparedUpload?.wasJsonConverted),
      signedUrl: targetUrl.substring(0, 50) + '...',
    });

    try {
      setUploading(true);
      setErrorUpload(null);
      setSuccessUpload(false);

      const response = await fetch(targetUrl, {
        method: 'PUT',
        body: bodyToUpload,
        headers: {
          'Content-Type': contentTypeToUpload,
        },
      });

      console.log('[handleUploadFile] Respuesta de subida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      setUploadStatus(response.status);

      if (response.status === 200 || response.status === 201 || response.status === 204) {
        console.log('[handleUploadFile] Archivo subido exitosamente');
        setSuccessUpload(true);
        return true; // Retornar éxito
      } else {
        const errorText = await response.text().catch(() => '');
        const errorMsg = `Upload failed with status ${response.status}: ${errorText || 'Unknown error'}`;
        console.error('[handleUploadFile] Error en subida:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
      console.error('[handleUploadFile] Error capturado:', err);
      setErrorUpload(errorMessage);
      setGlobalError(errorMessage);
      setSuccessUpload(false);
      return false; // Retornar error
    } finally {
      setUploading(false);
      console.log('[handleUploadFile] Finalizado, uploading:', false);
    }
  };

  // Refresco diferido: espera 5s y luego llama a refresh_cluster_marts
  const scheduleDelayedRefresh = useCallback(() => {
    console.log('[scheduleDelayedRefresh] Programando refresh_cluster_marts en 5s...');
    setTimeout(async () => {
      console.log('[scheduleDelayedRefresh] Ejecutando refresh_cluster_marts...');
      await handleRefreshMarts();
      fetchRecentJobs();
    }, 5_000);
  }, [handleRefreshMarts]);

  /**
   * Confirmación de carga. Usar sessionSnapshot cuando se disponga del objeto de respuesta
   * de la sesión (Workflow 1) para no depender de estado asíncrono (jobId/uploadId) en el click.
   * @param sessionSnapshot Objeto de respuesta de upload-session (job_id, upload_id, correlation_id, signed_url). Si se pasa, se usa como única fuente de IDs.
   */
  const handleConfirm = async (sessionSnapshot?: SessionResponse | null) => {
    console.log('[handleConfirm] Iniciando confirmación...', sessionSnapshot ? '(con snapshot de sesión)' : '(ref/estado)');
    setGlobalError(null);
    setErrorConfirm(null);

    // Validación pre-vuelo: user_email requerido para Workflow 3 (objeto de perfil, no null)
    const effectiveEmail = (userEmail ?? '').trim();
    if (!effectiveEmail) {
      const aviso = 'Debe iniciar sesión nuevamente para obtener su identidad antes de confirmar la carga.';
      setErrorConfirm(aviso);
      setGlobalError('No se pudo obtener su email. ' + aviso);
      return;
    }

    let effectiveSession: SessionResponse | null = null;

    if (sessionSnapshot && typeof sessionSnapshot === 'object') {
      effectiveSession = sessionSnapshot;
      console.log('[handleConfirm] Usando sessionSnapshot (respuesta de Workflow 1) como fuente de IDs');
    } else {
      effectiveSession = sessionResponseRef.current ?? sessionResponse;
      if (!effectiveSession) {
        try {
          const savedUploadId = localStorage.getItem('trazzos_tracked_upload_id');
          const savedJobId = localStorage.getItem('trazzos_tracked_job_id');
          const savedCorrelationId = localStorage.getItem('trazzos_tracked_correlation_id');
          if (savedUploadId || savedJobId) {
            effectiveSession = {
              upload_id: savedUploadId || undefined,
              job_id: savedJobId || undefined,
              correlation_id: savedCorrelationId || undefined,
            };
            setSessionResponse(effectiveSession);
            console.warn('[handleConfirm] Sesión reconstruida desde localStorage');
          }
        } catch { /* noop */ }
      }
    }

    if (!effectiveSession) {
      const errorMsg = 'Sesión no encontrada. Por favor crea una sesión primero.';
      setErrorConfirm(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    if (!successUpload) {
      const errorMsg = 'Por favor sube el archivo primero antes de confirmar.';
      setErrorConfirm(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    const ids = extractIds(effectiveSession);
    const canonicalJobId = (
      jobIdRef.current ||
      ids.jobId ||
      jobId ||
      (typeof window !== 'undefined' ? localStorage.getItem('trazzos_tracked_job_id') : null)
    )?.toString().trim() || '';

    const canonicalUploadId = sessionSnapshot ? ids.uploadId : (ids.uploadId ?? localStorage.getItem('trazzos_tracked_upload_id'));
    const canonicalCorrelationId = sessionSnapshot ? ids.correlationId : (ids.correlationId ?? correlationId ?? localStorage.getItem('trazzos_tracked_correlation_id'));

    if (isInvalidTrackingId(canonicalJobId)) {
      setErrorConfirm('El job_id de la sesión V2-01 no está disponible. Vuelve a crear la sesión.');
      setGlobalError('Error: job_id ausente. Reinicia la carga.');
      return;
    }

    if (isInvalidTrackingId(canonicalUploadId)) {
      setErrorConfirm('El ID de carga no es válido.');
      setGlobalError('Error: El ID de carga (upload_id) no es válido o está vacío.');
      return;
    }
    if (isInvalidTrackingId(canonicalCorrelationId)) {
      setErrorConfirm('El correlation_id no es válido.');
      setGlobalError('Error: correlation_id no es válido o está vacío.');
      return;
    }

    const uploadIdStr = String(canonicalUploadId).trim();
    const jobIdStr = String(canonicalJobId).trim();
    const correlationIdStr = String(canonicalCorrelationId).trim();

    jobIdRef.current = jobIdStr;
    persistTrackingIds({ jobId: jobIdStr, uploadId: uploadIdStr, correlationId: correlationIdStr });

    console.log('[handleConfirm] IDs usados (desde sesión):', { jobId: jobIdStr, uploadId: uploadIdStr, correlationId: correlationIdStr });

    try {
      setLoadingConfirm(true);
      setErrorConfirm(null);
      setSuccessConfirm(false);

      const payload = {
        job_id: jobIdStr,
        upload_id: uploadIdStr,
        correlation_id: correlationIdStr,
        user_email: effectiveEmail,
      };

      const payloadJson = JSON.stringify(payload);
      console.log('[handleConfirm] V2-03 payload (solo 4 campos hacia n8n):', payloadJson);

      let dispatched = false;

      try {
        const sendConfirm = async () => fetch('/api/workflows/upload-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let response = await sendConfirm();

        console.log('[handleConfirm] Respuesta:', response.status, response.statusText);
        if (response.ok) {
          console.log('[V6 trigger ACK] upload-confirm OK job_id=%s', payload.job_id);
          try {
            const bc = new BroadcastChannel('trazzos_marts');
            bc.postMessage({ type: 'n8n_v2_ok', ts: Date.now(), job_id: payload.job_id });
            bc.close();
          } catch { /* BroadcastChannel no soportado */ }
        }

        let text = await response.text().catch(() => '');

        // Retry único si hay 500 por sesión faltante
        if (!response.ok && response.status === 500) {
          const responseTextLc = (text || '').toLowerCase();
          const missingSession = responseTextLc.includes('sesión no encontrada')
            || responseTextLc.includes('sesion no encontrada')
            || responseTextLc.includes('session not found');
          if (missingSession) {
            console.warn('[handleConfirm] 500 por sesión faltante. Reintentando una vez con sesión local...');
            setSessionResponse({
              upload_id: uploadIdStr,
              job_id: jobIdStr,
              correlation_id: correlationIdStr,
            });
            response = await sendConfirm();
            text = await response.text().catch(() => '');
            console.log('[handleConfirm] Retry único ->', response.status, response.statusText);
          }
        }

        if (response.ok) {
          console.log('[handleConfirm] Body completo de respuesta n8n V2:', text);
          try {
            const parsed = text ? JSON.parse(text) : {};
            setConfirmResponse(parsed.data || parsed);
          } catch {
            setConfirmResponse({ message: text || 'OK' });
          }
        }
        // Cualquier respuesta (200, 202, 204, timeout parcial) = n8n recibió el request
        dispatched = true;
      } catch (networkErr) {
        // Incluso un timeout de fetch puede significar que n8n ya está procesando
        console.warn('[handleConfirm] Request falló (posible timeout), asumiendo dispatched:', networkErr);
        dispatched = true;
      }

      if (dispatched) {
        console.log('%c[V2 Completado] ✓ Confirm dispatched — esperando procesamiento de sinergias (V6)…', 'color: #9aff8d; font-weight: bold');
        setSuccessConfirm(true);
        setCompletionToast('Confirmación enviada — refrescando vistas en 5s…');
        setTimeout(() => setCompletionToast(null), 8000);

        // Siempre: polling + refresco diferido de vistas materializadas
        fetchRecentJobs();
        startJobPolling();
        scheduleDelayedRefresh();

        // Fallback de robustez: si 10s después de V2 el job sigue activo,
        // cerrarlo manualmente para evitar bloqueo de UI.
        if (jobIdStr) {
          if (autoCompleteTimeoutRef.current) clearTimeout(autoCompleteTimeoutRef.current);
          autoCompleteTimeoutRef.current = setTimeout(() => {
            autoCompleteIfStuck(jobIdStr);
          }, 10_000);
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to confirm';
      console.error('[handleConfirm] Error capturado:', err);
      setErrorConfirm(errorMessage);
      setGlobalError(errorMessage);
      setSuccessConfirm(false);
    } finally {
      setLoadingConfirm(false);
    }
  };

  // Función unificada para manejar el submit del formulario
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setErrorSession(null);
    setSuccessSession(false);
    setAwaitingMappingJobId(null);
    setUploadPhase('idle');

    try {
      setLoadingSession(true);
      setUploadPhase('validating');
      if (!file) throw new Error('Por favor selecciona un archivo');

      const validExtensions = ['.csv', '.json', '.jsonl', '.xlsx'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!validExtensions.includes(fileExtension)) {
        throw new Error(`Tipo de archivo no soportado. Use: ${validExtensions.join(', ')}`);
      }

      // Captura de sample_data (primeras 3 filas) y de todas las filas para data (upload-confirm / n8n)
      const sample_data = await extractSampleDataFromFile(file);
      sampleDataRef.current = sample_data;
      const fullRows = await extractAllRowsFromFile(file);
      fileRowsRef.current = fullRows;
      setPreviewData(fullRows);
      if (sample_data?.length) {
        console.log('[handleUpload] sample_data extraído (filas):', sample_data.length);
      }
      if (fullRows.length) {
        console.log('[handleUpload] filas totales para data:', fullRows.length);
      }

      let preparedForSession: PreparedUpload | null = null;
      if (fileExtension === '.json' || fileExtension === '.jsonl') {
        preparedForSession = await buildPreparedUpload(file);
      }

      const sessionFile = preparedForSession?.body ?? file;
      const sessionFileName = preparedForSession?.fileName ?? file.name;
      const sessionFileType = preparedForSession?.wasJsonConverted
        ? 'csv'
        : (file.type || 'application/octet-stream');
      const sessionDatasetType = preparedForSession?.wasJsonConverted ? 'needs' : datasetType;

      // Fase 1 (Session): pedir signed_url + IDs al proxy (JSON/JSONL ya convertidos a CSV en cliente)
      const formData = new FormData();
      formData.append('file', sessionFile, sessionFileName);
      formData.append('company_id', FIXED_COMPANY_ID);
      formData.append('user_id', FIXED_USER_ID);
      formData.append('file_name', sessionFileName);
      formData.append('file_type', sessionFileType);
      formData.append('dataset_type', sessionDatasetType);
      formData.append('cluster_id', FIXED_CLUSTER_ID);

      const sessionResponse = await fetch('/api/workflows/upload-session', {
        method: 'POST',
        body: formData,
      });

      if (!sessionResponse.ok) {
        const errBody = await sessionResponse.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || `Error ${sessionResponse.status}`);
      }

      const sessionResult = await sessionResponse.json().catch(() => ({}));
      const responseData = sessionResult?.data || {};
      const receivedJobId = normalizeTrackingId(
        responseData?.job_id ?? sessionResult?.job_id ?? responseData?.id ?? sessionResult?.id,
      );
      const receivedCorrelationId = normalizeTrackingId(
        responseData?.correlation_id ?? sessionResult?.correlation_id,
      );
      const receivedUploadId = normalizeTrackingId(
        responseData?.upload_id ?? responseData?.uploadId ?? sessionResult?.upload_id ?? sessionResult?.uploadId,
      );
      const signedUrlFromSession = responseData?.signed_url;
      if (!receivedJobId || !receivedCorrelationId || !signedUrlFromSession) {
        throw new Error('La sesión no devolvió job_id, correlation_id o signed_url');
      }
      if (!receivedUploadId) {
        throw new Error('La sesión no devolvió upload_id (requerido para confirmación)');
      }

      jobIdRef.current = receivedJobId;
      setJobId(String(receivedJobId));
      setCorrelationId(String(receivedCorrelationId));
      sessionResponseRef.current = {
        job_id: receivedJobId,
        correlation_id: receivedCorrelationId,
        upload_id: receivedUploadId,
        signed_url: signedUrlFromSession,
      };
      persistTrackingIds({ jobId: receivedJobId, uploadId: receivedUploadId, correlationId: receivedCorrelationId });

      // Fase 2 (Upload): subir el mismo cuerpo que declaró la sesión (CSV si hubo conversión desde JSON)
      setUploadPhase('uploading');
      const putContentType =
        preparedForSession?.wasJsonConverted ? 'text/csv' : (file.type || 'application/octet-stream');
      const putBody = preparedForSession?.body ?? file;
      const uploadResponse = await fetch(String(signedUrlFromSession), {
        method: 'PUT',
        headers: { 'Content-Type': putContentType },
        body: putBody,
      });
      if (!uploadResponse.ok) {
        const uploadBody = await uploadResponse.text().catch(() => '');
        throw new Error(uploadBody || `Error subiendo archivo (${uploadResponse.status})`);
      }

      // Fase 3 (Confirm - V2-02 / Workflow 3): metadatos de usuario requeridos por n8n
      const confirmEmail = (userEmail ?? '').trim();
      if (!confirmEmail) {
        setGlobalError('No se pudo obtener su email. Debe iniciar sesión nuevamente para obtener su identidad antes de confirmar la carga.');
        setUploadPhase('idle');
        return;
      }
      setUploadPhase('processing');
      const explicitJobId = jobIdRef.current ?? receivedJobId ?? jobId ?? '';
      const confirmJobId = normalizeTrackingId(explicitJobId);
      const confirmCorrelationId = normalizeTrackingId(receivedCorrelationId || correlationId || '');
      const confirmUploadId = normalizeTrackingId(receivedUploadId || '');
      if (!confirmJobId || !confirmCorrelationId || !confirmUploadId) {
        console.error('ERROR: Faltan IDs de seguimiento', { confirmJobId, confirmCorrelationId, confirmUploadId });
        throw new Error('Faltan job_id, correlation_id o upload_id para confirmar');
      }
      const confirmPayload = {
        job_id: confirmJobId,
        upload_id: confirmUploadId,
        correlation_id: confirmCorrelationId,
        user_email: confirmEmail,
      };
      console.log('[handleUpload] upload-confirm V2-03 (4 campos, mismo job_id que sesión/ref)');
      const confirmResponse = await fetch('/api/workflows/upload-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmPayload),
      });

      if (!confirmResponse.ok) {
        const errBody = await confirmResponse.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || `Error ${confirmResponse.status}`);
      }

      setSessionResponse({
        job_id: confirmJobId,
        correlation_id: confirmCorrelationId,
        upload_id: confirmUploadId,
        signed_url: signedUrlFromSession,
      });
      setSuccessSession(true);
      setFile(null);
      setPreviewData([]);
      persistTrackingIds({ jobId: confirmJobId, uploadId: confirmUploadId, correlationId: confirmCorrelationId });
      fetchRecentJobs();
      startJobPolling();
    } catch (err) {
      console.log('[upload] error:', err);
      setGlobalError(err instanceof Error ? err.message : 'Error al subir archivo');
      setUploadPhase('idle');
    } finally {
      setLoadingSession(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  return (
    <div>
      <PageTitle
        title="Cargas de Datos"
        subtitle="Sube y procesa archivos para análisis y normalización"
      />

      {mappingAppliedBanner && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-[#9aff8d]/50 bg-[#9aff8d]/15 px-4 py-3 text-zinc-100 shadow-md"
        >
          <p className="font-semibold text-[#9aff8d]">Mapeo aplicado. El procesamiento ha comenzado</p>
          <p className="mt-1 text-sm text-zinc-300">
            Puedes seguir el estado del job en la lista de cargas recientes.
          </p>
          <button
            type="button"
            onClick={() => setMappingAppliedBanner(false)}
            className="mt-2 text-xs font-medium text-zinc-400 underline hover:text-zinc-200"
          >
            Cerrar aviso
          </button>
        </div>
      )}

      {/* A. Subir archivo */}
      <SectionCard
        title="Subir archivo"
        description="Inicia una nueva carga de datos al sistema"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Tipo de Dataset
            </label>
            <select
              value={datasetType}
              onChange={(e) => setDatasetType(e.target.value as DatasetType)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            >
              <option value="shutdowns">shutdowns</option>
              <option value="needs">needs</option>
              <option value="suppliers">suppliers</option>
            </select>
            <p className="mt-1 text-xs text-zinc-500">Selecciona el dataset antes de iniciar la carga</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Archivo <span className="text-red-400">*</span>
            </label>
            <input
              type="file"
              accept=".csv,.json,.jsonl,.xlsx"
              onChange={async (e) => {
                const selectedFile = e.target.files?.[0] || null;
                setFile(selectedFile);
                if (selectedFile) {
                  console.log('[File Input] Archivo seleccionado:', {
                    name: selectedFile.name,
                    size: selectedFile.size,
                    type: selectedFile.type,
                  });
                  try {
                    const sample = await extractSampleDataFromFile(selectedFile);
                    sampleDataRef.current = sample;
                    const rows = await extractAllRowsFromFile(selectedFile);
                    fileRowsRef.current = rows;
                    setPreviewData(rows);
                  } catch (err) {
                    console.warn('[File Input] Error extrayendo filas para preview:', err);
                    setPreviewData([]);
                    fileRowsRef.current = null;
                  }
                } else {
                  setPreviewData([]);
                  fileRowsRef.current = null;
                }
              }}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            />
            {file && (
              <p className="mt-2 text-xs text-zinc-500">
                Seleccionado: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Company ID (UUID) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={companyId}
              disabled
              readOnly
              placeholder="Reficar (fijo)"
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-zinc-500">Valor fijo: Reficar</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              User ID (UUID) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={userId}
              disabled
              readOnly
              placeholder="Usuario fijo"
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-zinc-500">Valor fijo asignado</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              User Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={userEmail}
              disabled
              readOnly
              placeholder={loadingProfile ? 'Cargando...' : 'user@example.com'}
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-400 cursor-not-allowed"
            />
            {userEmail && (
              <p className="mt-1 text-xs text-zinc-500">Obtenido automáticamente de tu perfil</p>
            )}
          </div>
        </div>

        {/* Alerta de error global (roja) */}
        {globalError && (
          <div className="bg-red-900/30 border-2 border-red-600 rounded-lg p-4 mb-4 animate-pulse">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-red-200 font-semibold text-sm mb-1">Error en la carga</p>
                <p className="text-red-300 text-sm">{globalError}</p>
              </div>
            </div>
          </div>
        )}

        {errorSession && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">Error: {errorSession}</p>
          </div>
        )}

        {successSession && !awaitingMappingJobId && (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 mb-4">
            <p className="text-green-300 text-sm">Archivo recibido, procesando sinergias...</p>
          </div>
        )}

        {awaitingMappingJobId && (
          <div
            role="alert"
            className="mb-6 rounded-xl border-2 border-amber-500/70 bg-amber-950/40 p-6 shadow-lg shadow-amber-900/20"
          >
            <p className="text-amber-100 font-semibold text-lg mb-1">Mapeo de columnas requerido</p>
            <p className="text-amber-200/90 text-sm mb-4">
              El pipeline detuvo la carga en este job hasta que definas el mapeo. Continúa en la pantalla de configuración.
            </p>
            <Link
              href={`/ingestion/mapping/${awaitingMappingJobId}`}
              className="inline-flex w-full sm:w-auto justify-center items-center px-8 py-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-base transition-colors shadow-md"
            >
              Configurar Mapeo Requerido
            </Link>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          {formBusy && uploadPhase !== 'idle' && (
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#9aff8d] border-t-transparent" />
              <span>{phaseLabel[uploadPhase]}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={formBusy || !file}
            className="w-full px-6 py-3 bg-[#9aff8d] hover:bg-[#9aff8d]/80 disabled:bg-zinc-700 disabled:text-zinc-400 text-[#232323] rounded-md transition-colors font-medium disabled:cursor-not-allowed"
          >
            {buttonText}
          </button>
        </form>

        {jobId && (
          <div className="mt-6 bg-zinc-900 border border-zinc-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">Job ID:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-sm">{jobId}</span>
                <CopyButton textToCopy={jobId} />
              </div>
            </div>
            <Link
              href={`/ingestion/jobs/${jobId}`}
              className="mt-4 inline-block px-4 py-2 bg-[#9aff8d] hover:bg-[#9aff8d]/80 text-[#232323] rounded-md transition-colors font-medium text-sm"
            >
              Ver estado del job
            </Link>
          </div>
        )}
      </SectionCard>

      {/* B. Jobs recientes */}
      <SectionCard
        title="Jobs recientes"
        description="Últimas cargas procesadas en el sistema"
      >
        {/* Barra de acciones */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <button
            onClick={handleRefreshMarts}
            disabled={refreshingMarts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg text-xs font-medium transition-colors border border-zinc-700"
          >
            <svg className={`w-3.5 h-3.5 ${refreshingMarts ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshingMarts ? 'Refrescando…' : 'Refrescar Vistas'}
          </button>
          <button
            onClick={() => fetchRecentJobs()}
            disabled={loadingJobs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg text-xs font-medium transition-colors border border-zinc-700"
          >
            <svg className={`w-3.5 h-3.5 ${loadingJobs ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Recargar Jobs
          </button>
        </div>
        {loadingJobs ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#9aff8d] mb-2"></div>
            <p className="text-zinc-400 text-sm">Cargando jobs...</p>
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-400">No hay jobs recientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Job ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Inicio</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {recentJobs.map((job) => {
                  const currentStatus = job.status?.toLowerCase() || '';
                  const isActive = ['running', 'processing', 'pending', 'uploading', 'updating'].includes(currentStatus);
                  const canForceComplete = isActive;
                  const canVerifyState = currentStatus === 'updating';

                  return (
                    <tr key={job.job_id} className="hover:bg-zinc-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                        {job.job_id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/ingestion/jobs/${job.job_id}`}
                            className="inline-block px-3 py-1.5 bg-[#9aff8d] hover:bg-[#9aff8d]/80 text-[#232323] rounded-md transition-colors text-sm font-medium"
                          >
                            Ver detalle
                          </Link>
                          {canForceComplete && (
                            <button
                              onClick={() => handleForceComplete(job.job_id)}
                              disabled={forcingComplete === job.job_id}
                              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-md transition-colors text-xs font-medium"
                              title="Marcar como completado manualmente"
                            >
                              {forcingComplete === job.job_id ? '…' : 'Forzar cierre'}
                            </button>
                          )}
                          {canVerifyState && (
                            <button
                              onClick={() => fetchRecentJobs()}
                              disabled={loadingJobs}
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-md transition-colors text-xs font-medium"
                              title="Job en Updating por más de 15s — consultar estado en DB"
                            >
                              Verificar Estado
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* C. Acceso directo a resolver mapeo */}
      <SectionCard
        title="Resolver mapeo"
        description="Jobs que requieren mapeo de columnas"
      >
        {loadingJobs ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#9aff8d] mb-2"></div>
            <p className="text-zinc-400 text-sm">Cargando...</p>
          </div>
        ) : (
          (() => {
            const awaitingMapping = recentJobs.filter(j => j.status?.toLowerCase() === 'awaiting_mapping');
            if (awaitingMapping.length === 0) {
              return (
                <div className="text-center py-8">
                  <p className="text-zinc-400">No hay jobs esperando mapeo</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {awaitingMapping.map((job) => (
                  <div key={job.job_id} className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Job ID: <span className="font-mono text-sm">{job.job_id.substring(0, 8)}...</span></p>
                      <p className="text-zinc-400 text-sm">Requiere mapeo de columnas</p>
                    </div>
                    <Link
                      href={`/ingestion/mapping/${job.job_id}`}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-md transition-colors font-medium text-sm"
                    >
                      Configurar Mapeo Requerido
                    </Link>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </SectionCard>
    </div>
  );
}
