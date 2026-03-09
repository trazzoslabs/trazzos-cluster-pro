import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/acceso', '/api/auth'];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  const isNextPath =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/_next') ||
    pathname.startsWith('/favicon.ico');

  if (isPublicPath || isNextPath) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  // Validación de sesión real con Supabase Auth (crítico para datos industriales)
  if (supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('placeholder')) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return response;
    }
  }

  // Fallback: cookie trazzos_auth (compatibilidad con flujos que aún no usan sesión Supabase)
  const authCookie = request.cookies.get('trazzos_auth');
  if (authCookie?.value === 'ok') {
    return response;
  }

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = '/login';
  if (pathname !== '/') {
    nextUrl.searchParams.set('next', pathname);
  }
  return NextResponse.redirect(nextUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
