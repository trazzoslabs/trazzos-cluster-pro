'use client';

interface BrandLogoProps {
  className?: string;
}

export default function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-white font-bold text-base tracking-tight">
        TRAZZOS LABS
      </span>
      <span className="text-[#9aff8d] font-bold text-base tracking-tight">
        CLUSTER PRO
      </span>
    </div>
  );
}

