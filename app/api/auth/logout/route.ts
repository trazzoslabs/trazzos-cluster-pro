import { NextRequest, NextResponse } from 'next/server';
import { clearProfileSnapshotCookies } from '../../_lib/publicProfiles';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true, message: 'Sesión cerrada' }, { status: 200 });

  response.cookies.delete('trazzos_auth');
  response.cookies.delete('trazzos_wallet');
  response.cookies.delete('trazzos_user');
  response.cookies.delete('trazzos_auth_method');
  clearProfileSnapshotCookies(response);

  return response;
}

