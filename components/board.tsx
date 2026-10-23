'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { setIssueStatus } from '@/lib/actions';
import { STATUS, STATUS_ORDER, fmtDate, isLate } from '@/lib/format';

type Card = { key: string; title: string; status: string; priority: string; due_date: string | null; epic?: string };

export function Board({ issues }: { issues: Card[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [items, move] = useOptimistic(issues, (cur, a: { key: string; status: string }) => cur.map((i) => (i.key === a.key ? { ...i, status: a.status } : i)));

  function drop(status: string, key: string) {
    setOver(null);
    const card = items.find((i) => i.key === key);
    if (!card || card.status === status) return;
    start(async () => {
      move({ key, status });
      const r = await setIssueStatus(key, status);
      if (r.error) setError(`No se pudo mover ${key}: ${r.error}`);
      router.refresh();
    });
  }

  return (
    <>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="board">
        {STATUS_ORDER.map((st) => {
          const col = items.filter((i) => i.status === st);
          return (
            <div key={st} className={'col' + (over === st ? ' over' : '')}
              onDragOver={(e) => { e.preventDefault(); setOver(st); }}
              onDragLeave={() => setOver((o) => (o === st ? null : o))}
              onDrop={(e) => { e.preventDefault(); drop(st, e.dataTransfer.getData('text/plain')); }}>
              <div className="col-head"><span className="label">{STATUS[st]}</span><span className="num muted">{col.length}</span></div>
              {col.map((i) => (
                <Link key={i.key} href={`/t/${i.key}`} className="card" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', i.key)}>
                  <p>{i.title}</p>
                  {i.epic && <span className="epic-chip">{i.epic}</span>}
                  <div className="card-meta">
                    <span className={'prio ' + i.priority} />
                    <span className="key">{i.key}</span>
                    {i.due_date && <span className={'due' + (isLate(i.due_date, i.status) ? ' late' : '')}>{fmtDate(i.due_date)}</span>}
                  </div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      <p className="note">Arrastra una tarjeta para cambiar su estado, o ábrela para editarla.</p>
    </>
  );
}
