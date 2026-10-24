import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { DRIVE_SCOPES, authUrl, googleConfigured } from '@/lib/google';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const drive = request.nextUrl.searchParams.get('servicio') === 'drive';
  const back = request.nextUrl.clone();
  back.search = '';
  back.pathname = drive ? '/ajustes/copia' : '/calendario';
  if (!googleConfigured()) {
    back.searchParams.set('error', 'Falta configurar la conexión con Google en el servidor (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).');
    return NextResponse.redirect(back);
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL('/login', request.url));
  const state = randomBytes(24).toString('hex');
  const res = NextResponse.redirect(authUrl(`${request.nextUrl.origin}/api/google/callback`, state, drive ? DRIVE_SCOPES : undefined));
  res.cookies.set('g_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/google' });
  res.cookies.set('g_back', drive ? 'drive' : 'calendario', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/google' });
  return res;
}
