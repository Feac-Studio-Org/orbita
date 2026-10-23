import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContext } from '@/lib/data';
import { STATUS, addDays, isLate, todayISO } from '@/lib/format';
import { IssueRow, ViewHead } from '@/components/bits';

export const metadata = { title: 'Portafolio' };
const COLORS: Record<string, string> = { done: '#4cc38a', review: '#cfaf6e', progress: '#c77dff', todo: 'rgba(244,242,247,.22)' };

export default async function Portfolio({ params }: { params: Promise<{ space: string }> }) {
  const { space: id } = await params;
  const { supabase, spaces } = await getContext();
  const space = spaces.find((s) => s.id === id);
  if (!space) notFound();
  const ids = space.projects.map((p) => p.id);
  const { data } = ids.length ? await supabase.from('issues').select('key, title, status, priority, due_date, project_id').in('project_id', ids) : { data: [] };
  const all = data ?? [];
  const open = all.filter((i) => i.status !== 'done');
  const late = all.filter((i) => isLate(i.due_date, i.status));
  const week = open.filter((i) => i.due_date && !isLate(i.due_date, i.status) && i.due_date <= addDays(todayISO(), 7));
  const max = Math.max(1, ...space.projects.map((p) => all.filter((i) => i.project_id === p.id).length));
  const name = (pid: string) => space.projects.find((p) => p.id === pid)?.name;

  return (
    <>
      <ViewHead label={space.name} title="Porta" accent="folio" text="Todos los proyectos del espacio: carga, avance, vencimientos y lo atrasado." />
      <div className="stat-row">
        <div className="stat"><span className="label">Proyectos</span><b className="num">{space.projects.length}</b><span>en {space.name}</span></div>
        <div className="stat"><span className="label">Abiertas</span><b className="num">{open.length}</b><span>tareas</span></div>
        <div className="stat"><span className="label">Atrasadas</span><b className="num" style={{ color: late.length ? 'var(--bad)' : undefined }}>{late.length}</b><span>con fecha vencida</span></div>
        <div className="stat"><span className="label">En curso</span><b className="num">{all.filter((i) => i.status === 'progress').length}</b><span>ahora</span></div>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Tareas por proyecto</h2>
          <div className="legend">{Object.entries(COLORS).map(([k, c]) => <span key={k}><i style={{ background: c }} />{STATUS[k]}</span>)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {space.projects.map((p) => {
            const its = all.filter((i) => i.project_id === p.id);
            return (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 170px) minmax(0, 1fr) 32px', gap: 12, alignItems: 'center' }}>
                <Link href={`/p/${p.key}`} style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</Link>
                <div style={{ display: 'flex', height: 12, borderRadius: 4, overflow: 'hidden', background: 'var(--ink-3)' }}>
                  {['done', 'review', 'progress', 'todo'].map((s) => { const n = its.filter((i) => i.status === s).length; return n ? <i key={s} title={`${STATUS[s]}: ${n}`} style={{ width: (n / max) * 100 + '%', background: COLORS[s] }} /> : null; })}
                </div>
                <span className="num muted" style={{ textAlign: 'right' }}>{its.length}</span>
              </div>
            );
          })}
        </div>
      </section>
      <div className="grid g-2">
        <section className="panel"><div className="panel-head"><h2>Atrasadas</h2></div>{late.length ? <div className="list">{late.map((i) => <IssueRow key={i.key} issue={i} project={name(i.project_id)} />)}</div> : <p className="muted">Nada atrasado.</p>}</section>
        <section className="panel"><div className="panel-head"><h2>Vencen esta semana</h2></div>{week.length ? <div className="list">{week.map((i) => <IssueRow key={i.key} issue={i} project={name(i.project_id)} />)}</div> : <p className="muted">Nada vence en los próximos 7 días.</p>}</section>
      </div>
    </>
  );
}
