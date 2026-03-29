'use client';

import { useEffect, useState } from 'react';
import { AUTH_BYPASS_USER_ID } from '@/lib/authBypass';

/**
 * Solo visible con usuario bypass: limpia sessionStorage y recarga (vuelve estado demo a “sin cargar”).
 */
export default function DemoResetButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/profile');
        if (!res.ok || cancelled) return;
        const j = await res.json();
        const uid = j?.data?.user_id;
        if (typeof uid === 'string' && uid.trim() === AUTH_BYPASS_USER_ID) {
          setShow(true);
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => {
        try {
          sessionStorage.clear();
        } catch {
          /* noop */
        }
        window.location.href = '/';
      }}
      className="fixed bottom-4 left-4 z-[90] rounded-md border border-zinc-600/80 bg-zinc-900/90 px-3 py-1.5 text-xs font-medium text-zinc-300 shadow-lg backdrop-blur-sm hover:border-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
    >
      Reiniciar Demo
    </button>
  );
}
