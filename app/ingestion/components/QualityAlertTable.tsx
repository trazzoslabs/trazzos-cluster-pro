import StatusBadge from '../../components/ui/StatusBadge';

export interface QualityIssueRow {
  issue_id: string;
  row_number: number | null;
  severity: string | null;
  issue_code: string | null;
}

interface QualityAlertTableProps {
  rows: QualityIssueRow[];
  loading: boolean;
  error: string | null;
}

function cell(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/**
 * Hallazgos de data_quality_issues (V2-04): fila, severidad con StatusBadge, código (ej. INVALID_DATA_FORMAT).
 */
export default function QualityAlertTable({ rows, loading, error }: QualityAlertTableProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#9aff8d] mb-2" />
        <p className="text-secondary text-sm">Cargando alertas de calidad...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-secondary text-sm">
        No hay filas en data_quality_issues para este job.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-zinc-900">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Fila</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Severidad</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Código</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-700">
          {rows.map((row) => (
            <tr key={row.issue_id} className="hover:bg-zinc-700/50 transition-colors">
              <td className="px-4 py-3 text-sm text-zinc-200 font-mono tabular-nums">
                {cell(row.row_number)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.severity} />
              </td>
              <td className="px-4 py-3 text-sm text-zinc-200 font-mono tracking-tight">
                {cell(row.issue_code)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
