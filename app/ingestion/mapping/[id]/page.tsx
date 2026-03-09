'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Página de mapeo: /ingestion/mapping/[id]
 * n8n construye el enlace como app_url + '/mapping/' + uuid → /ingestion/mapping/UUID
 * [id] puede ser job_id, upload_id o mapping_profile_id. La API busca en ingestion_jobs en este orden:
 * 1) job_id = id, 2) upload_id = id, 3) mapping_profile_id = id.
 * Si encuentra el job, redirige a /ingestion/jobs/[job_id]. Así se evita "Job no encontrado"
 * cuando n8n envía el ID del perfil de mapeo en lugar del ID del trabajo.
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
        const res = await fetch(`/api/data/ingestion-jobs?id=${encodeURIComponent(id)}`);
        if (cancelled) return;
        if (!res.ok) {
          setStatus('not-found');
          return;
        }
        const json = await res.json();
        const job = json?.data;
        if (!job?.job_id) {
          setStatus('not-found');
          return;
        }
        if (cancelled) return;
        setStatus('redirecting');
        router.replace(`/ingestion/jobs/${job.job_id}`);
      } catch {
        if (!cancelled) setStatus('not-found');
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
