import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

/**
 * GET /api/auth/profile
 * Obtiene el perfil del usuario autenticado desde la tabla profiles
 * Retorna: user_id, company_id, email (si está disponible)
 * 
 * Estrategia de búsqueda:
 * 1. Para wallet: busca en auth.users por user_metadata.wallet_address o wallet
 * 2. Para email: busca en auth.users por email
 * 3. Luego busca el perfil en la tabla profiles usando el user_id encontrado
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener información de autenticación desde cookies
    const authCookie = request.cookies.get('trazzos_auth');
    const walletCookie = request.cookies.get('trazzos_wallet');
    const userCookie = request.cookies.get('trazzos_user');
    const authMethodCookie = request.cookies.get('trazzos_auth_method');

    // Verificar autenticación
    if (!authCookie || authCookie.value !== 'ok') {
      return createErrorResponse('No autenticado', 401);
    }

    if (!walletCookie?.value && !userCookie?.value) {
      return createErrorResponse('No se encontró información de usuario', 401);
    }

    const authMethod = authMethodCookie?.value || (walletCookie?.value ? 'wallet' : 'email');
    const identifier = walletCookie?.value || userCookie?.value;

    if (!identifier) {
      return createErrorResponse('Identificador de usuario no encontrado', 401);
    }

    let user_id: string | null = null;
    let email: string | null = null;

    // Estrategia 1: Buscar en auth.users (si está disponible)
    try {
      const { data: authUsers, error: authError } = await supabaseServer.auth.admin.listUsers();
      
      if (!authError && authUsers?.users) {
        let foundUser = null;
        
        if (authMethod === 'wallet') {
          // Buscar por wallet address en metadata
          foundUser = authUsers.users.find((u: any) => {
            const walletMeta = u.user_metadata?.wallet_address || u.user_metadata?.wallet;
            return walletMeta?.toLowerCase() === identifier.toLowerCase();
          });
        } else {
          // Buscar por email
          foundUser = authUsers.users.find((u: any) => 
            u.email?.toLowerCase() === identifier.toLowerCase()
          );
        }
        
        if (foundUser) {
          user_id = foundUser.id;
          email = foundUser.email || null;
        }
      }
    } catch (authError) {
      // Si falla auth.admin, continuamos con otras estrategias
      console.debug('Could not fetch from auth.users, trying alternative methods:', authError);
    }

    // Estrategia 2: Si no encontramos en auth.users, intentar buscar directamente en profiles
    // Esto asume que el identifier podría ser el user_id directamente o que hay otra forma de mapeo
    if (!user_id) {
      // Intentar buscar en profiles si el identifier es un UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(identifier)) {
        const { data: profile, error: profileError } = await supabaseServer
          .from('profiles')
          .select('user_id, company_id')
          .eq('user_id', identifier)
          .maybeSingle();

        if (!profileError && profile) {
          user_id = profile.user_id;
        }
      }
    }

    // Si aún no tenemos user_id, retornar error
    if (!user_id) {
      return createErrorResponse(
        'Usuario no encontrado en el sistema. Asegúrate de que el usuario tenga un perfil creado en la tabla profiles.',
        404
      );
    }

    // Obtener el perfil completo desde la tabla profiles
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('user_id, company_id, role, status')
      .eq('user_id', user_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return createErrorResponse('Error al obtener el perfil del usuario', 500);
    }

    if (!profile) {
      return createErrorResponse('Perfil no encontrado en la tabla profiles', 404);
    }

    // Si no tenemos email de auth.users, usar el identifier si es email
    if (!email && authMethod !== 'wallet' && identifier.includes('@')) {
      email = identifier;
    }

    return createSuccessResponse({
      user_id: profile.user_id,
      company_id: profile.company_id,
      email: email,
      role: profile.role,
      status: profile.status,
    });
  } catch (error) {
    console.error('Error in GET /api/auth/profile:', error);
    return createErrorResponse('Error interno del servidor', 500);
  }
}

