'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setIssueSprint } from '@/lib/actions';

/** Selector para pasar una tarea a un sprint o devolverla al backlog. */
export function SprintPicker({ issue, value, sprints }: { issue: string; value: string | null; sprints: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select className="sp-pick" value={value ?? ''} disabled={pending} aria-label={`Sprint de ${issue}`}
      onChange={(e) => { const v = e.target.value || null; start(async () => { await setIssueSprint(issue, v); router.refresh(); }); }}>
      <option value="">Backlog</option>
      {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}
