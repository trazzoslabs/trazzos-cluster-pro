import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { ok: true, message: 'Sesión cerrada' },
    { status: 200 }
  );

  // Eliminar todas las cookies de autenticación
    response.cookies.delete('trazzos_auth');
    response.cookies.delete('trazzos_wallet');
    response.cookies.delete('trazzos_user');
    response.cookies.delete('trazzos_auth_method');

  return response;
}

