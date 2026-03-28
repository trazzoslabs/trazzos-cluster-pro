import { NextResponse } from 'next/server';
import { supabaseServer } from './supabaseServer';

/**
 * Tabla pública de perfiles (PK `user_id`). No confundir con `auth.users` (Supabase Auth).
 */
export type PublicProfileSnapshot = {
  user_id: string;
  company_id: string | null;
  role: string | null;
  status: string | null;
};

const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: PROFILE_COOKIE_MAX_AGE,
  path: '/',
};

export async function fetchPublicProfileByUserId(
  userId: string,
): Promise<PublicProfileSnapshot | null> {
  const trimmed = userId?.trim();
  if (!trimmed) return null;

  const { data, error } = await supabaseServer
    .from('profiles')
    .select('user_id, company_id, role, status')
    .eq('user_id', trimmed)
    .maybeSingle();

  if (error) {
    console.error('[publicProfiles] Error leyendo profiles por user_id:', error.message);
    return null;
  }

  return data as PublicProfileSnapshot | null;
}

/** Resuelve `auth.users.id` por email (admin API; puede paginar en cuentas muy grandes). */
export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  try {
    const { data, error } = await supabaseServer.auth.admin.listUsers();
    if (error || !data?.users?.length) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === e);
    return found?.id ?? null;
  } catch {
    return null;
  }
}

/** Resuelve `auth.users.id` por wallet en user_metadata. */
export async function findAuthUserIdByWallet(wallet: string): Promise<string | null> {
  const w = wallet?.trim().toLowerCase();
  if (!w) return null;
  try {
    const { data, error } = await supabaseServer.auth.admin.listUsers();
    if (error || !data?.users?.length) return null;
    const found = data.users.find((u) => {
      const meta = u.user_metadata?.wallet_address || u.user_metadata?.wallet;
      return typeof meta === 'string' && meta.toLowerCase() === w;
    });
    return found?.id ?? null;
  } catch {
    return null;
  }
}

export function attachProfileSnapshotCookies(
  res: NextResponse,
  profile: PublicProfileSnapshot | null,
): void {
  res.cookies.set('trazzos_profile_role', profile?.role ?? '', cookieBase);
  res.cookies.set('trazzos_profile_company_id', profile?.company_id ?? '', cookieBase);
  res.cookies.set('trazzos_profile_status', profile?.status ?? '', cookieBase);
}

export function clearProfileSnapshotCookies(res: NextResponse): void {
  for (const name of [
    'trazzos_profile_role',
    'trazzos_profile_company_id',
    'trazzos_profile_status',
    'trazzos_user_id',
  ]) {
    res.cookies.delete(name);
  }
}
