'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AUTH_BYPASS_USER_ID } from '@/lib/authBypass';
import PageTitle from '../../../components/ui/PageTitle';
import IngestionMappingWorkflow, {
  type IngestionJobMappingSnapshot,
} from '../../components/IngestionMappingWorkflow';

/** Demo Cartagena: sin consulta a Supabase; columnas típicas Reficar. */
const CARTAGENA_DEMO_SNAPSHOT: IngestionJobMappingSnapshot = {
  job_id: AUTH_BYPASS_USER_ID,
  upload_id: AUTH_BYPASS_USER_ID,
  mapping_profile_id: null,
  status: 'ready',
  dataset_type: 'needs',
  file_name: 'ingesta_cluster_cartagena.xlsx',
  source_columns: ['material', 'cantidad', 'fecha', 'planta'],
};

function normalizeMappingRouteId(raw: string | string[] | undefined): string | undefined {
  if (raw == null) return undefined;
  const s = Array.isArray(raw) ? raw[0] : raw;
  let t = typeof s === 'string' ? s.trim() : '';
  if (!t) return undefined;
  try {
    t = decodeURIComponent(t);
  } catch {
    /* noop */
  }
  t = t.trim();
  return t.length > 0 ? t : undefined;
}

function extractJobIdFromResponse(json: unknown): string {
  const payload = json as { data?: unknown } | null;
  const job = payload?.data;
  if (!job || typeof job !== 'object' || job === null) return '';
  const id = (job as { job_id?: unknown }).job_id;
  return typeof id === 'string' ? id.trim() : '';
}

const FETCH_TIMEOUT_MS = 14_000;
const RETRY_DELAYS_MS = [0, 800, 2200];
const OVERALL_DEADLINE_MS = 42_000;

function fetchWithTimeout(
  url: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetch(url, { signal, cache: 'no-store' })
      .then((res) => {
        clearTimeout(to);
        resolve(res);
      })
      .catch((e) => {
        clearTimeout(to);
        reject(e);
      });
  });
}

/**
 * Enlace /ingestion/mapping/[id] (V2-03): resuelve id → job_id y muestra el mismo flujo de mapeo que /ingestion/jobs/[job_id].
 */
export default function IngestionMappingPage() {
  const params = useParams();
  const id = useMemo(() => normalizeMappingRouteId(params?.id as string | string[] | undefined), [params?.id]);
  const [phase, setPhase] = useState<'resolving' | 'ready' | 'not-found'>('resolving');
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setPhase('not-found');
      return;
    }

    if (id === AUTH_BYPASS_USER_ID) {
      setResolvedJobId(id);
      setPhase('ready');
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    const deadlineTimer = window.setTimeout(() => {
      if (!cancelled) setPhase('not-found');
    }, OVERALL_DEADLINE_MS);

    const run = async () => {
      const url = `/api/data/ingestion-jobs?id=${encodeURIComponent(id)}`;
      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
        if (cancelled) return;
        if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        if (cancelled) return;
        try {
          const res = await fetchWithTimeout(url, ac.signal, FETCH_TIMEOUT_MS);
          if (cancelled) return;
          if (res.ok) {
            const json = await res.json().catch(() => null);
            const jobId = extractJobIdFromResponse(json);
            if (jobId) {
              if (!cancelled) {
                setResolvedJobId(jobId);
                setPhase('ready');
              }
              return;
            }
          }
        } catch {
          /* siguiente intento */
        }
      }
      if (!cancelled) setPhase('not-found');
    };

    run();
    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(deadlineTimer);
    };
  }, [id]);

  const backButton = (
    <Link
      href="/ingestion"
      className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#9aff8d] px-6 py-3 text-base font-semibold text-[#232323] transition-colors hover:bg-[#9aff8d]/90"
    >
      Volver a Ingesta
    </Link>
  );

  if (!id) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-6 text-center text-zinc-300">
        <p className="text-lg font-medium text-white">ID no válido o no proporcionado.</p>
        {backButton}
      </div>
    );
  }

  if (phase === 'not-found') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-6 text-center text-zinc-300">
        <p className="text-lg font-medium text-white">No encontramos un job para este ID</p>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          Usa el enlace del correo o vuelve a la lista de cargas.
        </p>
        {backButton}
      </div>
    );
  }

  if (phase === 'resolving' || !resolvedJobId) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-6 text-zinc-300">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#9aff8d] border-t-transparent" />
        <p className="mt-3 text-sm">Resolviendo enlace de mapeo…</p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle title="Mapeo de columnas" subtitle={`Job ${resolvedJobId}`} />
        <Link
          href="/ingestion/jobs"
          className="self-start rounded-md bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 sm:self-auto"
        >
          ← Volver a Jobs
        </Link>
      </div>
      <IngestionMappingWorkflow
        jobId={resolvedJobId}
        initialJob={resolvedJobId === AUTH_BYPASS_USER_ID ? CARTAGENA_DEMO_SNAPSHOT : undefined}
        showBackToJobsLink={false}
      />
    </div>
  );
}
