/**
 * Canal BroadcastChannel compartido entre pestañas del mismo origen.
 * Solo puede publicarse desde código que ejecuta en el navegador (no desde Route Handlers de Next).
 */

export const TRAZZOS_MARTS_CHANNEL = 'trazzos_marts';

export const MARTS_REFRESH_COMPLETED = 'marts_refresh_completed' as const;

export type MartsRefreshCompletedMessage =
  | typeof MARTS_REFRESH_COMPLETED
  | {
      type: typeof MARTS_REFRESH_COMPLETED;
      ts?: number;
      counts?: unknown;
      source?: string;
      job_id?: string;
    };

export function isMartsRefreshCompletedPayload(data: unknown): boolean {
  if (data === MARTS_REFRESH_COMPLETED) return true;
  if (data && typeof data === 'object' && data !== null) {
    return (data as { type?: string }).type === MARTS_REFRESH_COMPLETED;
  }
  return false;
}

/** Publicar en pestañas del mismo origen (p. ej. tras POST /api/workflows/refresh-marts en el cliente). */
export function publishMartsRefreshCompleted(counts?: unknown, extra?: { job_id?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const bc = new BroadcastChannel(TRAZZOS_MARTS_CHANNEL);
    const payload: MartsRefreshCompletedMessage = {
      type: MARTS_REFRESH_COMPLETED,
      ts: Date.now(),
      ...(counts !== undefined ? { counts } : {}),
      ...(extra?.job_id ? { job_id: extra.job_id } : {}),
    };
    bc.postMessage(payload);
    bc.close();
  } catch {
    /* BroadcastChannel no disponible */
  }
}
