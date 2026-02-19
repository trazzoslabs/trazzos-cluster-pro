import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const next = searchParams.get('next') || '/';

  // Obtener credenciales de Google OAuth desde variables de entorno
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/google/callback`;
  
  if (!clientId) {
    // Modo demo: redirigir directamente al callback sin pasar por Google OAuth
    // Esto permite probar el sistema sin configurar Google OAuth
    const callbackUrl = new URL('/api/auth/google/callback', request.nextUrl.origin);
    callbackUrl.searchParams.set('code', 'demo-code');
    if (next) {
      callbackUrl.searchParams.set('state', Buffer.from(JSON.stringify({ next })).toString('base64'));
    }
    return NextResponse.redirect(callbackUrl.toString());
  }

  // Construir URL de autorización de Google
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('access_type', 'online');
  authUrl.searchParams.set('prompt', 'select_account');
  // Guardar el parámetro 'next' en el state para recuperarlo después
  authUrl.searchParams.set('state', Buffer.from(JSON.stringify({ next })).toString('base64'));

  return NextResponse.redirect(authUrl.toString());
}

