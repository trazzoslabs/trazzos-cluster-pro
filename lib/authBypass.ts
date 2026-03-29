/**
 * Bypass de emergencia cuando Supabase Auth falla (p. ej. error 500).
 * - NEXT_PUBLIC_HARDCODED_IDENTITY_BYPASS=true → identidad fija + sin login (producción de prueba).
 * - NEXT_PUBLIC_BYPASS_AUTH=true o NODE_ENV=development → mismo comportamiento ampliado.
 */

export const AUTH_BYPASS_USER_ID = '22222222-2222-2222-2222-222222222222';
export const AUTH_BYPASS_USER_EMAIL = 'admin@reficar.com';
export const AUTH_BYPASS_COMPANY_ID = 'aaaa1111-1111-4111-a111-111111111111';

export function isAuthBypassEnabled(): boolean {
  if (typeof process === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') return true;
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

/** Identidad hardcodeada + middleware sin login (incluye flag explícito para prod). */
export function isHardcodedIdentityBypass(): boolean {
  if (typeof process === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_HARDCODED_IDENTITY_BYPASS === 'true') return true;
  return isAuthBypassEnabled();
}

export function getAuthBypassProfileRow(): {
  user_id: string;
  company_id: string;
  role: string;
  status: string;
} {
  return {
    user_id: AUTH_BYPASS_USER_ID,
    company_id: AUTH_BYPASS_COMPANY_ID,
    role: 'cluster_admin',
    status: 'active',
  };
}
