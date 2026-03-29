/**
 * Cliente Supabase con service_role para rutas/middleware donde hace falta
 * evitar RLS sin fallar el arranque si faltan variables.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createServiceRoleClientOrNull(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
