/**
 * Cliente Supabase del navegador + sesión fija de pruebas cuando el bypass está activo
 * (no llama a Supabase Auth: evita 500 en Auth).
 */
import type { AuthError, Session, User } from '@supabase/supabase-js';
import {
  AUTH_BYPASS_USER_EMAIL,
  AUTH_BYPASS_USER_ID,
  isHardcodedIdentityBypass,
} from './authBypass';
import { isSupabaseClientConfigured, supabaseClient } from './supabaseClient';

export { isSupabaseClientConfigured, supabaseClient };

export const supabase = supabaseClient;

/** Sesión mínima fija (pruebas). */
const FIXED_ACCESS_TOKEN = 'fake-token';

function buildFixedUser(): User {
  const now = new Date().toISOString();
  return {
    id: AUTH_BYPASS_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: AUTH_BYPASS_USER_EMAIL,
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: {},
    user_metadata: { full_name: 'Admin Reficar' },
    identities: [],
    created_at: now,
    updated_at: now,
    factors: [],
  } as User;
}

function buildFixedSession(): Session {
  const user = buildFixedUser();
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: FIXED_ACCESS_TOKEN,
    refresh_token: '',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: now + 60 * 60 * 24 * 365,
    token_type: 'bearer',
    user,
  } as Session;
}

/**
 * Con identidad hardcodeada activa: **no llama** a Supabase Auth; devuelve siempre el usuario fijo.
 * Sin bypass: `supabase.auth.getUser()` real.
 */
export async function getAuthUserWithBypass(): Promise<{
  data: { user: User | null };
  error: AuthError | null;
}> {
  if (isHardcodedIdentityBypass()) {
    return { data: { user: buildFixedUser() }, error: null };
  }
  try {
    return await supabaseClient.auth.getUser();
  } catch {
    return { data: { user: null }, error: null };
  }
}

/**
 * Con identidad hardcodeada: sesión sintética (`fake-token` + usuario fijo). Sin `getSession()` remoto.
 */
export async function getAuthSessionWithBypass(): Promise<{
  data: { session: Session | null };
  error: AuthError | null;
}> {
  if (isHardcodedIdentityBypass()) {
    return { data: { session: buildFixedSession() }, error: null };
  }
  try {
    return await supabaseClient.auth.getSession();
  } catch {
    return { data: { session: null }, error: null };
  }
}
