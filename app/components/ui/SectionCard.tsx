interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export default function SectionCard({ title, description, children, className = '' }: SectionCardProps) {
  return (
    <div className={`card mb-6 ${className}`}>
      <h2 className="mb-2">{title}</h2>
      {description && (
        <p className="text-zinc-400 text-sm mb-4">{description}</p>
      )}
      {children}
    </div>
  );
}

