import type { NextRequest } from 'next/server';
import { CORS, anonRpc, json } from '@/lib/oauth';

export async function POST(request: NextRequest) {
  const type = request.headers.get('content-type') ?? '';
  const p: Record<string, string> = type.includes('application/json')
    ? await request.json().catch(() => ({}))
    : Object.fromEntries(new URLSearchParams(await request.text()));
  if (p.grant_type !== 'authorization_code') return json({ error: 'unsupported_grant_type' }, 400);
  try {
    const token = await anonRpc('oauth_exchange_code', { p_client_id: p.client_id ?? '', p_code: p.code ?? '', p_redirect_uri: p.redirect_uri ?? '', p_code_verifier: p.code_verifier ?? '' });
    return json({ access_token: token, token_type: 'Bearer', scope: 'orbita' });
  } catch {
    return json({ error: 'invalid_grant', error_description: 'El código no es válido, venció o ya se usó.' }, 400);
  }
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
