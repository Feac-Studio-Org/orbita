import { addDays, isoWeekday } from './format';

export type Ev = { id: string; title: string; starts_at: string; ends_at: string; all_day: boolean; color: string; repeat: string; repeat_until: string | null; remind_min: number | null; location: string; notes: string };

/** Fecha y hora de Bogotá (AAAA-MM-DD, HH:MM) de un instante. */
export function bogota(ts: string) {
  const d = new Date(new Date(ts).getTime() - 5 * 3600 * 1000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

/** ¿El evento ocurre este día? (incluye repeticiones y eventos de varios días) */
export function occursOn(e: Ev, day: string) {
  const start = bogota(e.starts_at).date, end = bogota(e.ends_at).date;
  if (day < start || (e.repeat_until && day > e.repeat_until)) return false;
  const span = Math.round((Date.parse(end) - Date.parse(start)) / 864e5);
  const hit = (d: string) => {
    switch (e.repeat) {
      case 'daily': return true;
      case 'weekdays': return isoWeekday(d) <= 5;
      case 'weekly': return isoWeekday(d) === isoWeekday(start);
      case 'monthly': return d.slice(8) === start.slice(8);
      case 'yearly': return d.slice(5) === start.slice(5);
      default: return d === start;
    }
  };
  for (let i = 0; i <= span; i++) if (hit(addDays(day, -i))) return true;
  return false;
}

export const REPEAT: Record<string, string> = { none: 'No se repite', daily: 'Cada día', weekdays: 'Entre semana', weekly: 'Cada semana', monthly: 'Cada mes', yearly: 'Cada año' };
export const REMIND: [string, string][] = [['', 'Sin aviso'], ['0', 'A la hora'], ['10', '10 min antes'], ['30', '30 min antes'], ['60', '1 hora antes'], ['1440', '1 día antes']];
