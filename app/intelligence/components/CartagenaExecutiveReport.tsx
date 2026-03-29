'use client';

import { useEffect, useState } from 'react';
import { isDemoActive } from '@/lib/cartagenaDemoSynergies';

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

const PILLARS = [
  {
    title: 'Eficiencia Operativa',
    body:
      'Reducción del 18.2% en costos de mantenimiento y logística mediante activos compartidos.',
  },
  {
    title: 'Sostenibilidad',
    body:
      '4 sinergias enfocadas en economía circular y reducción de huella de carbono entre Reficar y Yara.',
  },
  {
    title: 'Resiliencia de Red',
    body: 'Fortalecimiento de la cadena de suministro local con 6 proyectos de compra conjunta.',
  },
] as const;

export default function CartagenaExecutiveReport() {
  const [live, setLive] = useState(() =>
    typeof window !== 'undefined' ? isDemoActive() : false,
  );

  useEffect(() => {
    const sync = () => setLive(isDemoActive());
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  return (
    <div
      className="rounded-xl border border-emerald-500/25 bg-zinc-900 shadow-[0_0_0_1px_rgba(16,185,129,0.06),0_24px_48px_-12px_rgba(0,0,0,0.45)]"
      role="region"
      aria-label="Informe ejecutivo demo Cartagena"
    >
      <div className="border-b border-emerald-500/20 bg-zinc-900/80 px-6 py-5 rounded-t-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <FileTextIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-500/90">
              Inteligencia de negocios
            </p>
            <h2 className="text-xl font-semibold text-zinc-100">Informe ejecutivo — Cluster Mamonal</h2>
            <p className="text-sm text-zinc-500">Cartagena · Confidencial · Uso interno</p>
          </div>
        </div>
      </div>

      <div className="space-y-8 px-6 py-8">
        {!live ? (
          <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 px-5 py-10 text-center">
            <p className="text-sm font-medium text-zinc-300 animate-pulse">Generando informe…</p>
            <p className="text-xs text-zinc-500 mt-3 max-w-md mx-auto leading-relaxed">
              Active la sesión de demostración desde el flujo de mapeo para ver el informe ejecutivo del cluster Mamonal.
            </p>
          </div>
        ) : (
          <>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500/90 mb-3">
                Resumen de impacto
              </h3>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/25 px-5 py-5">
                <p className="text-lg sm:text-xl text-zinc-100 leading-relaxed font-medium">
                  El ecosistema industrial de Cartagena (Mamonal) presenta un potencial de optimización de{' '}
                  <span className="text-emerald-400 font-semibold">$8.4M USD</span> mediante la activación de{' '}
                  <span className="text-emerald-400 font-semibold">12 sinergias estratégicas</span>.
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500/90 mb-4">
                Pilares de valor
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {PILLARS.map((p) => (
                  <article
                    key={p.title}
                    className="rounded-lg border border-emerald-500/20 bg-zinc-800/40 px-4 py-5 transition-colors hover:border-emerald-500/35"
                  >
                    <h4 className="text-sm font-semibold text-emerald-300/95 mb-2">{p.title}</h4>
                    <p className="text-sm text-zinc-400 leading-relaxed">{p.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500/90 mb-3">
                Conclusión sugerida
              </h3>
              <div className="rounded-lg border border-emerald-500/15 border-l-4 border-l-emerald-500 bg-zinc-800/30 px-5 py-4">
                <p className="text-sm sm:text-base text-zinc-200 leading-relaxed">
                  Se recomienda priorizar el proyecto de{' '}
                  <span className="font-semibold text-emerald-300">Mantenimiento Compartido de Turbinas</span> por su alto
                  ROI inmediato.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
