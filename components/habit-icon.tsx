/** Íconos de línea para hábitos. */
const P: Record<string, React.ReactNode> = {
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  dumbbell: <path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" />,
  chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 3 5-6" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5S9.6 6.1 12 3.5Z" /></>,
  book: <path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3Zm0 12a3 3 0 0 1 3-3h10" />,
  water: <path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z" />,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />,
  leaf: <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14Zm0 0 7-7" />,
  code: <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13" />,
  run: <><circle cx="14" cy="4.5" r="1.8" /><path d="m6 20 3.5-5 3 2 1.5-5 3.5 3M8 10.5l3.5-2.5 3 1.5" /></>,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />,
  pen: <path d="m15 5 4 4L8.5 19.5H4.5v-4Z" />,
  briefcase: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5v-2a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2" /></>,
};
export const HABIT_ICONS = Object.keys(P);

export function HabitIcon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name] ?? P.check}</svg>;
}
