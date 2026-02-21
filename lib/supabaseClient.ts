import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isMissing = !supabaseUrl || !supabaseAnonKey || supabaseAnonKey.includes('placeholder');

if (isMissing && typeof window !== 'undefined') {
  console.warn(
    '[supabaseClient] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no configuradas. ' +
    'Obtén la anon key desde Supabase Dashboard > Settings > API > anon public.'
  );
}

/**
 * Supabase client para uso en el cliente (browser).
 * Si las variables de entorno faltan, el cliente se crea igualmente
 * pero las llamadas fallarán de forma controlada.
 */
export const supabaseClient: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);

export const isSupabaseClientConfigured = !isMissing;



