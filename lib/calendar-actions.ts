'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from './supabase/server';
import { accessToken, createWeeklyEvent, deleteEvent, googleConfigured, revoke } from './google';
import { addDays, isoWeekday, todayISO } from './format';

async function googleToken() {
  const { supabase } = await requireUser();
  if (!googleConfigured()) return null;
  const { data } = await supabase.rpc('google_refresh_token');
  return data ? accessToken(String(data)) : null;
}

export async function disconnectGoogle() {
  const { supabase } = await requireUser();
  const { data } = await supabase.rpc('google_refresh_token');
  if (data) await revoke(String(data));
  await supabase.rpc('google_disconnect');
  revalidatePath('/calendario');
  redirect('/calendario?ok=' + encodeURIComponent('Google Calendar desconectado.'));
}

export async function addBlockWithGoogle(f: FormData) {
  const { supabase } = await requireUser();
  const g = (k: string) => String(f.get(k) ?? '').trim();
  const days = f.getAll('weekdays').map(Number).filter(Boolean).sort();
  if (!days.length) redirect('/calendario?error=' + encodeURIComponent('Elige al menos un día.'));
  if (g('end_time') <= g('start_time')) redirect('/calendario?error=' + encodeURIComponent('La hora final debe ser después de la inicial.'));
  let gcalId: string | null = null;
  if (f.get('google') === 'on') {
    const token = await googleToken();
    if (token) {
      // Primera fecha desde hoy que cae en uno de los días elegidos.
      let first = todayISO();
      for (let n = 0; n < 7 && !days.includes(isoWeekday(first)); n++) first = addDays(first, 1);
      gcalId = await createWeeklyEvent(token, { title: g('title'), weekdays: days, start: g('start_time'), end: g('end_time'), firstDate: first, until: g('ends_on') || null });
    }
  }
  const { error } = await supabase.from('schedule_blocks').insert({
    space_id: g('space'), title: g('title'), kind: g('kind') || 'study', tag: g('tag'), weekdays: days,
    start_time: g('start_time'), end_time: g('end_time'), ends_on: g('ends_on') || null, gcal_event_id: gcalId,
  });
  if (error) redirect('/calendario?error=' + encodeURIComponent('No se pudo agregar: ' + error.message));
  revalidatePath('/calendario');
  redirect('/calendario?ok=' + encodeURIComponent(gcalId ? 'Bloque agregado también en Google Calendar.' : 'Bloque agregado.'));
}

export async function removeBlock(f: FormData) {
  const { supabase } = await requireUser();
  const id = String(f.get('id'));
  const { data: b } = await supabase.from('schedule_blocks').select('gcal_event_id').eq('id', id).single();
  if (b?.gcal_event_id && f.get('google') === 'on') {
    const token = await googleToken();
    if (token) await deleteEvent(token, b.gcal_event_id);
  }
  await supabase.from('schedule_blocks').delete().eq('id', id);
  revalidatePath('/calendario');
  redirect('/calendario?ok=' + encodeURIComponent('Bloque quitado.'));
}
