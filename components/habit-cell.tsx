'use client';
import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleHabit } from '@/lib/actions';

/** Casilla de un hábito en un día de la semana (se puede marcar hoy y días pasados). */
export function HabitCell({ habit, day, done, due, future, color, label }: { habit: string; day: string; done: boolean; due: boolean; future: boolean; color: string; label: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [on, set] = useOptimistic(done);
  if (!due) return <span className="hc off" aria-hidden="true" />;
  return (
    <button type="button" className={'hc' + (on ? ' on' : '') + (future ? ' future' : '')} style={{ ['--hc' as string]: color }} disabled={future} aria-pressed={on} title={label}
      onClick={() => start(async () => { set(!on); await toggleHabit(habit, day, !on); router.refresh(); })}>
      {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
    </button>
  );
}
