import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Llega desde el correo de confirmación de Supabase (con ?code= o con ?token_hash=&type=).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const dest = url.clone();
  dest.search = '';
  if (url.searchParams.get('error')) {
    dest.pathname = '/login';
    dest.searchParams.set('error', 'El enlace ya se usó o venció. Si ya confirmaste, entra con tu correo y contraseña.');
    return NextResponse.redirect(dest);
  }
  const supabase = await createClient();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as 'signup' | 'email' | 'recovery' | null;
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  if (ok) {
    dest.pathname = '/';
    return NextResponse.redirect(dest);
  }
  // El correo ya quedó confirmado en Supabase; solo falta iniciar sesión en este navegador.
  dest.pathname = '/login';
  dest.searchParams.set('ok', 'Correo confirmado. Entra con tu correo y contraseña.');
  return NextResponse.redirect(dest);
}
