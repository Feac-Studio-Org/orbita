import { addDays, isoWeekday, todayISO } from './format';

/** Rangos de la revisión. "desde/hasta" cubre cualquier otro. */
export const RANGES = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Esta semana'], ['semana-pasada', 'Semana pasada'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['mes', 'Este mes']] as const;

export function resolveRange(r?: string, desde?: string, hasta?: string): { from: string; to: string; key: string } {
  const today = todayISO();
  const ok = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (ok(desde) && ok(hasta)) {
    let [from, to] = desde! <= hasta! ? [desde!, hasta!] : [hasta!, desde!];
    if (to > today) to = today;
    if (from < addDays(to, -365)) from = addDays(to, -365);
    return { from, to, key: 'custom' };
  }
  const monday = addDays(today, 1 - isoWeekday(today));
  switch (r) {
    case 'ayer': return { from: addDays(today, -1), to: addDays(today, -1), key: 'ayer' };
    case 'semana': return { from: monday, to: today, key: 'semana' };
    case 'semana-pasada': return { from: addDays(monday, -7), to: addDays(monday, -1), key: 'semana-pasada' };
    case '7': return { from: addDays(today, -6), to: today, key: '7' };
    case '30': return { from: addDays(today, -29), to: today, key: '30' };
    case 'mes': return { from: today.slice(0, 8) + '01', to: today, key: 'mes' };
    default: return { from: today, to: today, key: 'hoy' };
  }
}

export function daysBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Fecha de Bogotá de un instante guardado en UTC. */
export const bogotaDay = (ts: string) => new Date(new Date(ts).getTime() - 5 * 3600e3).toISOString().slice(0, 10);

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
