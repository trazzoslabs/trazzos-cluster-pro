import { NextRequest, NextResponse } from 'next/server';
import {
  attachProfileSnapshotCookies,
  fetchPublicProfileByUserIdWithResult,
  findAuthUserIdByEmail,
  type PublicProfileSnapshot,
} from '../../_lib/publicProfiles';

/**
 * POST /api/auth/set-session
 * Establece cookies de sesión tras login Supabase y sincroniza snapshot desde `public.profiles` (PK user_id).
 * Las lecturas a `public.profiles` usan SUPABASE_SERVICE_ROLE_KEY (no la sesión anónima del cliente).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, user_id } = body as { email?: string; user_id?: string };

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email es requerido' }, { status: 400 });
    }

    let resolvedUserId =
      typeof user_id === 'string' && user_id.trim() ? user_id.trim() : null;
    if (!resolvedUserId) {
      resolvedUserId = await findAuthUserIdByEmail(email);
    }

    let profile: PublicProfileSnapshot | null = null;

    if (resolvedUserId) {
      const profileResult = await fetchPublicProfileByUserIdWithResult(resolvedUserId);
      if (!profileResult.ok) {
        return NextResponse.json(
          {
            error: profileResult.userMessage,
            code: profileResult.code ?? null,
            details: profileResult.rawMessage,
          },
          { status: 503 },
        );
      }
      profile = profileResult.profile;
    }

    const response = NextResponse.json(
      {
        ok: true,
        message: 'Sesión establecida correctamente',
        user_id: resolvedUserId,
        company_id: profile?.company_id ?? null,
        role: profile?.role ?? null,
        status: profile?.status ?? null,
      },
      { status: 200 },
    );

    response.cookies.set('trazzos_auth', 'ok', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    response.cookies.set('trazzos_user', email.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // Legible en el cliente (p. ej. ingestion) como respaldo si getUser() aún no expone email
    response.cookies.set('trazzos_user_email', email.trim(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    response.cookies.set('trazzos_auth_method', 'email', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    if (resolvedUserId) {
      response.cookies.set('trazzos_user_id', resolvedUserId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    attachProfileSnapshotCookies(response, profile);

    return response;
  } catch (error) {
    console.error('Error en set-session:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
