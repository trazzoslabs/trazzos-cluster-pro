'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageTitle from '../../components/ui/PageTitle';
import SectionCard from '../../components/ui/SectionCard';
import StatusBadge from '../../components/ui/StatusBadge';

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
}

export default function IngestionJobsPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [correlationIdFilter, setCorrelationIdFilter] = useState<string>('');

  // Fetch jobs
  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/data/ingestion-jobs';
      const params = new URLSearchParams();

      if (correlationIdFilter.trim()) {
        params.append('correlation_id', correlationIdFilter.trim());
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      }

      const result = await response.json();
      let jobsData = result.data || [];

      // Filter by status on client side if needed
      if (statusFilter) {
        jobsData = jobsData.filter((job: IngestionJob) => 
          job.status?.toLowerCase() === statusFilter.toLowerCase()
        );
      }

      setJobs(jobsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [correlationIdFilter]); // Refetch when correlation_id filter changes

  // Filter by status on client side when status filter changes
  useEffect(() => {
    if (!loading) {
      fetchJobs();
    }
  }, [statusFilter]);

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
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  // Get unique statuses for filter
  const uniqueStatuses = Array.from(
    new Set(jobs.map(job => job.status).filter(Boolean))
  ).sort();

  return (
    <div>
      <PageTitle 
        title="Jobs de Ingesta"
        subtitle="Lista de cargas y estado del pipeline"
      />

      {/* Filters */}
      <SectionCard title="Filtros">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            >
              <option value="">Todos</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status!}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Correlation ID
            </label>
            <input
              type="text"
              value={correlationIdFilter}
              onChange={(e) => setCorrelationIdFilter(e.target.value)}
              placeholder="UUID"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            />
          </div>
        </div>
      </SectionCard>

      {/* Jobs Table */}
      <SectionCard title="Jobs de Ingesta">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d] mb-4"></div>
            <p className="text-secondary">Cargando jobs...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <p className="text-red-300">Error: {error}</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondary">
              {statusFilter || correlationIdFilter
                ? 'No hay jobs que coincidan con los filtros'
                : 'No hay jobs disponibles'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Job ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Correlation ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Filas</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Inicio</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Fin</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {jobs.map((job) => (
                  <tr key={job.job_id} className="hover:bg-zinc-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                      {job.job_id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                      {job.correlation_id ? job.correlation_id.substring(0, 8) + '...' : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {job.rows_total !== null ? (
                        <div className="flex flex-col">
                          <span>Total: {job.rows_total}</span>
                          <span className="text-green-400">OK: {job.rows_ok || 0}</span>
                          {job.rows_error !== null && job.rows_error > 0 && (
                            <span className="text-red-400">Error: {job.rows_error}</span>
                          )}
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(job.started_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(job.ended_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/ingestion/jobs/${job.job_id}`}
                        className="inline-block px-3 py-1.5 bg-[#9aff8d] hover:bg-[#9aff8d]/80 text-[#232323] rounded-md transition-colors text-sm font-medium"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

