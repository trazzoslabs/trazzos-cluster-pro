'use client';

interface CopyButtonProps {
  textToCopy: string;
  label?: string;
  className?: string;
}

export default function CopyButton({ textToCopy, label = 'Copiar', className = '' }: CopyButtonProps) {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      className={`text-[#9aff8d] hover:text-[#9aff8d]/80 text-xs px-2 py-1 border border-[#9aff8d]/50 rounded hover:bg-[#9aff8d]/10 transition-colors ${className}`}
    >
      {label}
    </button>
  );
}






