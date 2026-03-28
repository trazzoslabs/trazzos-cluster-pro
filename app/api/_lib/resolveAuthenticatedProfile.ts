import { NextRequest } from 'next/server';
import { supabaseServer } from './supabaseServer';

export type AuthenticatedProfileRow = {
  user_id: string;
  company_id: string | null;
  role: string | null;
  status: string | null;
};

export type ResolveAuthenticatedProfileResult =
  | {
      ok: true;
      user_id: string;
      email: string | null;
      authMethod: string;
      identifier: string;
      profile: AuthenticatedProfileRow;
    }
  | { ok: false; status: number; message: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Misma lógica que GET /api/auth/profile: cookies Trazzos + auth.users + tabla profiles.
 * Sirve para BFFs que deben usar el email real del usuario (p. ej. V2-03 upload-confirm → n8n).
 */
export async function resolveAuthenticatedProfile(
  request: NextRequest,
): Promise<ResolveAuthenticatedProfileResult> {
  const authCookie = request.cookies.get('trazzos_auth');
  const walletCookie = request.cookies.get('trazzos_wallet');
  const userCookie = request.cookies.get('trazzos_user');
  const authMethodCookie = request.cookies.get('trazzos_auth_method');

  if (!authCookie || authCookie.value !== 'ok') {
    return { ok: false, status: 401, message: 'No autenticado' };
  }

  if (!walletCookie?.value && !userCookie?.value) {
    return { ok: false, status: 401, message: 'No se encontró información de usuario' };
  }

  const authMethod = authMethodCookie?.value || (walletCookie?.value ? 'wallet' : 'email');
  const identifier = walletCookie?.value || userCookie?.value || '';

  if (!identifier) {
    return { ok: false, status: 401, message: 'Identificador de usuario no encontrado' };
  }

  let user_id: string | null = null;
  let email: string | null = null;

  try {
    const { data: authUsers, error: authError } = await supabaseServer.auth.admin.listUsers();

    if (!authError && authUsers?.users) {
      let foundUser: (typeof authUsers.users)[0] | undefined;

      if (authMethod === 'wallet') {
        foundUser = authUsers.users.find((u) => {
          const walletMeta = u.user_metadata?.wallet_address || u.user_metadata?.wallet;
          return walletMeta?.toLowerCase() === identifier.toLowerCase();
        });
      } else {
        foundUser = authUsers.users.find(
          (u) => u.email?.toLowerCase() === identifier.toLowerCase(),
        );
      }

      if (foundUser) {
        user_id = foundUser.id;
        email = foundUser.email || null;
      }
    }
  } catch (authError) {
    console.debug('[resolveAuthenticatedProfile] listUsers no disponible:', authError);
  }

  if (!user_id) {
    if (UUID_REGEX.test(identifier)) {
      const { data: profileById, error: profileError } = await supabaseServer
        .from('profiles')
        .select('user_id, company_id')
        .eq('user_id', identifier)
        .maybeSingle();

      if (!profileError && profileById) {
        user_id = profileById.user_id;
      }
    }
  }

  if (!user_id) {
    return {
      ok: false,
      status: 404,
      message:
        'Usuario no encontrado en el sistema. Asegúrate de que el usuario tenga un perfil creado en la tabla profiles.',
    };
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from('profiles')
    .select('user_id, company_id, role, status')
    .eq('user_id', user_id)
    .maybeSingle();

  if (profileError) {
    console.error('[resolveAuthenticatedProfile] Error al leer profiles:', profileError);
    return { ok: false, status: 500, message: 'Error al obtener el perfil del usuario' };
  }

  if (!profile) {
    return { ok: false, status: 404, message: 'Perfil no encontrado en la tabla profiles' };
  }

  if (!email && authMethod !== 'wallet' && identifier.includes('@')) {
    email = identifier;
  }

  return {
    ok: true,
    user_id,
    email,
    authMethod,
    identifier,
    profile: profile as AuthenticatedProfileRow,
  };
}
