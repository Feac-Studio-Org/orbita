'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireUser } from './supabase/server';
import { LIST_COLORS, type Step } from './tasks';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const opt = (f: FormData, k: string) => s(f, k) || null;
/** La última lista que usaste queda elegida la próxima vez que crees una tarea. */
async function rememberList(id: string | null) {
  (await cookies()).set('tk_lista', id ?? '', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
}
const go = (f: FormData, extra: string) => {
  const from = s(f, 'from') || '/tareas';
  redirect(`${from}${from.includes('?') ? '&' : '?'}${extra}`);
};

/** Campos comunes del formulario de tarea (crear y editar). */
function fields(f: FormData) {
  const remind = f.getAll('remind').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 30);
  const steps: Step[] = s(f, 'steps').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 40).map((l) => {
    const done = /^\[x\]\s*/i.test(l);
    return { t: l.replace(/^\[( |x)\]\s*/i, '').slice(0, 160), done };
  });
  const priority = ['high', 'medium', 'low'].includes(s(f, 'priority')) ? s(f, 'priority') : 'medium';
  const repeat = ['none', 'daily', 'weekly', 'monthly'].includes(s(f, 'repeat')) ? s(f, 'repeat') : 'none';
  return {
    title: s(f, 'title').slice(0, 200), notes: s(f, 'notes'), list_id: opt(f, 'list'), goal_id: f.has('goal') ? opt(f, 'goal') : undefined, priority, repeat,
    due_date: opt(f, 'due'), due_time: opt(f, 'time'),
    remind_days: f.has('remind_set') ? [...new Set(remind)] : undefined,
    remind_time: opt(f, 'remind_time') ?? undefined,
    remind_overdue: f.has('remind_set') ? f.get('overdue') === 'on' : undefined,
    steps,
  };
}

export async function createTask(f: FormData) {
  const { supabase } = await requireUser();
  const v = fields(f);
  if (!v.title) go(f, 'error=' + encodeURIComponent('Escribe qué hay que hacer.'));
  const row = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));
  const { error } = await supabase.from('tasks').insert(row);
  if (error) go(f, 'error=' + encodeURIComponent('No se pudo crear: ' + error.message));
  await rememberList(v.list_id);
  revalidatePath('/', 'layout');
  go(f, 'ok=' + encodeURIComponent(v.due_date ? 'Tarea creada. Te aviso antes del plazo.' : 'Tarea creada.'));
}

export async function updateTask(f: FormData) {
  const { supabase } = await requireUser();
  const v = fields(f);
  if (!v.title) go(f, 'error=' + encodeURIComponent('La tarea necesita un nombre.'));
  const row = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));
  const { error } = await supabase.from('tasks').update(row).eq('id', s(f, 'id'));
  if (error) go(f, 'error=' + encodeURIComponent('No se pudo guardar: ' + error.message));
  revalidatePath('/', 'layout');
  go(f, 'ok=' + encodeURIComponent('Cambios guardados.'));
}

export async function deleteTask(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('tasks').delete().eq('id', s(f, 'id'));
  revalidatePath('/', 'layout');
  const from = (s(f, 'from') || '/tareas').replace(/[?&]t=[^&]*/, '');
  redirect(`${from}${from.includes('?') ? '&' : '?'}ok=${encodeURIComponent('Tarea eliminada.')}`);
}

/** Marcar o desmarcar desde la lista (sin recargar la página). */
export async function setTaskDone(id: string, done: boolean) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('tasks').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function setStepDone(id: string, index: number, done: boolean) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from('tasks').select('steps').eq('id', id).single();
  const steps = (data?.steps ?? []) as Step[];
  if (!steps[index]) return { error: 'Paso no encontrado.' };
  steps[index].done = done;
  const { error } = await supabase.from('tasks').update({ steps }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/tareas');
  return { success: true };
}

/** Crear rápido: solo nombre, plazo y, si estás dentro de una lista, esa lista. */
export async function quickTask(title: string, due: string | null, list: string | null = null) {
  const { supabase } = await requireUser();
  const t = title.trim().slice(0, 200);
  if (!t) return { error: 'Escribe qué hay que hacer.' };
  const { error } = await supabase.from('tasks').insert({ title: t, due_date: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null, list_id: list || null });
  if (error) return { error: error.message };
  await rememberList(list || null);
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function createList(f: FormData) {
  const { supabase } = await requireUser();
  const name = s(f, 'name').slice(0, 60);
  if (!name) go(f, 'error=' + encodeURIComponent('Ponle nombre a la lista.'));
  const { count } = await supabase.from('task_lists').select('id', { count: 'exact', head: true });
  const { data, error } = await supabase.from('task_lists').insert({ name, color: s(f, 'color') || LIST_COLORS[(count ?? 0) % LIST_COLORS.length], position: (count ?? 0) + 1 }).select('id').single();
  if (error) go(f, 'error=' + encodeURIComponent('No se pudo crear: ' + error.message));
  await rememberList(data!.id);
  revalidatePath('/', 'layout');
  redirect(`/tareas?vista=lista&lista=${data!.id}`);
}

export async function updateList(f: FormData) {
  const { supabase } = await requireUser();
  const id = s(f, 'id');
  await supabase.from('task_lists').update({ name: s(f, 'name').slice(0, 60), color: s(f, 'color') }).eq('id', id);
  revalidatePath('/', 'layout');
  redirect(`/tareas?vista=lista&lista=${id}`);
}

export async function deleteList(f: FormData) {
  const { supabase } = await requireUser();
  // Las tareas no se borran: quedan sin lista.
  await supabase.from('task_lists').delete().eq('id', s(f, 'id'));
  revalidatePath('/', 'layout');
  redirect('/tareas?vista=lista&ok=' + encodeURIComponent('Lista eliminada. Sus tareas quedaron en "Sin lista".'));
}
