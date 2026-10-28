'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveHabit } from '@/lib/actions';

/** Dejar un hábito propio (su historial se conserva). */
export function ArchiveHabit({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="link hbt-leave" disabled={pending} onClick={() => { if (confirm(`¿Dejar "${title}"? Tu historial se conserva.`)) start(async () => { await archiveHabit(id); router.refresh(); }); }}>
      {pending ? 'Quitando…' : 'Dejar'}
    </button>
  );
}
