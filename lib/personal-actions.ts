'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from './supabase/server';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const opt = (f: FormData, k: string) => s(f, k) || null;
const num = (f: FormData, k: string) => { const v = Number(s(f, k).replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) && s(f, k) !== '' ? v : null; };
const msg = (path: string, kind: 'ok' | 'error', text: string) => redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(text)}`);

/* ---------- Notas ---------- */
export async function createNote(f: FormData) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from('notes').insert({ title: s(f, 'title').slice(0, 200), folder: opt(f, 'folder') }).select('id').single();
  if (error) msg('/notas', 'error', 'No se pudo crear: ' + error.message);
  revalidatePath('/notas');
  redirect(`/notas?n=${data!.id}`);
}

/** Guardado desde el editor (se llama solo mientras escribes). */
export async function saveNote(id: string, v: { title: string; body: string; folder: string | null }) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('notes').update({ title: v.title.slice(0, 200), body: v.body, folder: v.folder?.trim().slice(0, 60) || null }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/notas');
  return { success: true };
}

export async function pinNote(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('notes').update({ pinned: s(f, 'pinned') === '1' }).eq('id', s(f, 'id'));
  revalidatePath('/notas');
  redirect(`/notas?n=${s(f, 'id')}`);
}

export async function deleteNote(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from('notes').delete().eq('id', s(f, 'id'));
  revalidatePath('/notas');
  msg('/notas', 'ok', 'Nota eliminada.');
}

/* ---------- Metas ---------- */
function goalFields(f: FormData) {
  const measure = s(f, 'measure') === 'number' ? 'number' : 'tasks';
  return { title: s(f, 'title').slice(0, 200), why: s(f, 'why'), target_date: opt(f, 'date'), measure, target: measure === 'number' ? num(f, 'target') : null, unit: s(f, 'unit').slice(0, 30), color: s(f, 'color') || '#c77dff' };
}

export async function createGoal(f: FormData) {
  const { supabase } = await requireUser();
  const v = goalFields(f);
  if (!v.title) msg('/metas?nueva=1', 'error', 'Escribe la meta.');
  if (v.measure === 'number' && !v.target) msg('/metas?nueva=1', 'error', 'Pon a cuánto quieres llegar.');
  const { data, error } = await supabase.from('goals').insert(v).select('id').single();
  if (error) msg('/metas', 'error', 'No se pudo crear: ' + error.message);
  revalidatePath('/', 'layout');
  redirect(`/metas?m=${data!.id}`);
}

export async function updateGoal(f: FormData) {
  const { supabase } = await requireUser();
  const id = s(f, 'id');
  const { error } = await supabase.from('goals').update(goalFields(f)).eq('id', id);
  if (error) msg(`/metas?m=${id}`, 'error', 'No se pudo guardar: ' + error.message);
  revalidatePath('/', 'layout');
  msg(`/metas?m=${id}`, 'ok', 'Meta guardada.');
}

/** Sumar o fijar el avance de una meta numérica. */
export async function setGoalProgress(f: FormData) {
  const { supabase } = await requireUser();
  const id = s(f, 'id');
  const { data: g } = await supabase.from('goals').select('current, target').eq('id', id).single();
  const add = num(f, 'add'), set = num(f, 'set');
  const current = set ?? Number(g?.current ?? 0) + (add ?? 0);
  await supabase.from('goals').update({ current, done_at: g?.target && current >= Number(g.target) ? new Date().toISOString() : null }).eq('id', id);
  revalidatePath('/', 'layout');
  redirect(`/metas?m=${id}`);
}

export async function completeGoal(f: FormData) {
  const { supabase } = await requireUser();
  const id = s(f, 'id');
  await supabase.from('goals').update({ done_at: s(f, 'done') === '1' ? new Date().toISOString() : null }).eq('id', id);
  revalidatePath('/', 'layout');
  msg(`/metas?m=${id}`, 'ok', s(f, 'done') === '1' ? 'Meta cumplida.' : 'Meta reabierta.');
}

export async function deleteGoal(f: FormData) {
  const { supabase } = await requireUser();
  // Las tareas y hábitos vinculados no se borran: solo pierden el vínculo.
  await supabase.from('goals').delete().eq('id', s(f, 'id'));
  revalidatePath('/', 'layout');
  msg('/metas', 'ok', 'Meta eliminada. Sus tareas y hábitos se conservan.');
}

/** Qué hábitos empujan esta meta. */
export async function linkGoalHabits(f: FormData) {
  const { supabase, user } = await requireUser();
  const id = s(f, 'id');
  const picked = f.getAll('habit').map(String);
  await supabase.from('habits').update({ goal_id: null }).eq('user_id', user.id).eq('goal_id', id);
  if (picked.length) await supabase.from('habits').update({ goal_id: id }).eq('user_id', user.id).in('id', picked);
  revalidatePath('/metas');
  msg(`/metas?m=${id}`, 'ok', 'Hábitos vinculados.');
}

