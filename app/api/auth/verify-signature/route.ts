import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'ethers';
import {
  attachProfileSnapshotCookies,
  fetchPublicProfileByUserId,
  findAuthUserIdByWallet,
} from '../../_lib/publicProfiles';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, signature, address } = body;

    if (!message || !signature || !address) {
      return NextResponse.json(
        { error: 'message, signature y address son requeridos' },
        { status: 400 }
      );
    }

    // Verificar la firma
    let recoveredAddress: string;
    try {
      recoveredAddress = verifyMessage(message, signature);
    } catch (err) {
      return NextResponse.json(
        { error: 'Firma inválida' },
        { status: 400 }
      );
    }

    // Verificar que la dirección recuperada coincida con la proporcionada (case-insensitive)
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json(
        { error: 'La dirección de la billetera no coincide con la firma' },
        { status: 400 }
      );
    }

    const authUserId = await findAuthUserIdByWallet(recoveredAddress);
    const profile = authUserId ? await fetchPublicProfileByUserId(authUserId) : null;

    const response = NextResponse.json(
      {
        ok: true,
        address: recoveredAddress,
        message: 'Autenticación exitosa',
        user_id: authUserId,
        company_id: profile?.company_id ?? null,
        role: profile?.role ?? null,
        status: profile?.status ?? null,
      },
      { status: 200 },
    );

    // Setear cookies httpOnly
    response.cookies.set('trazzos_auth', 'ok', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    response.cookies.set('trazzos_wallet', recoveredAddress, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });
    
    response.cookies.set('trazzos_auth_method', 'wallet', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    if (authUserId) {
      response.cookies.set('trazzos_user_id', authUserId, {
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
    console.error('Error en verify-signature:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}



