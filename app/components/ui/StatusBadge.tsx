interface StatusBadgeProps {
  status: string | null;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-700 text-zinc-300 border border-zinc-600">
        N/A
      </span>
    );
  }

  const statusLower = status.toLowerCase();

  // Completed states
  if (statusLower === 'completed' || statusLower === 'approved' || statusLower === 'created' || statusLower === 'submitted') {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-green-900/30 text-green-400 border border-green-800">
        {status}
      </span>
    );
  }

  // Error states
  if (statusLower === 'error' || statusLower === 'failed' || statusLower === 'rejected' || statusLower === 'cancelled') {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-red-900/30 text-red-400 border border-red-800">
        {status}
      </span>
    );
  }

  // Pending/processing states
  if (statusLower === 'pending' || statusLower === 'draft' || statusLower === 'awaiting_mapping' || statusLower === 'analyzed') {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-900/30 text-yellow-400 border border-yellow-800">
        {status}
      </span>
    );
  }

  // Default
  return (
    <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-700 text-zinc-300 border border-zinc-600">
      {status}
    </span>
  );
}




