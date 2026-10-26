/** Servidores para conectar llamadas. STUN público siempre; TURN de Cloudflare si están sus variables (redes difíciles). */
export async function iceServers(): Promise<RTCIceServer[]> {
  const base: RTCIceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  const id = process.env.CLOUDFLARE_TURN_KEY_ID, token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!id || !token) return base;
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl: 86400 }), cache: 'no-store',
    });
    if (!r.ok) return base;
    const j = (await r.json()) as { iceServers: RTCIceServer | RTCIceServer[] };
    return [...base, ...(Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers])];
  } catch {
    return base;
  }
}
