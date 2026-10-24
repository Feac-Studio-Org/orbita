'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { quickIssue, setIssueStatus } from '@/lib/actions';
import { PRIORITY, STATUS, STATUS_ORDER, fmtDate, isLate } from '@/lib/format';
import { Avatar } from './avatar';

export type Card = {
  key: string; title: string; status: string; priority: string; due_date: string | null;
  epic_id?: string | null; epic?: string; assignee_id?: string | null; subtasks?: [number, number];
};
type Person = { id: string; name: string; avatar: string | null };
type Epic = { id: string; name: string };

const DOT: Record<string, string> = { todo: 'var(--faint)', progress: 'var(--violet-hi)', review: 'var(--warn)', done: 'var(--ok)' };

export function Board({ issues, epics, people, project, canEdit }: { issues: Card[]; epics: Epic[]; people: Person[]; project: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [epic, setEpic] = useState('');
  const [who, setWho] = useState('');
  const [prio, setPrio] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [items, move] = useOptimistic(issues, (cur, a: { key: string; status: string }) => cur.map((i) => (i.key === a.key ? { ...i, status: a.status } : i)));
  const person = (id?: string | null) => people.find((p) => p.id === id);

  const shown = useMemo(() => items.filter((i) =>
    (!q || (i.title + ' ' + i.key).toLowerCase().includes(q.toLowerCase())) &&
    (!epic || (epic === 'none' ? !i.epic_id : i.epic_id === epic)) &&
    (!who || (who === 'none' ? !i.assignee_id : i.assignee_id === who)) &&
    (!prio || i.priority === prio)), [items, q, epic, who, prio]);
  const filtered = Boolean(q || epic || who || prio);

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

  function add(status: string) {
    const title = draft.trim();
    if (!title) return setAdding(null);
    start(async () => {
      const r = await quickIssue(project, title, status, epic && epic !== 'none' ? epic : null);
      if (r.error) setError('No se pudo crear: ' + r.error);
      setDraft('');
      router.refresh();
    });
  }

  return (
    <>
      <div className="filters">
        <input className="inp" placeholder="Filtrar tareas" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar por texto" />
        <select className="inp" value={epic} onChange={(e) => setEpic(e.target.value)} aria-label="Épica">
          <option value="">Todas las épicas</option>{epics.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}<option value="none">Sin épica</option>
        </select>
        <select className="inp" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Responsable">
          <option value="">Todos los responsables</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="none">Sin asignar</option>
        </select>
        <select className="inp" value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Prioridad">
          <option value="">Cualquier prioridad</option>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {filtered && <button className="link" onClick={() => { setQ(''); setEpic(''); setWho(''); setPrio(''); }}>Limpiar filtros</button>}
        <span className="note num filters-count">{shown.length} de {items.length} tareas</span>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="board">
        {STATUS_ORDER.map((st) => {
          const col = shown.filter((i) => i.status === st);
          return (
            <div key={st} className={'col' + (over === st ? ' over' : '')}
              onDragOver={(e) => { e.preventDefault(); setOver(st); }}
              onDragLeave={() => setOver((o) => (o === st ? null : o))}
              onDrop={(e) => { e.preventDefault(); drop(st, e.dataTransfer.getData('text/plain')); }}>
              <div className="col-head">
                <span className="col-title"><i style={{ background: DOT[st] }} />{STATUS[st]}</span>
                <span className="col-count num">{col.length}</span>
              </div>
              <div className="col-body">
                {col.map((i) => {
                  const a = person(i.assignee_id);
                  const late = isLate(i.due_date, i.status);
                  return (
                    <Link key={i.key} href={`/t/${i.key}`} className={'card' + (i.status === 'done' ? ' is-done' : '')} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', i.key)}>
                      {i.epic && <span className="epic-chip">{i.epic}</span>}
                      <p>{i.title}</p>
                      <div className="card-meta">
                        <span className={'prio ' + i.priority} title={PRIORITY[i.priority]} />
                        <span className="key">{i.key}</span>
                        {i.subtasks && i.subtasks[1] > 0 && <span className="sub num" title="Subtareas hechas">{i.subtasks[0]}/{i.subtasks[1]}</span>}
                        {i.due_date && <span className={'due' + (late ? ' late' : '')}>{fmtDate(i.due_date)}</span>}
                        <span className="who" title={a ? a.name : 'Sin asignar'}>{a ? <Avatar name={a.name} url={a.avatar} size={22} /> : <span className="avatar empty" />}</span>
                      </div>
                    </Link>
                  );
                })}
                {!col.length && <p className="col-empty">{filtered ? 'Nada con estos filtros' : 'Sin tareas'}</p>}
              </div>
              {canEdit && (adding === st ? (
                <form className="col-add" onSubmit={(e) => { e.preventDefault(); add(st); }}>
                  <textarea autoFocus className="inp" rows={2} placeholder="Título de la tarea" value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(st); } if (e.key === 'Escape') setAdding(null); }} />
                  <div className="inline"><button className="pill mini solid" type="submit" disabled={pending}>Crear</button><button type="button" className="link" onClick={() => setAdding(null)}>Cancelar</button></div>
                </form>
              ) : (
                <button className="col-new" onClick={() => { setAdding(st); setDraft(''); }}>+ Agregar tarea</button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="note">Arrastra una tarjeta para cambiar su estado. En el campo de nueva tarea, Enter crea y Esc cancela.</p>
    </>
  );
}
