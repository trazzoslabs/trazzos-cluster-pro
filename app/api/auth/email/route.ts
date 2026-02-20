import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';

/**
 * POST /api/auth/email
 * DEPRECATED: Este endpoint ya no debe usarse para autenticación
 * La autenticación ahora se hace directamente con Supabase Auth en el cliente
 * Este endpoint se mantiene solo para compatibilidad, pero retorna error
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Este método de autenticación ya no está disponible. Por favor usa email y contraseña en la página de login.' 
    },
    { status: 400 }
  );
}

