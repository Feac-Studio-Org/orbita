import Link from 'next/link';
import { getContext } from '@/lib/data';
import { DAYS, MES, addDays, hhmm, isLate, isoWeekday, todayISO } from '@/lib/format';
import { IssueRow, Empty } from '@/components/bits';

export const metadata = { title: 'Inicio' };

const TAGS: Record<string, string> = { UV: 'bad', UAO: 'warn', Estudio: 'v', Sistema: 'ok' };

export default async function Home() {
  const { supabase, profile, user, projects, spaces, modules } = await getContext();
  const today = todayISO();
  const wd = isoWeekday(today);
  const [{ data: blocks }, { data: issues }, { data: activity }] = await Promise.all([
    supabase.from('schedule_blocks').select('title, tag, kind, weekdays, start_time, end_time, starts_on, ends_on').contains('weekdays', [wd]).order('start_time'),
    supabase.from('issues').select('key, title, status, priority, due_date, project_id').neq('status', 'done'),
    supabase.from('activity_log').select('summary, actor_kind, created_at').order('created_at', { ascending: false }).limit(4),
  ]);
  const todayBlocks = (blocks ?? []).filter((b) => (!b.ends_on || b.ends_on >= today) && (!b.starts_on || b.starts_on <= today));
  const open = issues ?? [];
  const late = open.filter((i) => isLate(i.due_date, i.status));
  const due = open.filter((i) => i.due_date && i.due_date <= addDays(today, 14)).sort((a, b) => a.due_date!.localeCompare(b.due_date!)).slice(0, 7);
  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? '';
  const { data: counts } = await supabase.from('issues').select('project_id, status');
  const prog = (id: string) => {
    const all = (counts ?? []).filter((c) => c.project_id === id);
    return { total: all.length, pct: all.length ? Math.round((all.filter((c) => c.status === 'done').length / all.length) * 100) : 0 };
  };
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false }).format(new Date()));
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const first = (profile?.full_name || user.email || '').split(' ')[0];
  const [, m, d] = today.split('-');

  return (
    <>
      <div className="view-head">
        <div>
          <div className="label">{DAYS[wd - 1]} {+d} de {MES[+m - 1]}</div>
          <h1>{greet}, <span className="serif violet">{first}</span>.</h1>
          <p>Tu día y tus proyectos en una sola pantalla.</p>
        </div>
        <Link className="pill solid" href="/nuevo/tarea"><span className="pill__dot" />Nueva tarea</Link>
      </div>

      <div className="stat-row">
        <div className="stat"><span className="label">Tareas abiertas</span><b className="num">{open.length}</b><span>en {projects.length} proyectos</span></div>
        <div className="stat"><span className="label">Atrasadas</span><b className="num" style={{ color: late.length ? 'var(--bad)' : undefined }}>{late.length}</b><span>{late.length ? 'revísalas hoy' : 'todo al día'}</span></div>
        <div className="stat"><span className="label">Hoy</span><b className="num">{todayBlocks.length}</b><span>bloques en tu horario</span></div>
        <div className="stat"><span className="label">Espacios</span><b className="num">{spaces.length}</b><span>{spaces.map((s) => s.name).join(', ')}</span></div>
      </div>

      <div className="grid g-home">
        <section className="panel">
          <div className="panel-head"><h2>Hoy</h2>{modules.calendar && <Link className="link" href="/calendario">Ver semana</Link>}</div>
          {todayBlocks.length ? (
            <div className="timeline">
              {todayBlocks.map((b, i) => (
                <div className="tl-row" key={i}>
                  <div className="tl-time num">{hhmm(b.start_time)} – {hhmm(b.end_time)}</div>
                  <div className="tl-what"><b>{b.title}</b>{b.tag && <span className={'tag ' + (TAGS[b.tag] ?? '')}>{b.tag}</span>}</div>
                </div>
              ))}
            </div>
          ) : <p className="muted">Nada en tu horario para hoy.</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Vence pronto</h2><span className="label">Próximas 2 semanas</span></div>
          {due.length ? <div className="list">{due.map((i) => <IssueRow key={i.key} issue={i} project={projName(i.project_id)} />)}</div> : <p className="muted">Nada con fecha cercana.</p>}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Proyectos</h2><span className="label">{spaces.filter((s) => s.projects.length).map((s) => s.name).join(' · ')}</span></div>
        {projects.length ? (
          <div className="projects">
            {projects.map((p) => {
              const pr = prog(p.id);
              return (
                <Link key={p.key} href={`/p/${p.key}`} className="proj">
                  <div className="proj-top">
                    <span className="proj-mark" style={{ background: p.color + '22', color: p.color }}>{p.key.slice(0, 3)}</span>
                    <div style={{ minWidth: 0 }}><b>{p.name}</b><span>{p.description}</span></div>
                  </div>
                  <span className="tag v" style={{ alignSelf: 'flex-start' }}>{p.status_label}</span>
                  <div className="bar"><i style={{ width: Math.max(pr.pct, 3) + '%', background: p.color }} /></div>
                  <div className="proj-foot"><span className="num">{pr.pct}% hecho</span><span className="num">{pr.total} tareas</span></div>
                </Link>
              );
            })}
          </div>
        ) : <Empty action={<Link className="pill" href="/nuevo/espacio">Crear un espacio</Link>}>Todavía no tienes proyectos.</Empty>}
      </section>

      {modules.assistant && (
        <section className="panel">
          <div className="panel-head"><h2>Actividad reciente</h2><Link className="link" href="/asistente">Asistente</Link></div>
          {activity?.length ? (
            <div className="list">{activity.map((a, i) => (
              <div className="row" key={i}><span className="tag">{a.actor_kind === 'assistant' ? 'Asistente' : a.actor_kind === 'system' ? 'Sistema' : 'Tú'}</span><div className="t"><b>{a.summary}</b></div><span className="note num">{a.created_at.slice(0, 10)}</span></div>
            ))}</div>
          ) : <p className="muted">Sin actividad todavía.</p>}
        </section>
      )}
    </>
  );
}
