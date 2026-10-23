
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';
export const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function authUrl(redirectUri: string, state: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  });
  return `${AUTH}?${q}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const r = await fetch(TOKEN, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!r.ok) throw new Error('Google rechazó el código: ' + (await r.text()).slice(0, 200));
  const t = (await r.json()) as { access_token: string; refresh_token?: string; id_token?: string; scope: string };
  let email = '';
  if (t.id_token) {
    try { email = JSON.parse(Buffer.from(t.id_token.split('.')[1], 'base64url').toString()).email ?? ''; } catch {}
  }
  return { ...t, email };
}

export async function accessToken(refreshToken: string) {
  const r = await fetch(TOKEN, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: 'refresh_token' }),
    cache: 'no-store',
  });
  if (!r.ok) return null;
  return ((await r.json()) as { access_token: string }).access_token;
}

export type GEvent = { id: string; summary?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; htmlLink?: string; recurringEventId?: string };

export async function listEvents(token: string, timeMin: string, timeMax: string): Promise<GEvent[]> {
  const q = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: 'America/Bogota' });
  const r = await fetch(`${API}/calendars/primary/events?${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!r.ok) return [];
  return ((await r.json()) as { items?: GEvent[] }).items ?? [];
}

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/** Crea un evento semanal que se repite en los días del bloque. Devuelve el id del evento. */
export async function createWeeklyEvent(token: string, b: { title: string; weekdays: number[]; start: string; end: string; firstDate: string; until?: string | null }) {
  const rule = `RRULE:FREQ=WEEKLY;BYDAY=${b.weekdays.map((d) => BYDAY[d - 1]).join(',')}${b.until ? ';UNTIL=' + b.until.replace(/-/g, '') + 'T235959Z' : ''}`;
  const r = await fetch(`${API}/calendars/primary/events`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: b.title,
      start: { dateTime: `${b.firstDate}T${b.start}:00`, timeZone: 'America/Bogota' },
      end: { dateTime: `${b.firstDate}T${b.end}:00`, timeZone: 'America/Bogota' },
      recurrence: [rule],
    }),
  });
  if (!r.ok) return null;
  return ((await r.json()) as { id: string }).id;
}

export async function deleteEvent(token: string, id: string) {
  await fetch(`${API}/calendars/primary/events/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
}

export async function revoke(token: string) {
  await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(token), { method: 'POST' }).catch(() => {});
}
