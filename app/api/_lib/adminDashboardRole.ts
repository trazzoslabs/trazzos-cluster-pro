/**
 * Roles que pueden acceder a `/admin`. Debe coincidir con `public.profiles.role`.
 * Módulo sin dependencias de Supabase (seguro para Edge Middleware).
 */
export function isAdminDashboardRole(role: string | null | undefined): boolean {
  const r = (role || '').trim().toLowerCase();
  return r === 'admin' || r === 'cluster_admin' || r === 'super_admin';
}
