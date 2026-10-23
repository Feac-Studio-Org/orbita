import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Conectar una IA' };

type Q = { client_id?: string; redirect_uri?: string; response_type?: string; code_challenge?: string; code_challenge_method?: string; state?: string; scope?: string; resource?: string };

function back(redirectUri: string, params: Record<string, string | undefined>) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

async function decide(form: FormData) {
  'use server';
  const q = Object.fromEntries(form.entries()) as Record<string, string>;
  const supabase = await createClient();
  const { data: client } = await supabase.rpc('oauth_client_info', { p_client_id: q.client_id });
  const c = (client as { redirect_uris: string[] }[] | null)?.[0];
  if (!c || !c.redirect_uris.includes(q.redirect_uri)) redirect('/asistente?error=' + encodeURIComponent('La IA no se registró bien. Intenta conectarla de nuevo.'));
  if (q.decision !== 'permitir') redirect(back(q.redirect_uri, { error: 'access_denied', state: q.state }));
  const { data: code, error } = await supabase.rpc('oauth_create_code', { p_client_id: q.client_id, p_redirect_uri: q.redirect_uri, p_code_challenge: q.code_challenge });
  if (error) redirect(back(q.redirect_uri, { error: 'invalid_request', error_description: error.message, state: q.state }));
  redirect(back(q.redirect_uri, { code: String(code), state: q.state }));
}

export default async function Authorize({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=' + encodeURIComponent('/oauth/autorizar?' + new URLSearchParams(q as Record<string, string>).toString()));
  const { data: client } = await supabase.rpc('oauth_client_info', { p_client_id: q.client_id ?? '' });
  const c = (client as { client_name: string; redirect_uris: string[] }[] | null)?.[0];
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', auth.user.id).single();

  const problem = !c ? 'Esta IA no está registrada. Vuelve a agregar el conector desde tu IA.'
    : !q.redirect_uri || !c.redirect_uris.includes(q.redirect_uri) ? 'La dirección de regreso no coincide con la registrada.'
    : q.response_type !== 'code' ? 'Tipo de respuesta no soportado.'
    : !q.code_challenge || (q.code_challenge_method && q.code_challenge_method !== 'S256') ? 'Falta la protección PKCE (S256).' : '';

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand" style={{ padding: 0 }}><img src="/logo.png" alt="" style={{ width: 40, height: 40 }} /><b style={{ fontSize: 22 }}>Órbita</b></div>
        {problem ? (
          <><h1>No se puede <span className="serif violet">conectar</span></h1><p className="err">{problem}</p></>
        ) : (
          <>
            <div>
              <div className="label">Conectar una IA</div>
              <h1 style={{ marginTop: 8 }}><span className="serif violet">{c!.client_name}</span> quiere entrar a tu Órbita</h1>
              <p className="muted" style={{ marginTop: 10 }}>Como {profile?.full_name || auth.user.email}. Podrá:</p>
            </div>
            <ul className="panel" style={{ listStyle: 'none', gap: 10, fontSize: 14 }}>
              <li>Ver tus espacios, proyectos, tareas y horario.</li>
              <li>Registrar avances, comentar y crear tareas, si lo permites en Asistente.</li>
              <li>Anotar gastos, solo si activas ese permiso.</li>
              <li className="muted">Nunca borra nada. Puedes desconectarla cuando quieras en Órbita → Asistente.</li>
            </ul>
            <form action={decide} className="inline">
              {Object.entries(q).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
              <button className="pill solid" name="decision" value="permitir" type="submit"><span className="pill__dot" />Permitir</button>
              <button className="pill" name="decision" value="cancelar" type="submit">Cancelar</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
