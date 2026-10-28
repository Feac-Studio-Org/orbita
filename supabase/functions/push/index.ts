// Envía cada aviso de Órbita al celular (y al computador) por Firebase Cloud Messaging.
// La llama la base al crear una notificación. Si no hay credenciales de Firebase, no hace nada.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

const b64url = (data: ArrayBuffer | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cached: { token: string; exp: number } | null = null;

async function googleToken(sa: ServiceAccount) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  if (!r.ok) throw new Error('Google rechazó la cuenta de servicio: ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

function routeFor(link: Record<string, string>) {
  if (link?.issue) return `/t/${link.issue}`;
  if (link?.call) return `/llamada/${link.call}`;
  if (link?.channel) return `/canal/${link.channel}`;
  if (link?.path?.startsWith('/habitos/')) return `/h/${link.path.slice(9)}`;
  if (link?.path === '/calendario') return '/calendario';
  return '/notificaciones';
}

Deno.serve(async (req) => {
  try {
    const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!raw) return Response.json({ skipped: 'Firebase no está configurado' });
    const { id } = await req.json();
    if (typeof id !== 'string') return Response.json({ error: 'falta id' }, { status: 400 });
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    // Solo avisos recién creados y que no se hayan enviado: así nadie puede reenviar avisos viejos.
    const { data: n } = await db.from('notifications').select('id, user_id, kind, title, link, created_at, pushed_at').eq('id', id).maybeSingle();
    if (!n || n.pushed_at || Date.now() - new Date(n.created_at).getTime() > 5 * 60_000) return Response.json({ skipped: 'no aplica' });
    await db.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', id).is('pushed_at', null);

    const { data: pref } = await db.from('notification_prefs').select('push').eq('user_id', n.user_id).eq('kind', n.kind).maybeSingle();
    if (pref && pref.push === false) return Response.json({ skipped: 'la persona apagó este aviso en el celular' });
    const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', n.user_id);
    if (!tokens?.length) return Response.json({ skipped: 'sin dispositivos' });

    const sa = JSON.parse(raw) as ServiceAccount;
    const access = await googleToken(sa);
    const route = routeFor(n.link ?? {});
    let sent = 0;
    for (const { token } of tokens) {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: {
          token,
          notification: { title: 'Órbita', body: n.title },
          data: { route, id: n.id, kind: n.kind },
          android: { priority: 'HIGH', notification: { channel_id: 'avisos', color: '#9D4EDD' } },
          apns: { payload: { aps: { sound: 'default' } } },
        } }),
      });
      if (r.ok) { sent++; continue; }
      const body = await r.text();
      if (r.status === 404 || body.includes('UNREGISTERED') || body.includes('INVALID_ARGUMENT')) await db.from('push_tokens').delete().eq('token', token);
    }
    return Response.json({ sent });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
