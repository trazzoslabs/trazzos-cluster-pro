interface StatusBadgeProps {
  status: string | null;
}

const GREEN   = new Set(['completed', 'approved', 'created', 'submitted', 'success', 'done', 'finished', 'stored']);
const BLUE    = new Set(['detected', 'identified', 'matched', 'active']);
const PULSING = new Set(['running', 'processing', 'uploading', 'in_progress']);
const AMBER   = new Set(['pending', 'draft', 'awaiting_mapping', 'analyzed', 'queued', 'rfp', 'review', 'open']);
const RED     = new Set(['error', 'failed', 'rejected', 'cancelled']);

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-700 text-zinc-300">
        N/A
      </span>
    );
  }

  const s = status.toLowerCase();

  if (GREEN.has(s)) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-400 border border-green-700/50">
        {status}
      </span>
    );
  }

  if (PULSING.has(s)) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-900/40 text-blue-400 border border-blue-700/50 animate-pulse">
        {status}
      </span>
    );
  }

  if (BLUE.has(s)) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-900/40 text-blue-400 border border-blue-700/50">
        {status}
      </span>
    );
  }

  if (AMBER.has(s)) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-900/40 text-yellow-400 border border-yellow-700/50">
        {status}
      </span>
    );
  }

  if (RED.has(s)) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/40 text-red-400 border border-red-700/50">
        {status}
      </span>
    );
  }

  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-700 text-zinc-300">
      {status}
    </span>
  );
}






