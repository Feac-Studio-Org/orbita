import { createClient as createSupabase } from '@supabase/supabase-js';
import { iceServers } from '@/lib/ice';

/** Servidores de conexión para las llamadas de la app (celular y computador). Requiere la sesión del usuario. */
export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Falta la sesión.' }, { status: 401 });
  const supabase = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return Response.json({ error: 'Sesión no válida.' }, { status: 401 });
  return Response.json({ iceServers: await iceServers() }, { headers: { 'Cache-Control': 'no-store' } });
}
