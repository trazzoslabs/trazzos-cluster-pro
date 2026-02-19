import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'ethers';

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

    // Crear respuesta con cookies httpOnly
    const response = NextResponse.json(
      { 
        ok: true, 
        address: recoveredAddress,
        message: 'Autenticación exitosa' 
      },
      { status: 200 }
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

    return response;
  } catch (error) {
    console.error('Error en verify-signature:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}



