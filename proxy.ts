import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/auth', '/api/mcp', '/api/google/callback', '/descargas', '/descargar', '/.well-known', '/api/oauth', '/api/ice', '/bienvenida'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  // La app de computador abre directo en el inicio de sesión: nada de presentación ni de "descarga la app".
  const desktop = /OrbitaDesktop/.test(request.headers.get('user-agent') ?? '');
  if (desktop && (path.startsWith('/bienvenida') || path.startsWith('/descargar'))) {
    const url = request.nextUrl.clone();
    url.pathname = data.user ? '/' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (!data.user && path === '/') {
    const url = request.nextUrl.clone();
    if (desktop) { url.pathname = '/login'; return NextResponse.redirect(url); }
    url.pathname = '/bienvenida';
    return NextResponse.rewrite(url);
  }
  if (!data.user && !PUBLIC.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (path !== '/') url.searchParams.set('next', path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.png|apple-icon.png|logo.png|icon-192.png|icon-512.png|manifest.webmanifest).*)'],
};
