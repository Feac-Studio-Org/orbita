import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContext } from '@/lib/data';
import { MES, STATUS, addDays, isLate, money, todayISO } from '@/lib/format';
import { IssueRow, ViewHead } from '@/components/bits';
import { Columns, Donut, Lines, Ring, STATUS_COLOR, StackBars } from '@/components/charts';

export const metadata = { title: 'Portafolio' };
const ORDER = ['done', 'review', 'progress', 'todo'] as const;

/** Lunes de la semana de una fecha ISO (AAAA-MM-DD). */
function monday(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
}

export default async function Portfolio({ params }: { params: Promise<{ space: string }> }) {
  const { space: id } = await params;
  const { supabase, spaces, modules } = await getContext();
  const space = spaces.find((s) => s.id === id);
  if (!space) notFound();
  const ids = space.projects.map((p) => p.id);
  const showMoney = modules.finance && space.modules.finance !== false && ['owner', 'partner'].includes(space.role);
  const today = todayISO();
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(monday(today), -7 * (7 - i)));

  const { data } = ids.length ? await supabase.from('issues').select('id, key, title, status, priority, due_date, project_id, assignee_id, created_at').in('project_id', ids) : { data: [] };
  const all = data ?? [];
  const [{ data: closed }, { data: fin }] = await Promise.all([
    all.length ? supabase.from('issue_events').select('created_at, data').eq('kind', 'status').in('issue_id', all.map((i) => i.id)).gte('created_at', weeks[0]) : Promise.resolve({ data: [] }),
    showMoney ? supabase.from('finance_entries').select('amount, currency, period, status, occurred_on, created_at, project_id').eq('space_id', space.id) : Promise.resolve({ data: [] }),
  ]);
  const assignees = [...new Set(all.map((i) => i.assignee_id).filter(Boolean))] as string[];
  const { data: people } = assignees.length ? await supabase.from('profiles').select('id, full_name').in('id', assignees) : { data: [] };

  const open = all.filter((i) => i.status !== 'done');
  const done = all.length - open.length;
  const late = all.filter((i) => isLate(i.due_date, i.status));
  const week = open.filter((i) => i.due_date && !isLate(i.due_date, i.status) && i.due_date <= addDays(today, 7));
  const name = (pid: string) => space.projects.find((p) => p.id === pid)?.name;
  const parts = (list: typeof all) => ORDER.map((s) => ({ label: STATUS[s], value: list.filter((i) => i.status === s).length, color: STATUS_COLOR[s] }));

  // Tareas cerradas por semana (cada paso a Hecho cuenta una vez).
  const toDone = (closed ?? []).filter((e) => (e.data as { to?: string })?.to === 'done');
  const perWeek = weeks.map((w, i) => {
    const end = weeks[i + 1] ?? addDays(w, 7);
    const [, m, d] = w.split('-');
    return { label: `${Number(d)} ${MES[Number(m) - 1]}`, value: toDone.filter((e) => e.created_at.slice(0, 10) >= w && e.created_at.slice(0, 10) < end).length,
      created: all.filter((x) => x.created_at.slice(0, 10) >= w && x.created_at.slice(0, 10) < end).length };
  });
  // Vencimientos de las próximas 4 semanas, por semana.
  const nextWeeks = Array.from({ length: 4 }, (_, i) => addDays(monday(today), 7 * i));
  const dueWeeks = nextWeeks.map((w, i) => ({ label: i === 0 ? 'Esta' : i === 1 ? 'Próxima' : `En ${i} sem`, value: open.filter((x) => x.due_date && x.due_date >= w && x.due_date < addDays(w, 7)).length }));

  // Gasto por mes en pesos: pagos únicos en su mes, suscripciones mensuales cada mes desde que empezaron.
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - (5 - i)); return d.toISOString().slice(0, 7); });
  const cop = (fin ?? []).filter((f) => f.currency === 'COP' && f.status !== 'cancelled' && Number(f.amount) > 0);
  const usd = (fin ?? []).filter((f) => f.currency === 'USD' && f.status !== 'cancelled' && Number(f.amount) > 0);
  const perMonth = months.map((m) => {
    const v = cop.reduce((a, f) => {
      const start = (f.occurred_on ?? f.created_at).slice(0, 7);
      if (f.period === 'monthly') return a + (start <= m ? Number(f.amount) : 0);
      return a + (start === m ? Number(f.amount) : 0);
    }, 0);
    return { label: MES[Number(m.slice(5)) - 1], value: v };
  });
  const short = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.0', '')} M` : n >= 1e3 ? `${Math.round(n / 1e3)} mil` : String(n);
  const monthlyUsd = usd.filter((f) => f.period === 'monthly').reduce((a, f) => a + Number(f.amount), 0);

  const load = [...assignees.map((a) => ({ id: a, name: people?.find((p) => p.id === a)?.full_name || 'Sin nombre' })), { id: '', name: 'Sin asignar' }]
    .map((x) => ({ ...x, list: open.filter((i) => (i.assignee_id ?? '') === x.id) }))
    .filter((x) => x.list.length)
    .sort((a, b) => b.list.length - a.list.length);

  return (
    <>
      <ViewHead label={space.name} title="Porta" accent="folio" text="Todos los proyectos del espacio: avance, ritmo de trabajo, carga del equipo y gasto." />
      <div className="stat-row">
        <div className="stat"><span className="label">Avance total</span><b className="num">{all.length ? Math.round((done / all.length) * 100) : 0}%</b><span>{done} de {all.length} tareas en {space.projects.length} proyectos</span></div>
        <div className="stat"><span className="label">Abiertas</span><b className="num">{open.length}</b><span>{all.filter((i) => i.status === 'progress').length} en curso ahora</span></div>
        <div className="stat"><span className="label">Atrasadas</span><b className="num" style={{ color: late.length ? 'var(--bad)' : undefined }}>{late.length}</b><span>con fecha vencida</span></div>
        <div className="stat"><span className="label">Cerradas en 8 semanas</span><b className="num">{toDone.length}</b><span>{(toDone.length / 8).toFixed(1).replace('.0', '')} por semana en promedio</span></div>
      </div>

      <div className="proj-cards">
        {space.projects.map((p) => {
          const its = all.filter((i) => i.project_id === p.id);
          const d = its.filter((i) => i.status === 'done').length;
          const pl = its.filter((i) => isLate(i.due_date, i.status)).length;
          const prog = its.filter((i) => i.status === 'progress' || i.status === 'review').length;
          return (
            <Link key={p.id} href={`/p/${p.key}`} className="proj-card" style={{ ['--pc' as string]: p.color }}>
              <Ring pct={its.length ? Math.round((d / its.length) * 100) : 0} color={p.color} />
              <div className="pc-body">
                <b>{p.name}</b><span className="key">{p.key} · {p.status_label}</span>
                <div className="pc-nums"><span><b className="num">{its.length - d}</b> abiertas</span><span><b className="num">{prog}</b> en curso</span><span className={pl ? 'bad' : ''}><b className="num">{pl}</b> atrasadas</span></div>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Avance por proyecto</h2>
          <div className="legend">{ORDER.map((k) => <span key={k}><i style={{ background: STATUS_COLOR[k] }} />{STATUS[k]}</span>)}</div>
        </div>
        <StackBars rows={space.projects.map((p) => {
          const its = all.filter((i) => i.project_id === p.id);
          const d = its.filter((i) => i.status === 'done').length;
          return { label: <Link href={`/p/${p.key}`}>{p.name}</Link>, parts: parts(its), right: its.length ? `${Math.round((d / its.length) * 100)}%` : '—' };
        })} />
      </section>

      <div className="grid g-2">
        <section className="panel">
          <div className="panel-head"><h2>Ritmo de trabajo</h2><span className="label">Últimas 8 semanas</span></div>
          <Lines labels={perWeek.map((w) => w.label)} series={[{ name: 'Creadas', color: '#5fa8f5', values: perWeek.map((w) => w.created) }, { name: 'Cerradas', color: '#4cc38a', values: perWeek.map((w) => w.value) }]} />
          <p className="note">Si las creadas superan a las cerradas, el trabajo pendiente está creciendo.</p>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Estado del espacio</h2><span className="label">{all.length} tareas</span></div>
          <Donut data={parts(all)} center={String(open.length)} sub="abiertas" />
          <div className="panel-head" style={{ marginTop: 6 }}><h2>Vencen por semana</h2><span className="label">Próximas 4</span></div>
          <Columns points={dueWeeks} height={120} />
        </section>
      </div>

      <div className="grid g-2">
        <section className="panel">
          <div className="panel-head"><h2>Carga por responsable</h2><span className="label">Tareas abiertas</span></div>
          {load.length ? <StackBars rows={load.map((x) => ({ label: x.name, parts: parts(x.list).filter((p) => p.label !== STATUS.done), right: x.list.length }))} /> : <p className="muted">No hay tareas abiertas.</p>}
        </section>
        {showMoney ? (
          <section className="panel">
            <div className="panel-head"><h2>Gasto por mes</h2><span className="label">Pesos · últimos 6 meses</span></div>
            <Columns points={perMonth} format={short} />
            <p className="note">Este mes: {money(perMonth.at(-1)?.value ?? 0, 'COP')}{monthlyUsd ? ` · además ${money(monthlyUsd, 'USD')} al mes en dólares` : ''}. <Link className="link" href="/finanzas">Ver finanzas</Link></p>
          </section>
        ) : (
          <section className="panel"><div className="panel-head"><h2>Vencen esta semana</h2></div>{week.length ? <div className="list">{week.map((i) => <IssueRow key={i.key} issue={i} project={name(i.project_id)} />)}</div> : <p className="muted">Nada vence en los próximos 7 días.</p>}</section>
        )}
      </div>

      <div className={'grid' + (showMoney ? ' g-2' : '')}>
        <section className="panel"><div className="panel-head"><h2>Atrasadas</h2></div>{late.length ? <div className="list">{late.map((i) => <IssueRow key={i.key} issue={i} project={name(i.project_id)} />)}</div> : <p className="muted">Nada atrasado.</p>}</section>
        {showMoney && <section className="panel"><div className="panel-head"><h2>Vencen esta semana</h2></div>{week.length ? <div className="list">{week.map((i) => <IssueRow key={i.key} issue={i} project={name(i.project_id)} />)}</div> : <p className="muted">Nada vence en los próximos 7 días.</p>}</section>}
      </div>
    </>
  );
}
