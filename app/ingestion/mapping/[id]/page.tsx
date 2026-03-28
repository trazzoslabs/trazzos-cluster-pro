'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

function normalizeMappingRouteId(raw: string | string[] | undefined): string | undefined {
  if (raw == null) return undefined;
  const s = Array.isArray(raw) ? raw[0] : raw;
  const t = typeof s === 'string' ? s.trim() : '';
  return t.length > 0 ? t : undefined;
}

/**
 * Página de resolución: /ingestion/mapping/[id]
 * n8n (V2-03) puede enlazar con job_id, upload_id o mapping_profile_id.
 * GET /api/data/ingestion-jobs?id=… resuelve en ingestion_jobs y aquí redirigimos a /ingestion/jobs/[job_id].
 */
export default function IngestionMappingPage() {
  const params = useParams();
  const router = useRouter();
  const id = useMemo(() => normalizeMappingRouteId(params?.id as string | string[] | undefined), [params?.id]);
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'not-found'>('loading');

  useEffect(() => {
    if (!id) {
      setStatus('not-found');
      return;
    }

    let cancelled = false;
    const ac = new AbortController();

    const resolveAndRedirect = async () => {
      const url = `/api/data/ingestion-jobs?id=${encodeURIComponent(id)}`;
      try {
        const res = await fetch(url, { signal: ac.signal, cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) {
          setStatus('not-found');
          return;
        }
        const json = await res.json().catch(() => null);
        const job = json?.data;
        const jobId =
          job && typeof job === 'object' && typeof (job as { job_id?: unknown }).job_id === 'string'
            ? (job as { job_id: string }).job_id.trim()
            : '';
        if (!jobId) {
          setStatus('not-found');
          return;
        }
        if (cancelled) return;
        setStatus('redirecting');
        router.replace(`/ingestion/jobs/${encodeURIComponent(jobId)}`);
      } catch (e) {
        if (ac.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
        if (!cancelled) setStatus('not-found');
      }
    };

    resolveAndRedirect();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [id, router]);

  if (!id) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-zinc-300">
        <p className="text-lg">ID no proporcionado.</p>
        <Link href="/ingestion" className="mt-4 text-[#9aff8d] hover:underline">
          Volver a Cargas de Datos
        </Link>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-zinc-300">
        <p className="text-lg">No se encontró el job para este ID.</p>
        <Link href="/ingestion" className="mt-4 text-[#9aff8d] hover:underline">
          Volver a Cargas de Datos
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-zinc-300">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#9aff8d] border-t-transparent rounded-full animate-spin" />
        <p>{status === 'loading' ? 'Cargando datos del job...' : 'Redirigiendo al mapeo…'}</p>
      </div>
    </div>
  );
}
