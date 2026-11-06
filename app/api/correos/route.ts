import { enviarEvento, verificar } from '@/lib/correos';

export const runtime = 'nodejs';

/** Neon avisa aquí (send.otp y send.magic_link) y deja de enviar sus correos. */
export async function POST(request: Request) {
  const cuerpo = await request.text();
  let valido = false;
  try {
    valido = await verificar(cuerpo, request.headers);
  } catch {
    valido = false;
  }
  if (!valido) return new Response('firma inválida', { status: 401 });
  const evento = JSON.parse(cuerpo);
  if (evento.event_type !== 'send.otp' && evento.event_type !== 'send.magic_link') return new Response('ignorado');
  try {
    await enviarEvento(evento);
    return new Response('ok');
  } catch (e) {
    console.error('correos:', (e as Error).message);
    return new Response('error', { status: 502 }); // Neon reintenta
  }
}
