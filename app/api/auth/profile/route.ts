import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';
import { resolveAuthenticatedProfile } from '../../_lib/resolveAuthenticatedProfile';

/**
 * GET /api/auth/profile
 * Obtiene el perfil del usuario autenticado desde la tabla profiles
 * Retorna: user_id, company_id, email (si está disponible)
 *
 * Estrategia de búsqueda (en resolveAuthenticatedProfile):
 * 1. Para wallet: busca en auth.users por user_metadata.wallet_address o wallet
 * 2. Para email: busca en auth.users por email
 * 3. Luego busca el perfil en la tabla profiles usando el user_id encontrado
 */
export async function GET(request: NextRequest) {
  try {
    const result = await resolveAuthenticatedProfile(request);
    if (!result.ok) {
      return createErrorResponse(result.message, result.status);
    }

    return createSuccessResponse({
      user_id: result.profile.user_id,
      company_id: result.profile.company_id,
      email: result.email,
      role: result.profile.role,
      status: result.profile.status,
    });
  } catch (error) {
    console.error('Error in GET /api/auth/profile:', error);
    return createErrorResponse('Error interno del servidor', 500);
  }
}
