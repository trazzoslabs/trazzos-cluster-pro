'use client';

import { useEffect, useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import SectionCard from '../components/ui/SectionCard';
import CopyButton from '../components/ui/CopyButton';

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

export default function AuditPage() {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'correlation' | 'entity'>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  useEffect(() => {
    fetchAuditEvents();
  }, [filter, filterValue]);

  const fetchAuditEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/data/audit-events';
      const params = new URLSearchParams();

      if (filter === 'correlation' && filterValue.trim()) {
        params.append('correlation_id', filterValue.trim());
      } else if (filter === 'entity' && filterValue.trim()) {
        params.append('entity_id', filterValue.trim());
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch audit events: ${response.statusText}`);
      }

      const result = await response.json();
      setAuditEvents(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit events');
      console.error('Error fetching audit events:', err);
    } finally {
      setLoading(false);
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
        second: '2-digit',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  const formatShortId = (id: string | null) => (id ? `${id.substring(0, 8)}...` : 'N/A');

  return (
    <div>
      <PageTitle 
        title="Trazabilidad"
        subtitle="Registro verificable de eventos y evidencia digital del sistema"
      />

      {/* Filters */}
      <SectionCard title="Filtros" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Correlation ID
            </label>
            <input
              type="text"
              value={filter === 'correlation' ? filterValue : ''}
              onChange={(e) => {
                setFilter('correlation');
                setFilterValue(e.target.value);
              }}
              placeholder="UUID"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Entity Type
            </label>
            <input
              type="text"
              value={filter === 'entity' ? filterValue : ''}
              onChange={(e) => {
                setFilter('entity');
                setFilterValue(e.target.value);
              }}
              placeholder="Tipo de entidad"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Entity ID
            </label>
            <input
              type="text"
              value={filter === 'entity' ? filterValue : ''}
              onChange={(e) => {
                setFilter('entity');
                setFilterValue(e.target.value);
              }}
              placeholder="UUID"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setFilter('all');
            setFilterValue('');
          }}
          className="mt-4 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors text-sm font-medium"
        >
          Limpiar filtros
        </button>
      </SectionCard>

      {/* Audit Events Table */}
      <SectionCard title="Eventos de Auditoría">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d] mb-4"></div>
            <p className="text-secondary">Cargando eventos de auditoría...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <p className="text-red-300">Error: {error}</p>
          </div>
        ) : auditEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondary">No hay eventos de auditoría disponibles</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Resumen</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Entidad</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Entity ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Correlation ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Hash SHA256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {auditEvents.map((event) => (
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
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {event.entity_type || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                      {formatShortId(event.entity_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                      {formatShortId(event.correlation_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                      {event.payload_hash_sha256 ? (
                        <div className="flex items-center gap-2">
                          <span>{formatShortId(event.payload_hash_sha256)}</span>
                          <CopyButton textToCopy={event.payload_hash_sha256} />
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
