import Link from 'next/link';

interface HeaderProps {
  backUrl?: string;
  backLabel?: string;
}

export default function Header({ backUrl, backLabel }: HeaderProps) {
  return (
    <header className="bg-header-textured border-b border-zinc-800/50 relative z-50">
      <div className="container mx-auto px-4 py-6 max-w-6xl relative z-10">
        <div className="flex items-center justify-end">
          {backUrl && backLabel && (
            <Link
              href={backUrl}
              className="text-green-400 hover:text-green-300 transition-colors text-sm font-medium relative z-10"
            >
              ← {backLabel}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

