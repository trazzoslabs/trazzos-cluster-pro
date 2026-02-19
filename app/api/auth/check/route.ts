import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authCookie = request.cookies.get('trazzos_auth');
  const walletCookie = request.cookies.get('trazzos_wallet');
  const userCookie = request.cookies.get('trazzos_user');
  const authMethodCookie = request.cookies.get('trazzos_auth_method');

  // Autenticado si tiene cookie de auth y (wallet o user)
  const authenticated = authCookie?.value === 'ok' && (!!walletCookie?.value || !!userCookie?.value);

  // Determine auth method: prefer cookie, fallback to inference
  let authMethod: 'wallet' | 'google' | 'email' | null = null;
  if (authMethodCookie?.value) {
    authMethod = authMethodCookie.value as 'wallet' | 'google' | 'email';
  } else if (walletCookie?.value) {
    authMethod = 'wallet';
  } else if (userCookie?.value) {
    // If user cookie exists and contains @, it's likely email, otherwise assume google
    authMethod = userCookie.value.includes('@') ? 'email' : 'google';
  }

  return NextResponse.json({
    authenticated,
    wallet: walletCookie?.value || null,
    user: userCookie?.value || null,
    authMethod,
  });
}



