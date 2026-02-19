'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageTitle from './components/ui/PageTitle';
import SectionCard from './components/ui/SectionCard';
import StatusBadge from './components/ui/StatusBadge';
import CopyButton from './components/ui/CopyButton';

interface IngestionJob {
  job_id: string;
  status: string | null;
}

interface AuditEvent {
  event_id: string;
  correlation_id: string | null;
  event_type: string | null;
  summary: string | null;
  created_at: string | null;
}

export default function Home() {
  // Estado General - Cargas de Datos
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [awaitingMappingJobs, setAwaitingMappingJobs] = useState<number>(0);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Estado General - Oportunidades Conjuntas
  const [totalSynergies, setTotalSynergies] = useState<number>(0);
  const [loadingSynergies, setLoadingSynergies] = useState(true);

  // Estado General - Gestión de Decisiones
  const [activeRfps, setActiveRfps] = useState<number>(0);
  const [purchaseOrders, setPurchaseOrders] = useState<number>(0);
  const [loadingDecisions, setLoadingDecisions] = useState(true);

  // Actividad Reciente
  const [recentActivity, setRecentActivity] = useState<AuditEvent[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    // Fetch Cargas de Datos
    try {
      const jobsRes = await fetch('/api/data/ingestion-jobs');
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        const jobs = jobsData.data || [];
        setTotalJobs(jobs.length);
        setAwaitingMappingJobs(jobs.filter((j: IngestionJob) => 
          j.status?.toLowerCase() === 'awaiting_mapping'
        ).length);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoadingJobs(false);
    }

    // Fetch Oportunidades Conjuntas
    try {
      const synergiesRes = await fetch('/api/data/synergies');
      if (synergiesRes.ok) {
        const synergiesData = await synergiesRes.json();
        setTotalSynergies((synergiesData.data || []).length);
      }
    } catch (err) {
      console.error('Error fetching synergies:', err);
    } finally {
      setLoadingSynergies(false);
    }

    // Fetch Gestión de Decisiones
    try {
      const [rfpsRes, posRes] = await Promise.all([
        fetch('/api/data/rfps'),
        fetch('/api/data/purchase-orders')
      ]);

      if (rfpsRes.ok) {
        const rfpsData = await rfpsRes.json();
        const rfps = rfpsData.data || [];
        setActiveRfps(rfps.filter((r: any) => 
          r.status && ['active', 'open', 'evaluation', 'pending', 'published'].includes(r.status.toLowerCase())
        ).length);
      }

      if (posRes.ok) {
        const posData = await posRes.json();
        setPurchaseOrders((posData.data || []).length);
      }
    } catch (err) {
      console.error('Error fetching decisions data:', err);
    } finally {
      setLoadingDecisions(false);
    }

    // Fetch Actividad Reciente
    try {
      const activityRes = await fetch('/api/data/audit-events?limit=10');
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setRecentActivity((activityData.data || []).slice(0, 10));
      }
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  return (
    <div>
      {/* Hero Institucional */}
      <div className="text-center mb-12 py-8">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 leading-tight">
          Cluster Pro
        </h1>
        <p className="text-xl text-zinc-300 mb-2">
          Plataforma digital para la coordinación estratégica del Cluster Industrial Cartagena.
        </p>
        <p className="text-sm text-zinc-500">
          Cluster activo: <span className="text-[#9aff8d]">Cluster Industrial Cartagena prototipo v2</span>.
        </p>
      </div>

      {/* Estado General */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-white mb-6">Estado General</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cargas de Datos */}
          <SectionCard 
            title="Cargas de Datos"
            description="Gestión de archivos y procesamiento de datos"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Total de jobs:</span>
                {loadingJobs ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#9aff8d]"></div>
                ) : (
                  <span className="text-2xl font-bold text-white">{totalJobs}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Esperando mapeo:</span>
                {loadingJobs ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#9aff8d]"></div>
                ) : (
                  <span className="text-xl font-semibold text-yellow-400">{awaitingMappingJobs}</span>
                )}
              </div>
              <Link
                href="/ingestion"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#9aff8d] hover:bg-[#9aff8d]/80 text-[#232323] rounded-md transition-colors font-medium text-sm"
              >
                Ir a Cargas de Datos
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </SectionCard>

          {/* Oportunidades Conjuntas */}
          <SectionCard 
            title="Oportunidades Conjuntas"
            description="Sinergias identificadas para compras compartidas"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Total de sinergias:</span>
                {loadingSynergies ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#9aff8d]"></div>
                ) : (
                  <span className="text-2xl font-bold text-[#9aff8d]">{totalSynergies}</span>
                )}
              </div>
              <Link
                href="/synergies"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#9aff8d] hover:bg-[#9aff8d]/80 text-[#232323] rounded-md transition-colors font-medium text-sm"
              >
                Ver oportunidades
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </SectionCard>

          {/* Gestión de Decisiones */}
          <SectionCard 
            title="Gestión de Decisiones"
            description="RFPs activos y órdenes de compra generadas"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">RFPs activos:</span>
                {loadingDecisions ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#9aff8d]"></div>
                ) : (
                  <span className="text-2xl font-bold text-white">{activeRfps}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Órdenes de compra:</span>
                {loadingDecisions ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#9aff8d]"></div>
                ) : (
                  <span className="text-xl font-semibold text-green-400">{purchaseOrders}</span>
                )}
              </div>
              <Link
                href="/workbench"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#9aff8d] hover:bg-[#9aff8d]/80 text-[#232323] rounded-md transition-colors font-medium text-sm"
              >
                Ir a Gestión de Decisiones
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Actividad Reciente */}
      <SectionCard 
        title="Actividad Reciente"
        description="Últimos eventos del sistema"
      >
        {loadingActivity ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#9aff8d] mb-2"></div>
            <p className="text-zinc-400 text-sm">Cargando actividad...</p>
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-400">No hay actividad reciente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Hora</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Tipo de evento</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Resumen</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Correlation ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {recentActivity.map((event) => (
                  <tr key={event.event_id} className="hover:bg-zinc-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(event.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {event.event_type || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {event.summary || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                      {event.correlation_id ? (
                        <div className="flex items-center gap-2">
                          <span>{event.correlation_id.substring(0, 8)}...</span>
                          <CopyButton textToCopy={event.correlation_id} />
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
      </SectionCard>
    </div>
  );
}
