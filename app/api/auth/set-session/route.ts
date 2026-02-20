import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/set-session
 * Establece las cookies de sesión después de autenticación exitosa con Supabase
 * Compatible con el middleware existente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, user_id } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      );
    }

    // Crear respuesta con cookies httpOnly
    const response = NextResponse.json(
      { 
        ok: true, 
        message: 'Sesión establecida correctamente' 
      },
      { status: 200 }
    );

    // Establecer cookies httpOnly para compatibilidad con middleware
    response.cookies.set('trazzos_auth', 'ok', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    response.cookies.set('trazzos_user', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });
    
    response.cookies.set('trazzos_auth_method', 'email', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    // Opcional: guardar user_id si está disponible
    if (user_id) {
      response.cookies.set('trazzos_user_id', user_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 días
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Error en set-session:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}


