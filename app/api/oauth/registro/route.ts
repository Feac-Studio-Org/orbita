import type { NextRequest } from 'next/server';
import { CORS, anonRpc, json } from '@/lib/oauth';

// Registro dinámico de clientes (RFC 7591): Claude, ChatGPT y otros se registran solos.
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const uris: string[] = Array.isArray(b.redirect_uris) ? b.redirect_uris.map(String) : [];
  try {
    const clientId = await anonRpc('oauth_register_client', { p_name: String(b.client_name ?? 'IA'), p_redirect_uris: uris });
    return json({
      client_id: clientId, client_name: b.client_name ?? 'IA', redirect_uris: uris, client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: 'none', grant_types: ['authorization_code'], response_types: ['code'], scope: 'orbita',
    }, 201);
  } catch (e) {
    return json({ error: 'invalid_redirect_uri', error_description: (e as Error).message }, 400);
  }
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
