export const TZ = 'America/Bogota';
export const STATUS: Record<string, string> = { todo: 'Por hacer', progress: 'En curso', review: 'En revisión', done: 'Hecho' };
export const STATUS_ORDER = ['todo', 'progress', 'review', 'done'] as const;
export const PRIORITY: Record<string, string> = { highest: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };
export const ROLE: Record<string, string> = { owner: 'Dueño', partner: 'Socio', member: 'Miembro', guest: 'Invitado' };
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const PERIOD: Record<string, string> = { once: 'Pago único', monthly: 'Mensual', yearly: 'Anual' };
export const FIN_STATUS: Record<string, string> = { paid: 'Pagado', pending: 'Por pagar', active: 'Activa', cancelled: 'Cancelada' };

/** Fecha de hoy en Bogotá como AAAA-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}
/** Día ISO de la semana en Bogotá: 1 = lunes … 7 = domingo. */
export function isoWeekday(iso = todayISO()): number {
  const d = new Date(iso + 'T12:00:00Z').getUTCDay();
  return d === 0 ? 7 : d;
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${+d} ${MES[+m - 1]}`;
}
export function hhmm(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${+h}:${m}`;
}
export function isLate(due?: string | null, status?: string): boolean {
  return !!due && status !== 'done' && due < todayISO();
}
export function money(n: number, cur: string): string {
  const v = Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  return cur === 'USD' ? `US$${v}` : `${v} COP`;
}
export function initial(name?: string | null): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}
