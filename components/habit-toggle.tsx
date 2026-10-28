'use client';
import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleBlock, toggleHabit } from '@/lib/actions';
import { HabitIcon } from './habit-icon';

/** Tarjeta que se marca con un toque (hábito o bloque del horario). */
export function HabitToggle({ habit, block, day, done, title, sub, color = '#c77dff', icon = 'check', disabled = false }: { habit?: string; block?: string; day: string; done: boolean; title: string; sub?: string; color?: string; icon?: string; disabled?: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [on, set] = useOptimistic(done);
  function flip() {
    if (disabled) return;
    start(async () => {
      set(!on);
      if (habit) await toggleHabit(habit, day, !on); else if (block) await toggleBlock(block, day, !on);
      router.refresh();
    });
  }
  return (
    <button type="button" className={'ht' + (on ? ' done' : '')} style={{ ['--hc' as string]: color }} onClick={flip} disabled={disabled} aria-pressed={on}>
      <span className="ht-ico"><HabitIcon name={on ? 'check' : icon} size={18} /></span>
      <span className="ht-txt"><b>{title}</b>{sub && <small>{sub}</small>}</span>
    </button>
  );
}
