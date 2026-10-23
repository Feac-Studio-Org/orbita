import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode } from '@/lib/google';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const back = url.clone();
  back.search = '';
  back.pathname = '/calendario';
  const fail = (msg: string) => {
    back.searchParams.set('error', msg);
    const r = NextResponse.redirect(back);
    r.cookies.delete({ name: 'g_state', path: '/api/google' });
    return r;
  };
  if (url.searchParams.get('error')) return fail('No se conectó Google Calendar: cancelaste el permiso.');
  const state = url.searchParams.get('state');
  if (!state || state !== request.cookies.get('g_state')?.value) return fail('La conexión venció. Intenta de nuevo.');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL('/login', request.url));
  try {
    const t = await exchangeCode(url.searchParams.get('code') ?? '', `${url.origin}/api/google/callback`);
    if (!t.refresh_token) return fail('Google no entregó acceso permanente. Quita Órbita en myaccount.google.com/permissions e intenta de nuevo.');
    const { error } = await supabase.rpc('google_save_connection', { p_email: t.email, p_refresh_token: t.refresh_token, p_scope: t.scope });
    if (error) return fail('No se pudo guardar la conexión: ' + error.message);
  } catch (e) {
    return fail((e as Error).message);
  }
  back.searchParams.set('ok', 'Google Calendar conectado.');
  const r = NextResponse.redirect(back);
  r.cookies.delete({ name: 'g_state', path: '/api/google' });
  return r;
}
