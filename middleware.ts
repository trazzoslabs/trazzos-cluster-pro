import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAdminDashboardRole } from '@/app/api/_lib/adminDashboardRole';
import { AUTH_BYPASS_USER_ID, isHardcodedIdentityBypass } from '@/lib/authBypass';
import { createServiceRoleClientOrNull } from '@/lib/supabaseServiceClient';

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

  const authCookie = request.cookies.get('trazzos_auth');
  const walletCookie = request.cookies.get('trazzos_wallet');
  const userCookie = request.cookies.get('trazzos_user');
  const legacyCookieAuthed =
    authCookie?.value === 'ok' && (!!walletCookie?.value || !!userCookie?.value);

  let supabaseUser: { id: string } | null = null;

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

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        supabaseUser = user;
      }
    } catch {
      /* Auth caído (p. ej. 500): continuar con cookies / bypass */
    }
  }

  const bypassAuth = isHardcodedIdentityBypass();
  const bypassEmergencyUserId =
    request.cookies.get('trazzos_user_id')?.value === AUTH_BYPASS_USER_ID;
  const isAuthed =
    Boolean(supabaseUser) || legacyCookieAuthed || bypassAuth || bypassEmergencyUserId;

  if (!isAuthed) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = '/login';
    if (pathname !== '/') {
      nextUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(nextUrl);
  }

  const isAdminPath = pathname.startsWith('/admin');
  if (isAdminPath) {
    let role: string | null = null;

    if ((bypassAuth && !supabaseUser) || bypassEmergencyUserId) {
      role = 'cluster_admin';
    } else if (supabaseUser) {
      const svc = createServiceRoleClientOrNull();
      if (svc) {
        const { data: row } = await svc
          .schema('public')
          .from('profiles')
          .select('role')
          .eq('user_id', supabaseUser.id)
          .maybeSingle();
        role = row?.role ?? null;
      }
    }

    if (!role) {
      role = request.cookies.get('trazzos_profile_role')?.value ?? null;
    }

    if (!isAdminDashboardRole(role)) {
      const denied = request.nextUrl.clone();
      denied.pathname = '/';
      denied.searchParams.set('error', 'admin_only');
      return NextResponse.redirect(denied);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
