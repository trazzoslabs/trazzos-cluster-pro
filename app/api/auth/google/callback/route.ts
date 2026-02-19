import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Si hay error de Google
  if (error) {
    const errorUrl = new URL('/acceso', request.nextUrl.origin);
    errorUrl.searchParams.set('error', 'google_auth_cancelled');
    return NextResponse.redirect(errorUrl.toString());
  }

  // Si no hay código, error
  if (!code) {
    const errorUrl = new URL('/acceso', request.nextUrl.origin);
    errorUrl.searchParams.set('error', 'google_auth_failed');
    return NextResponse.redirect(errorUrl.toString());
  }

  // Recuperar el parámetro 'next' del state
  let next = '/';
  if (state) {
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      next = decodedState.next || '/';
    } catch (e) {
      // Si no se puede decodificar, usar default
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    // Modo demo: autenticación simple sin verificar con Google
    // En producción, esto debería intercambiar el código por un token
    const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
    
    // Establecer cookies de autenticación (modo demo)
    response.cookies.set('trazzos_auth', 'ok', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    response.cookies.set('trazzos_user', 'demo-google-user', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });
    
    response.cookies.set('trazzos_auth_method', 'google', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    return response;
  }

  try {
    // Intercambiar código por token de acceso
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Error al intercambiar código por token');
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    // Obtener información del usuario
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Error al obtener información del usuario');
    }

    const userInfo = await userResponse.json();

    // Crear respuesta con redirección
    const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));

    // Establecer cookies httpOnly
    response.cookies.set('trazzos_auth', 'ok', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    response.cookies.set('trazzos_user', userInfo.email || userInfo.id || 'google-user', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });
    
    response.cookies.set('trazzos_auth_method', 'google', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error en Google OAuth callback:', error);
    const errorUrl = new URL('/acceso', request.nextUrl.origin);
    errorUrl.searchParams.set('error', 'google_auth_failed');
    return NextResponse.redirect(errorUrl.toString());
  }
}

