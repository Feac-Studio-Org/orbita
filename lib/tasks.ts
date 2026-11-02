import { addDays, fmtDate, hhmm, todayISO } from './format';

export type TaskList = { id: string; name: string; color: string; position: number };
export type Step = { t: string; done: boolean };
export type Task = {
  id: string; list_id: string | null; title: string; notes: string; priority: 'high' | 'medium' | 'low';
  due_date: string | null; due_time: string | null; remind_days: number[]; remind_time: string; remind_overdue: boolean;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly'; steps: Step[]; done_at: string | null; created_at: string;
};

export const TASK_PRIORITY = { high: 'Alta', medium: 'Media', low: 'Baja' } as const;
export const TASK_REPEAT = { none: 'No se repite', daily: 'Cada día', weekly: 'Cada semana', monthly: 'Cada mes' } as const;
export const LIST_COLORS = ['#c77dff', '#4cc38a', '#5fa8f5', '#cfaf6e', '#ec6f86', '#5fc9c0', '#e0915a'];
/** Días antes del plazo en que se puede avisar. 0 = el mismo día. */
export const REMIND_OPTIONS = [7, 5, 3, 2, 1, 0];
export const DEFAULT_REMIND = [3, 2, 1, 0];

export const daysLeft = (due: string) => Math.round((new Date(due + 'T12:00:00Z').getTime() - new Date(todayISO() + 'T12:00:00Z').getTime()) / 864e5);

/** "Vence hoy", "Faltan 4 días", "Vencida hace 2 días"… y el tono para la etiqueta. */
export function dueLabel(t: Pick<Task, 'due_date' | 'due_time' | 'done_at'>): { text: string; tone: '' | 'ok' | 'warn' | 'bad' | 'v' } {
  if (!t.due_date) return { text: 'Sin plazo', tone: '' };
  if (t.done_at) return { text: fmtDate(t.due_date), tone: 'ok' };
  const n = daysLeft(t.due_date);
  const at = t.due_time ? ` · ${hhmm(t.due_time)}` : '';
  if (n < 0) return { text: `Vencida hace ${-n} ${n === -1 ? 'día' : 'días'}`, tone: 'bad' };
  if (n === 0) return { text: 'Hoy' + at, tone: 'warn' };
  if (n === 1) return { text: 'Mañana' + at, tone: 'warn' };
  if (n <= 7) return { text: `En ${n} días · ${fmtDate(t.due_date)}`, tone: 'v' };
  return { text: fmtDate(t.due_date) + at, tone: '' };
}

/** Texto corto de cuándo va a avisar. */
export function remindText(days: number[]) {
  if (!days.length) return 'Sin recordatorios';
  const sorted = [...days].sort((a, b) => b - a);
  return 'Avisa ' + sorted.map((d) => (d === 0 ? 'el mismo día' : d === 1 ? '1 día antes' : `${d} días antes`)).join(', ');
}

export const inDays = (n: number) => addDays(todayISO(), n);
