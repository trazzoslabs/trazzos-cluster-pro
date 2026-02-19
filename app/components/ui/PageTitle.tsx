interface PageTitleProps {
  title: string;
  subtitle?: string;
}

export default function PageTitle({ title, subtitle }: PageTitleProps) {
  return (
    <div className="mb-10">
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">{title}</h1>
      {subtitle && (
        <p className="text-lg text-zinc-400 mt-2 leading-relaxed max-w-3xl">{subtitle}</p>
      )}
    </div>
  );
}

