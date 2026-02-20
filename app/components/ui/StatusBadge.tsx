interface StatusBadgeProps {
  status: string | null;
}

const GREEN = new Set(['completed', 'approved', 'created', 'submitted', 'success', 'done', 'finished', 'stored']);
const BLUE  = new Set(['running', 'processing', 'uploading', 'in_progress', 'active']);
const AMBER = new Set(['pending', 'draft', 'awaiting_mapping', 'analyzed', 'queued', 'rfp']);
const RED   = new Set(['error', 'failed', 'rejected', 'cancelled']);

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-700 text-zinc-300 border border-zinc-600">
        N/A
      </span>
    );
  }

  const s = status.toLowerCase();

  if (GREEN.has(s)) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-green-900/30 text-green-400 border border-green-800">
        {status}
      </span>
    );
  }

  if (BLUE.has(s)) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-800 animate-pulse">
        {status}
      </span>
    );
  }

  if (AMBER.has(s)) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-900/30 text-yellow-400 border border-yellow-800">
        {status}
      </span>
    );
  }

  if (RED.has(s)) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-red-900/30 text-red-400 border border-red-800">
        {status}
      </span>
    );
  }

  return (
    <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-700 text-zinc-300 border border-zinc-600">
      {status}
    </span>
  );
}





