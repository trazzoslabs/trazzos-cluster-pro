'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Página de mapeo: /ingestion/mapping/[id]
 * n8n construye el enlace como app_url + '/mapping/' + uuid → /ingestion/mapping/UUID
 * [id] puede ser job_id o upload_id. Redirige a /ingestion/jobs/[job_id] donde está el panel de mapeo.
 */
export default function IngestionMappingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'not-found'>('loading');

  useEffect(() => {
    if (!id) {
      setStatus('not-found');
      return;
    }

    let cancelled = false;

    const resolveAndRedirect = async () => {
      try {
        const res = await fetch('/api/data/ingestion-jobs');
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const jobs = Array.isArray(json?.data) ? json.data : [];
        const byUpload = jobs.find((j: { upload_id?: string | null }) => j.upload_id === id);
        const jobId = byUpload ? byUpload.job_id : id;
        if (cancelled) return;
        setStatus('redirecting');
        router.replace(`/ingestion/jobs/${jobId}`);
      } catch {
        if (!cancelled) {
          setStatus('redirecting');
          router.replace(`/ingestion/jobs/${id}`);
        }
      }
    };

    resolveAndRedirect();
    return () => { cancelled = true; };
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
        <p className="text-lg">No se encontró el mapeo.</p>
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
        <p>Redirigiendo al mapeo…</p>
      </div>
    </div>
  );
}
