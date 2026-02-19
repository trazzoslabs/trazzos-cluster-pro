import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authCookie = request.cookies.get('trazzos_auth');

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login', '/acceso', '/api/auth'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // Rutas de Next.js que siempre deben ser accesibles
  const isNextPath = pathname.startsWith('/_next') || 
                     pathname.startsWith('/api/_next') ||
                     pathname.startsWith('/favicon.ico');

  // Si es una ruta pública o de Next.js, permitir acceso
  if (isPublicPath || isNextPath) {
    return NextResponse.next();
  }

  // Si no está autenticado, redirigir a /login preservando ?next=
  if (!authCookie || authCookie.value !== 'ok') {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = '/login';
    
    // Preservar la ruta original en el query param ?next=
    if (pathname !== '/') {
      nextUrl.searchParams.set('next', pathname);
    }
    
    return NextResponse.redirect(nextUrl);
  }

  // Usuario autenticado, permitir acceso
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};



