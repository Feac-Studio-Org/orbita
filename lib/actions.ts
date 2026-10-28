'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from './supabase/server';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const opt = (f: FormData, k: string) => s(f, k) || null;
const back = (path: string, msg: string, kind: 'error' | 'ok' = 'error') => redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);

/* ---------- Tareas ---------- */
export async function createIssue(f: FormData) {
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from('projects').select('id').eq('key', s(f, 'project')).single();
  if (!p) back('/nuevo/tarea', 'Elige un proyecto.');
  const { data, error } = await supabase.from('issues').insert({
    project_id: p!.id, title: s(f, 'title'), description: s(f, 'description'), priority: s(f, 'priority') || 'medium',
    type: s(f, 'type') || 'task', due_date: opt(f, 'due_date'), epic_id: opt(f, 'epic_id'),
  }).select('key').single();
  if (error) back('/nuevo/tarea', 'No se pudo crear: ' + error.message);
  revalidatePath('/', 'layout');
  redirect(`/t/${data!.key}`);
}

/** Crear una tarea desde una columna del tablero, sin salir de él. */
export async function quickIssue(projectKey: string, title: string, status: string, epicId: string | null) {
  const { supabase } = await requireUser();
  const t = title.trim().slice(0, 300);
  if (!t) return { error: 'Escribe un título.' };
  if (!['todo', 'progress', 'review', 'done'].includes(status)) return { error: 'Estado no válido.' };
  const { data: p } = await supabase.from('projects').select('id').eq('key', projectKey).single();
  if (!p) return { error: 'Proyecto no encontrado.' };
  const { error } = await supabase.from('issues').insert({ project_id: p.id, title: t, status, epic_id: epicId });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function setIssueStatus(key: string, status: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('issues').update({ status }).eq('key', key);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateIssue(f: FormData) {
  const { supabase } = await requireUser();
  const key = s(f, 'key');
  const patch: Record<string, unknown> = {};
  for (const k of ['status', 'priority', 'type']) if (f.has(k)) patch[k] = s(f, k);
  if (f.has('title')) patch.title = s(f, 'title');
  if (f.has('description')) patch.description = s(f, 'description');
  if (f.has('due_date')) patch.due_date = opt(f, 'due_date');
  if (f.has('epic_id')) patch.epic_id = opt(f, 'epic_id');
  const { error } = await supabase.from('issues').update(patch).eq('key', key);
  if (error) back(`/t/${key}`, 'No se pudo guardar: ' + error.message);
  revalidatePath('/', 'layout');
  redirect(`/t/${key}`);
}

export async function addComment(f: FormData) {
  const { supabase, user } = await requireUser();
  const key = s(f, 'key');
  const body = s(f, 'body');
  if (body) {
    const { data: i } = await supabase.from('issues').select('id').eq('key', key).single();
    if (i) await supabase.from('comments').insert({ issue_id: i.id, author_id: user.id, body });
  }
  revalidatePath(`/t/${key}`);
  redirect(`/t/${key}#comentarios`);
}

export async function addSubtask(f: FormData) {
  const { supabase } = await requireUser();
  const key = s(f, 'key');
  const { data: i } = await supabase.from('issues').select('id').eq('key', key).single();
  if (i && s(f, 'title')) {
    const { count } = await supabase.from('subtasks').select('id', { count: 'exact', head: true }).eq('issue_id', i.id);
    await supabase.from('subtasks').insert({ issue_id: i.id, title: s(f, 'title'), position: count ?? 0 });
  }
  revalidatePath(`/t/${key}`);
  redirect(`/t/${key}`);
}

export async function toggleSubtask(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('subtasks').update({ done: s(f, 'done') === '1' }).eq('id', s(f, 'id'));
  revalidatePath(`/t/${s(f, 'key')}`);
  redirect(`/t/${s(f, 'key')}`);
}

/* ---------- Épicas y documentos ---------- */
export async function createEpic(f: FormData) {
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from('projects').select('id').eq('key', s(f, 'project')).single();
  if (p) await supabase.from('epics').insert({ project_id: p.id, name: s(f, 'name'), description: s(f, 'description') });
  revalidatePath(`/p/${s(f, 'project')}`);
  redirect(`/p/${s(f, 'project')}?tab=epicas`);
}

export async function createDoc(f: FormData) {
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from('projects').select('id, space_id').eq('key', s(f, 'project')).single();
  if (!p) back('/', 'Proyecto no encontrado.');
  const { count } = await supabase.from('doc_pages').select('id', { count: 'exact', head: true }).eq('project_id', p!.id);
  const { data } = await supabase.from('doc_pages').insert({ space_id: p!.space_id, project_id: p!.id, title: s(f, 'title'), body: '', position: (count ?? 0) + 1 }).select('id').single();
  redirect(`/p/${s(f, 'project')}?tab=documentos&doc=${data?.id}&editar=1`);
}

export async function saveDoc(f: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from('doc_pages').update({ title: s(f, 'title'), body: String(f.get('body') ?? ''), updated_by: user.id }).eq('id', s(f, 'id'));
  revalidatePath(`/p/${s(f, 'project')}`);
  redirect(`/p/${s(f, 'project')}?tab=documentos&doc=${s(f, 'id')}`);
}

/* ---------- Finanzas ---------- */
export async function createExpense(f: FormData) {
  const { supabase, user } = await requireUser();
  const ret = s(f, 'return') || '/finanzas';
  const amount = Number(s(f, 'amount').replace(/\./g, '').replace(',', '.'));
  if (!(amount >= 0)) back(ret, 'Escribe un valor válido.');
  const period = s(f, 'period') || 'once';
  const { error } = await supabase.from('finance_entries').insert({
    space_id: s(f, 'space'), project_id: opt(f, 'project'), concept: s(f, 'concept'), amount, currency: s(f, 'currency') || 'COP',
    period, status: s(f, 'status') || (period === 'once' ? 'paid' : 'active'), occurred_on: opt(f, 'occurred_on'),
    charge_day: opt(f, 'charge_day') ? Number(s(f, 'charge_day')) : null, note: s(f, 'note'), created_by: user.id,
  });
  if (error) back(ret, 'No se pudo anotar: ' + error.message);
  revalidatePath('/finanzas');
  redirect(ret);
}

export async function setExpenseStatus(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('finance_entries').update({ status: s(f, 'status') }).eq('id', s(f, 'id'));
  revalidatePath('/finanzas');
  redirect(s(f, 'return') || '/finanzas');
}

export async function deleteExpense(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('finance_entries').delete().eq('id', s(f, 'id'));
  revalidatePath('/finanzas');
  redirect(s(f, 'return') || '/finanzas');
}

/* ---------- Espacios, proyectos y miembros ---------- */
export async function createSpace(f: FormData) {
  const { supabase, user } = await requireUser();
  const habits = s(f, 'template') === 'habits';
  const { data, error } = await supabase.from('spaces').insert({
    name: s(f, 'name'), description: s(f, 'description') || (habits ? 'Hábitos en comunidad' : ''), kind: habits ? 'habits' : 'team', created_by: user.id,
    modules: habits ? { portfolio: false, finance: false, members: true } : undefined,
  }).select('id').single();
  if (error) back('/nuevo/espacio', 'No se pudo crear: ' + error.message);
  revalidatePath('/', 'layout');
  if (habits) redirect(`/habitos/${data!.id}`);
  redirect(`/nuevo/proyecto?espacio=${data!.id}&ok=${encodeURIComponent('Espacio creado. Ahora crea su primer proyecto.')}`);
}

export async function createProject(f: FormData) {
  const { supabase } = await requireUser();
  const space = s(f, 'space');
  const name = s(f, 'name');
  const key = (s(f, 'key') || name.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase();
  if (!/^[A-Z]{2,6}$/.test(key)) back(`/nuevo/proyecto?espacio=${space}`, 'La clave debe tener de 2 a 6 letras, sin tildes ni números.');
  const colors = ['#c77dff', '#4cc38a', '#cfaf6e', '#5fc9c0', '#ec6f86', '#7c6cf0', '#e0915a'];
  const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('space_id', space);
  const { error } = await supabase.from('projects').insert({ space_id: space, key, name, description: s(f, 'description'), color: colors[(count ?? 0) % colors.length], position: (count ?? 0) + 1 });
  if (error) back(`/nuevo/proyecto?espacio=${space}`, error.message.includes('duplicate') ? `Ya existe un proyecto con la clave ${key}.` : 'No se pudo crear: ' + error.message);
  revalidatePath('/', 'layout');
  redirect(`/p/${key}`);
}

export async function createInvite(f: FormData) {
  const { supabase, user } = await requireUser();
  const space = s(f, 'space');
  const projectIds = f.getAll('projects').map(String);
  const { data, error } = await supabase.from('space_invites').insert({ space_id: space, email: opt(f, 'email'), role: s(f, 'role') || 'member', project_ids: projectIds, created_by: user.id }).select('code').single();
  if (error) back(`/miembros/${space}`, 'No se pudo crear la invitación: ' + error.message);
  redirect(`/miembros/${space}?ok=${encodeURIComponent('Código de invitación: ' + data!.code + ' (vence en 14 días)')}`);
}

export async function toggleAccess(f: FormData) {
  const { supabase } = await requireUser();
  const [project, user] = [s(f, 'project'), s(f, 'user')];
  if (s(f, 'on') === '1') await supabase.from('project_access').insert({ project_id: project, user_id: user });
  else await supabase.from('project_access').delete().eq('project_id', project).eq('user_id', user);
  redirect(`/miembros/${s(f, 'space')}`);
}

export async function joinWithCode(f: FormData) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('accept_invite', { p_code: s(f, 'code').toUpperCase() });
  if (error) back('/nuevo/espacio', error.message);
  revalidatePath('/', 'layout');
  redirect(`/?ok=${encodeURIComponent('Te uniste a ' + data)}`);
}

/* ---------- Horario ---------- */
export async function addBlock(f: FormData) {
  const { supabase } = await requireUser();
  const days = f.getAll('weekdays').map(Number).filter(Boolean);
  if (!days.length) back('/calendario', 'Elige al menos un día.');
  if (s(f, 'end_time') <= s(f, 'start_time')) back('/calendario', 'La hora final debe ser después de la inicial.');
  const { error } = await supabase.from('schedule_blocks').insert({
    space_id: s(f, 'space'), title: s(f, 'title'), kind: s(f, 'kind') || 'study', tag: s(f, 'tag'), weekdays: days,
    start_time: s(f, 'start_time'), end_time: s(f, 'end_time'), ends_on: opt(f, 'ends_on'),
  });
  if (error) back('/calendario', 'No se pudo agregar: ' + error.message);
  revalidatePath('/calendario');
  redirect('/calendario?ok=' + encodeURIComponent('Bloque agregado.'));
}

export async function deleteBlock(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('schedule_blocks').delete().eq('id', s(f, 'id'));
  revalidatePath('/calendario');
  redirect('/calendario');
}

/* ---------- Ajustes y perfil ---------- */
export async function saveModules(f: FormData) {
  const { supabase, user } = await requireUser();
  const modules = Object.fromEntries(['messages', 'finance', 'assistant', 'calendar', 'bases'].map((m) => [m, f.get(m) === 'on']));
  await supabase.from('profiles').update({ modules }).eq('id', user.id);
  const spaces = f.getAll('space').map(String);
  for (const id of spaces) {
    const mods = Object.fromEntries(['portfolio', 'finance', 'members'].map((m) => [m, f.get(`${id}:${m}`) === 'on']));
    await supabase.from('spaces').update({ modules: mods }).eq('id', id);
  }
  revalidatePath('/', 'layout');
  redirect('/ajustes?ok=' + encodeURIComponent('Ajustes guardados.'));
}

export async function saveProfile(f: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from('profiles').update({ full_name: s(f, 'full_name') }).eq('id', user.id);
  revalidatePath('/', 'layout');
  redirect('/perfil?ok=' + encodeURIComponent('Perfil guardado.'));
}

/* ---------- Asistente ---------- */
/** Devuelve el token al navegador una sola vez; en la base solo queda su hash. */
export async function createToken(_prev: unknown, f: FormData): Promise<{ token?: string; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('assistant_create_token', { p_name: s(f, 'name') });
  if (error) return { error: 'No se pudo generar: ' + error.message };
  revalidatePath('/asistente');
  return { token: String(data) };
}

export async function revokeToken(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('assistant_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', s(f, 'id'));
  redirect('/asistente?ok=' + encodeURIComponent('Token revocado.'));
}

export async function savePermissions(f: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from('assistant_settings').upsert({
    user_id: user.id, client: s(f, 'client') || 'claude', can_read: true, can_write: f.get('can_write') === 'on',
    can_finance: f.get('can_finance') === 'on', can_delete: false, updated_at: new Date().toISOString(),
  });
  for (const id of f.getAll('space').map(String)) {
    await supabase.from('assistant_space_access').upsert({ user_id: user.id, space_id: id, allowed: f.get(`sp:${id}`) === 'on' });
  }
  redirect('/asistente?ok=' + encodeURIComponent('Permisos guardados.'));
}

/* ---------- Mensajes, notificaciones y bases propias ---------- */
export async function sendMessage(f: FormData) {
  const { supabase, user } = await requireUser();
  if (s(f, 'body')) await supabase.from('messages').insert({ channel_id: s(f, 'channel'), author_id: user.id, body: s(f, 'body') });
  revalidatePath('/mensajes');
  redirect(`/mensajes?canal=${s(f, 'channel')}`);
}

export async function createChannel(f: FormData) {
  const { supabase } = await requireUser();
  const name = s(f, 'name').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const { data } = await supabase.from('channels').insert({ space_id: s(f, 'space'), name }).select('id').single();
  redirect(`/mensajes?canal=${data?.id ?? ''}`);
}

export async function markAllRead() {
  const { supabase, user } = await requireUser();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
  revalidatePath('/', 'layout');
  redirect('/notificaciones');
}

export async function addRow(f: FormData) {
  const { supabase } = await requireUser();
  const db = s(f, 'db');
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith('v:')) values[k.slice(2)] = String(v).trim();
  const { count } = await supabase.from('user_db_rows').select('id', { count: 'exact', head: true }).eq('database_id', db);
  await supabase.from('user_db_rows').insert({ database_id: db, values, position: (count ?? 0) + 1 });
  redirect(`/personal/bases?db=${db}`);
}

export async function updateRow(f: FormData) {
  const { supabase } = await requireUser();
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith('v:')) values[k.slice(2)] = String(v).trim();
  await supabase.from('user_db_rows').update({ values }).eq('id', s(f, 'id'));
  redirect(`/personal/bases?db=${s(f, 'db')}`);
}

export async function deleteRow(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('user_db_rows').delete().eq('id', s(f, 'id'));
  redirect(`/personal/bases?db=${s(f, 'db')}`);
}

export async function createDatabase(f: FormData) {
  const { supabase } = await requireUser();
  const props = [{ key: 'nombre', name: 'Nombre', type: 'title' }, { key: 'estado', name: 'Estado', type: 'select' }, { key: 'fecha', name: 'Fecha', type: 'date' }];
  const { data } = await supabase.from('user_databases').insert({ space_id: s(f, 'space'), name: s(f, 'name'), properties: props }).select('id').single();
  redirect(`/personal/bases?db=${data?.id}`);
}

export async function addProperty(f: FormData) {
  const { supabase } = await requireUser();
  const { data: db } = await supabase.from('user_databases').select('properties').eq('id', s(f, 'db')).single();
  const name = s(f, 'name');
  const key = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_') || 'campo';
  const props = [...((db?.properties as any[]) ?? []), { key, name, type: s(f, 'type') || 'text' }];
  await supabase.from('user_databases').update({ properties: props }).eq('id', s(f, 'db'));
  redirect(`/personal/bases?db=${s(f, 'db')}`);
}

/* ---------- Llamadas (Jitsi Meet, sin claves ni costo) ---------- */
export async function startCall(f: FormData) {
  const { supabase, user } = await requireUser();
  const channel = s(f, 'channel');
  const { data, error } = await supabase.from('calls').insert({ channel_id: channel, started_by: user.id }).select('id').single();
  if (error) back(`/mensajes?canal=${channel}`, 'No se pudo iniciar la llamada: ' + error.message);
  await supabase.from('messages').insert({ channel_id: channel, author_id: user.id, body: 'Inició una llamada.' });
  revalidatePath('/mensajes');
  redirect(`/llamada/${data!.id}`);
}

export async function endCall(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('calls').update({ ended_at: new Date().toISOString() }).eq('id', s(f, 'id')).is('ended_at', null);
  revalidatePath('/mensajes');
  redirect(`/mensajes?canal=${s(f, 'channel')}`);
}

/* ---------- Foto de perfil ---------- */
export async function saveAvatar(f: FormData) {
  const { supabase, user } = await requireUser();
  const file = f.get('foto');
  if (!(file instanceof File) || !file.size) back('/perfil', 'Elige una foto.');
  const img = file as File;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(img.type)) back('/perfil', 'La foto debe ser JPG, PNG o WebP.');
  if (img.size > 3 * 1024 * 1024) back('/perfil', 'La foto debe pesar menos de 3 MB.');
  const ext = img.type === 'image/png' ? 'png' : img.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, img, { contentType: img.type, upsert: true });
  if (error) back('/perfil', 'No se pudo subir la foto: ' + error.message);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
  revalidatePath('/', 'layout');
  redirect('/perfil?ok=' + encodeURIComponent('Foto actualizada.'));
}

/* ---------- Preferencias de avisos ---------- */
export async function saveNotificationPrefs(f: FormData) {
  const { supabase, user } = await requireUser();
  const kinds = f.getAll('kind').map(String);
  const rows = kinds.map((k) => ({ user_id: user.id, kind: k, in_app: f.get(`app:${k}`) === 'on', push: f.get(`push:${k}`) === 'on', email: false }));
  await supabase.from('notification_prefs').upsert(rows);
  redirect('/notificaciones?ok=' + encodeURIComponent('Preferencias guardadas.'));
}

export async function openNotification(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', s(f, 'id'));
  revalidatePath('/', 'layout');
  const href = s(f, 'href');
  redirect(href.startsWith('/') && !href.startsWith('//') ? href : '/notificaciones');
}

/* ---------- Copia en Google Drive ---------- */
export async function saveBackup(f: FormData) {
  const { supabase, user } = await requireUser();
  const selection: Record<string, string[]> = {};
  for (const [k, v] of f.entries()) {
    const m = /^sel:(space:[0-9a-f-]{36}|[0-9a-f-]{36}):(docs|tasks|finance)$/.exec(k);
    if (m && v === 'on') (selection[m[1]] ??= []).push(m[2]);
  }
  const { error } = await supabase.from('backup_settings').upsert({ user_id: user.id, selection, auto_weekly: f.get('auto') === 'on', updated_at: new Date().toISOString() });
  if (error) back('/ajustes/copia', 'No se pudo guardar: ' + error.message);
  if (f.get('run') === '1') {
    const { runBackup } = await import('./drive');
    const r = await runBackup(supabase, user.id);
    back('/ajustes/copia', r.message, r.ok ? 'ok' : 'error');
  }
  back('/ajustes/copia', 'Selección guardada.', 'ok');
}

/** Copia semanal: solo corre si está activada y pasaron 7 días desde la última. */
export async function autoBackup() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from('backup_settings').select('auto_weekly, last_run').eq('user_id', user.id).maybeSingle();
  if (!data?.auto_weekly || (data.last_run && Date.now() - new Date(data.last_run).getTime() < 7 * 864e5)) return;
  const { runBackup } = await import('./drive');
  await runBackup(supabase, user.id);
}

/* ---------- Sprints ---------- */
export async function createSprint(f: FormData) {
  const { supabase } = await requireUser();
  const key = s(f, 'project');
  const { data: p } = await supabase.from('projects').select('id').eq('key', key).single();
  if (!p) back(`/p/${key}?tab=sprints`, 'Proyecto no encontrado.');
  const { error } = await supabase.from('sprints').insert({ project_id: p!.id, name: s(f, 'name') || 'Sprint', goal: s(f, 'goal'), start_date: opt(f, 'start'), end_date: opt(f, 'end') });
  if (error) back(`/p/${key}?tab=sprints`, 'No se pudo crear: ' + error.message);
  revalidatePath(`/p/${key}`);
  back(`/p/${key}?tab=sprints`, 'Sprint creado. Ahora pásale tareas desde el backlog.', 'ok');
}

export async function startSprint(f: FormData) {
  const { supabase } = await requireUser();
  const key = s(f, 'project');
  const { data: sp } = await supabase.from('sprints').select('id, project_id, start_date').eq('id', s(f, 'id')).single();
  if (!sp) back(`/p/${key}?tab=sprints`, 'Sprint no encontrado.');
  const { count } = await supabase.from('sprints').select('id', { count: 'exact', head: true }).eq('project_id', sp!.project_id).eq('state', 'active');
  if (count) back(`/p/${key}?tab=sprints`, 'Ya hay un sprint activo. Ciérralo antes de empezar otro.');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const { error } = await supabase.from('sprints').update({ state: 'active', start_date: sp!.start_date ?? today }).eq('id', sp!.id);
  if (error) back(`/p/${key}?tab=sprints`, 'No se pudo empezar: ' + error.message);
  revalidatePath(`/p/${key}`);
  redirect(`/p/${key}?tab=tablero`);
}

export async function closeSprint(f: FormData) {
  const { supabase } = await requireUser();
  const key = s(f, 'project');
  const id = s(f, 'id');
  const dest = s(f, 'dest');
  const { error: e1 } = await supabase.from('issues').update({ sprint_id: dest && dest !== 'backlog' ? dest : null }).eq('sprint_id', id).neq('status', 'done');
  if (e1) back(`/p/${key}?tab=sprints`, 'No se pudieron mover las tareas: ' + e1.message);
  const { error } = await supabase.from('sprints').update({ state: 'closed' }).eq('id', id);
  if (error) back(`/p/${key}?tab=sprints`, 'No se pudo cerrar: ' + error.message);
  revalidatePath(`/p/${key}`);
  back(`/p/${key}?tab=sprints`, 'Sprint cerrado.', 'ok');
}

export async function setIssueSprint(key: string, sprintId: string | null) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('issues').update({ sprint_id: sprintId }).eq('key', key);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function openDirect(f: FormData) {
  const { supabase } = await requireUser();
  const people = f.getAll('person').map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const { data, error } = await supabase.rpc('open_direct', { others: people });
  if (error) back('/mensajes', error.message);
  revalidatePath('/mensajes');
  redirect(`/mensajes?canal=${data}`);
}

/* ---------- Fotos y logos (la imagen ya se subió desde el navegador) ---------- */
const PUBLIC_STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;

export async function setAvatarUrl(url: string) {
  const { supabase, user } = await requireUser();
  if (!url.startsWith(`${PUBLIC_STORAGE}avatars/${user.id}/`)) return { error: 'Dirección de imagen no válida.' };
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function setProjectLogo(projectId: string, url: string | null) {
  const { supabase } = await requireUser();
  if (url !== null && !url.startsWith(`${PUBLIC_STORAGE}logos/${projectId}/`)) return { error: 'Dirección de imagen no válida.' };
  const { data, error } = await supabase.from('projects').update({ logo_url: url }).eq('id', projectId).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'No tienes permiso para cambiar este proyecto.' };
  revalidatePath('/', 'layout');
  return { success: true };
}

/* ---------- Hábitos ---------- */
export type HabitInput = { space: string; title: string; icon: string; color: string; weekdays: number[]; at_time: string | null; minutes: number | null; shared: boolean; gcal: boolean };

export async function createHabit(h: HabitInput) {
  const { supabase, user } = await requireUser();
  const title = h.title.trim().slice(0, 80);
  if (!title) return { error: 'Escribe qué quieres hacer.' };
  const weekdays = [...new Set(h.weekdays.filter((d) => d >= 1 && d <= 7))].sort();
  if (!weekdays.length) return { error: 'Elige al menos un día.' };
  const at = h.at_time && /^\d{2}:\d{2}$/.test(h.at_time) ? h.at_time : null;
  const minutes = h.minutes && h.minutes >= 5 && h.minutes <= 600 ? Math.round(h.minutes) : null;
  const { count } = await supabase.from('habits').select('id', { count: 'exact', head: true }).eq('space_id', h.space).eq('user_id', user.id).is('archived_at', null);
  const { data, error } = await supabase.from('habits').insert({
    space_id: h.space, user_id: user.id, title, icon: h.icon || 'check', color: /^#[0-9a-f]{6}$/i.test(h.color) ? h.color : '#c77dff',
    weekdays, at_time: at, minutes, shared: h.shared, position: count ?? 0,
  }).select('id').single();
  if (error) return { error: error.message };
  // Google Calendar: evento semanal en los mismos días, si la persona lo conectó y el hábito tiene hora.
  if (h.gcal && at) {
    const { accessToken, createWeeklyEvent } = await import('./google');
    const { data: rt } = await supabase.rpc('google_refresh_token');
    const token = rt ? await accessToken(String(rt)) : null;
    if (token) {
      const [hh, mm] = at.split(':').map(Number);
      const endMin = hh * 60 + mm + (minutes ?? 30);
      const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const { todayISO } = await import('./format');
      const id = await createWeeklyEvent(token, { title, weekdays, start: at, end, firstDate: todayISO() });
      if (id) await supabase.from('habits').update({ gcal_event_id: id }).eq('id', data.id);
    }
  }
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function archiveHabit(id: string) {
  const { supabase, user } = await requireUser();
  const { data: h } = await supabase.from('habits').select('gcal_event_id').eq('id', id).eq('user_id', user.id).single();
  const { error } = await supabase.from('habits').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
  if (error) return { error: error.message };
  if (h?.gcal_event_id) {
    const { accessToken, deleteEvent } = await import('./google');
    const { data: rt } = await supabase.rpc('google_refresh_token');
    const token = rt ? await accessToken(String(rt)) : null;
    if (token) await deleteEvent(token, h.gcal_event_id);
  }
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function toggleHabit(habitId: string, day: string, done: boolean) {
  const { supabase, user } = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Fecha no válida.' };
  const { error } = done
    ? await supabase.from('habit_checks').upsert({ habit_id: habitId, day, user_id: user.id }, { onConflict: 'habit_id,day', ignoreDuplicates: true })
    : await supabase.from('habit_checks').delete().eq('habit_id', habitId).eq('day', day).eq('user_id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function toggleBlock(blockId: string, day: string, done: boolean) {
  const { supabase, user } = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Fecha no válida.' };
  const { error } = done
    ? await supabase.from('block_checks').upsert({ block_id: blockId, day, user_id: user.id }, { onConflict: 'block_id,day', ignoreDuplicates: true })
    : await supabase.from('block_checks').delete().eq('block_id', blockId).eq('day', day).eq('user_id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function sendNudge(to: string, habitId: string, message: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('send_nudge', { p_to: to, p_habit: habitId, p_message: message });
  if (error) return { error: error.message };
  return { success: true };
}

/* ---------- Eventos del calendario ---------- */
export async function saveEvent(f: FormData) {
  const { supabase, user } = await requireUser();
  const id = s(f, 'id');
  const title = s(f, 'title').slice(0, 120);
  const date = s(f, 'date');
  const allDay = f.get('all_day') === 'on';
  const start = allDay ? '00:00' : s(f, 'start') || '09:00';
  let end = allDay ? '23:59' : s(f, 'end') || start;
  if (end < start) end = start;
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) back('/calendario', 'Escribe el título y la fecha del evento.');
  const repeat = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'].includes(s(f, 'repeat')) ? s(f, 'repeat') : 'none';
  const remind = s(f, 'remind') === '' ? null : Number(s(f, 'remind'));
  const row = {
    title, all_day: allDay, starts_at: `${date}T${start}:00-05:00`, ends_at: `${date}T${end}:00-05:00`, repeat, remind_min: remind,
    location: s(f, 'location'), notes: s(f, 'notes'), color: /^#[0-9a-f]{6}$/i.test(s(f, 'color')) ? s(f, 'color') : '#c77dff', updated_at: new Date().toISOString(),
  };
  const { error } = id ? await supabase.from('events').update(row).eq('id', id).eq('user_id', user.id) : await supabase.from('events').insert({ ...row, user_id: user.id });
  if (error) back('/calendario', 'No se pudo guardar: ' + error.message);
  revalidatePath('/calendario');
  back(`/calendario?semana=${date}`, id ? 'Evento actualizado.' : 'Evento creado.', 'ok');
}

export async function deleteEvent(f: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from('events').delete().eq('id', s(f, 'id')).eq('user_id', user.id);
  revalidatePath('/calendario');
  back('/calendario', 'Evento eliminado.', 'ok');
}

/** Código para invitar a un espacio de hábitos (sin proyectos de por medio). */
export async function createHabitInvite(space: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from('space_invites').insert({ space_id: space, role: 'member', project_ids: [], created_by: user.id }).select('code').single();
  if (error) return { error: error.message };
  return { code: data.code as string };
}
