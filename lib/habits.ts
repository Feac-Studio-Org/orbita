import { addDays, isoWeekday } from './format';

export type Habit = {
  id: string; space_id: string; user_id: string; title: string; group_key: string; icon: string; color: string;
  weekdays: number[]; at_time: string | null; minutes: number | null; shared: boolean; position: number;
};
export type Check = { habit_id: string; day: string; user_id: string; done_at: string };

export const HABIT_COLORS = ['#c77dff', '#4cc38a', '#5fa8f5', '#cfaf6e', '#ec6f86', '#5fc9c0', '#e0915a'];

/** Hábitos sugeridos para empezar rápido. */
export const SUGGESTED = [
  { title: 'Hacer ejercicio', icon: 'dumbbell', color: '#4cc38a' },
  { title: 'Estudiar trading', icon: 'chart', color: '#cfaf6e' },
  { title: 'Estudiar inglés', icon: 'globe', color: '#5fa8f5' },
  { title: 'Leer', icon: 'book', color: '#c77dff' },
  { title: 'Tomar agua', icon: 'water', color: '#5fc9c0' },
  { title: 'Dormir 8 horas', icon: 'moon', color: '#7c6cf0' },
  { title: 'Meditar', icon: 'leaf', color: '#4cc38a' },
  { title: 'Programar', icon: 'code', color: '#e0915a' },
];

export const isDue = (h: Pick<Habit, 'weekdays'>, day: string) => h.weekdays.includes(isoWeekday(day));

/** Días seguidos (hacia atrás desde hoy o ayer) en que se cumplieron todos los hábitos que tocaban. */
export function streak(habits: Habit[], checks: Check[], today: string) {
  const done = new Set(checks.map((c) => c.habit_id + c.day));
  let n = 0;
  let day = today;
  const dueToday = habits.filter((h) => isDue(h, today));
  if (dueToday.length && !dueToday.every((h) => done.has(h.id + today))) day = addDays(today, -1); // hoy todavía no termina
  for (let i = 0; i < 400; i++) {
    const due = habits.filter((h) => isDue(h, day));
    if (due.length) {
      if (!due.every((h) => done.has(h.id + day))) break;
      n++;
    }
    day = addDays(day, -1);
  }
  return n;
}

/** Porcentaje cumplido de los hábitos que tocaban un día (null si no tocaba ninguno). */
export function dayPct(habits: Habit[], checks: Check[], day: string) {
  const due = habits.filter((h) => isDue(h, day));
  if (!due.length) return null;
  const done = due.filter((h) => checks.some((c) => c.habit_id === h.id && c.day === day)).length;
  return Math.round((done / due.length) * 100);
}

export const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const freqLabel = (w: number[]) =>
  w.length === 7 ? 'Todos los días' : w.join() === '1,2,3,4,5' ? 'Entre semana' : w.join() === '6,7' ? 'Fines de semana' : `${w.length} veces por semana · ${w.map((d) => WD[d - 1]).join(' ')}`;
