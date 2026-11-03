import Link from 'next/link';
import { cookies } from 'next/headers';
import { ProjectMark } from '@/components/project-mark';
import { getContext } from '@/lib/data';
import { DAYS, MES, addDays, hhmm, isLate, isoWeekday, todayISO } from '@/lib/format';
import { IssueRow, Empty } from '@/components/bits';
import { redirect } from 'next/navigation';
import { dueLabel, type Task, type TaskList } from '@/lib/tasks';
import { QuickTask, TaskCheck } from '@/components/task-bits';
import { HabitToggle } from '@/components/habit-toggle';
import { type Habit, isDue } from '@/lib/habits';

export const metadata = { title: 'Inicio' };

const TAGS: Record<string, string> = { UV: 'bad', UAO: 'warn', Estudio: 'v', Sistema: 'ok' };

export default async function Home() {
  const { supabase, profile, user, projects, spaces, modules } = await getContext();
  if (!(profile?.preferences as { onboarded?: boolean } | null)?.onboarded) redirect('/empezar');
  const today = todayISO();
  const wd = isoWeekday(today);
  const [{ data: blocks }, { data: issues }, { data: activity }, { data: taskRows }, { data: habitRows }, { data: hchecks }] = await Promise.all([
    supabase.from('schedule_blocks').select('title, tag, kind, weekdays, start_time, end_time, starts_on, ends_on').contains('weekdays', [wd]).order('start_time'),
    modules.projects ? supabase.from('issues').select('key, title, status, priority, due_date, project_id').neq('status', 'done') : Promise.resolve({ data: [] as never[] }),
    modules.assistant ? supabase.from('activity_log').select('summary, actor_kind, created_at').order('created_at', { ascending: false }).limit(4) : Promise.resolve({ data: [] as never[] }),
    modules.tasks ? supabase.from('tasks').select('*').eq('user_id', user.id).is('done_at', null).lte('due_date', addDays(today, 7)).order('due_date').limit(12) : Promise.resolve({ data: [] as never[] }),
    modules.habits ? supabase.from('habits').select('*').eq('user_id', user.id).is('archived_at', null).order('at_time') : Promise.resolve({ data: [] as never[] }),
    modules.habits ? supabase.from('habit_checks').select('habit_id, day').eq('user_id', user.id).eq('day', today) : Promise.resolve({ data: [] as never[] }),
  ]);
  const { data: listRows } = modules.tasks ? await supabase.from('task_lists').select('id, name, color, position').eq('user_id', user.id).order('position') : { data: [] };
  const taskLists = (listRows ?? []) as TaskList[];
  const savedList = (await cookies()).get('tk_lista')?.value;
  const lastList = taskLists.find((l) => l.id === savedList)?.id ?? null;
  const [{ data: goalRows }, { data: goalTasks }] = await Promise.all([
    modules.goals ? supabase.from('goals').select('id, title, color, measure, current, target, target_date').eq('user_id', user.id).is('done_at', null).order('target_date', { nullsFirst: false }).limit(4) : Promise.resolve({ data: [] as never[] }),
    modules.goals ? supabase.from('tasks').select('goal_id, done_at').eq('user_id', user.id).not('goal_id', 'is', null) : Promise.resolve({ data: [] as never[] }),
  ]);
  const goalPct = (g: { id: string; measure: string; current: number; target: number | null }) => {
    if (g.measure === 'number') return g.target ? Math.min(100, Math.round((Number(g.current) / Number(g.target)) * 100)) : 0;
    const its = (goalTasks ?? []).filter((t: { goal_id: string }) => t.goal_id === g.id);
    return its.length ? Math.round((its.filter((t: { done_at: string | null }) => t.done_at).length / its.length) * 100) : 0;
  };
  const myTasks = (taskRows ?? []) as Task[];
  const lateTasks = myTasks.filter((t) => t.due_date! < today);
  const habitsToday = ((habitRows ?? []) as Habit[]).filter((h) => isDue(h, today));
  const habitDone = (id: string) => (hchecks ?? []).some((c: { habit_id: string }) => c.habit_id === id);
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
          <p>{modules.projects ? 'Tu día y tus proyectos en una sola pantalla.' : 'Lo que tienes para hoy, en una sola pantalla.'}</p>
        </div>
        {modules.tasks ? <Link className="pill solid" href="/tareas?nueva=1"><span className="pill__dot" />Nueva tarea</Link> : modules.projects ? <Link className="pill solid" href="/nuevo/tarea"><span className="pill__dot" />Nueva tarea</Link> : null}
      </div>

      <div className="stat-row auto">
        {modules.tasks && <div className="stat"><span className="label">Tareas</span><b className="num" style={{ color: lateTasks.length ? 'var(--bad)' : undefined }}>{myTasks.filter((t) => t.due_date! <= today).length}</b><span>{lateTasks.length ? `${lateTasks.length} vencidas` : 'para hoy'}</span></div>}
        {modules.habits && <div className="stat"><span className="label">Hábitos</span><b className="num">{habitsToday.filter((h) => habitDone(h.id)).length}/{habitsToday.length}</b><span>cumplidos hoy</span></div>}
        {modules.projects && <div className="stat"><span className="label">En proyectos</span><b className="num">{open.length}</b><span>{late.length ? `${late.length} atrasadas` : `en ${projects.length} proyectos`}</span></div>}
        <div className="stat"><span className="label">Hoy</span><b className="num">{todayBlocks.length}</b><span>bloques en tu horario</span></div>
      </div>

      {(modules.tasks || modules.habits) && (
        <div className="grid g-2">
          {modules.tasks && (
            <section className="panel">
              <div className="panel-head"><h2>Tareas</h2><Link className="link" href="/tareas">Ver todas</Link></div>
              <QuickTask lists={taskLists} list={lastList} />
              {myTasks.length ? (
                <div className="tk-rows">{myTasks.map((t) => { const d = dueLabel(t); return (
                  <div className="tk-row" key={t.id}><TaskCheck id={t.id} done={false} /><Link className="tk-main" href={`/tareas?t=${t.id}`}><b>{t.title}</b></Link><span className={'tag ' + d.tone}>{d.text}</span></div>
                ); })}</div>
              ) : <p className="muted">Nada que venza esta semana.</p>}
            </section>
          )}
          {modules.habits && (
            <section className="panel today-track">
              <div className="panel-head"><h2>Hábitos de hoy</h2><Link className="link" href="/habitos">Ver semana</Link></div>
              {habitsToday.length ? (
                <div className="ht-grid">{habitsToday.map((h) => <HabitToggle key={h.id} habit={h.id} day={today} done={habitDone(h.id)} title={h.title} sub={h.at_time ? hhmm(h.at_time) : 'Hábito'} color={h.color} icon={h.icon} />)}</div>
              ) : <Empty action={<Link className="pill mini" href="/habitos">Crear un hábito</Link>}>Hoy no te toca ningún hábito.</Empty>}
            </section>
          )}
        </div>
      )}

      <div className={'grid ' + (modules.projects ? 'g-home' : '')}>
        {(modules.calendar || todayBlocks.length > 0) && <section className="panel">
          <div className="panel-head"><h2>Horario de hoy</h2>{modules.calendar && <Link className="link" href="/calendario">Ver semana</Link>}</div>
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
        </section>}
        {modules.projects && <section className="panel">
          <div className="panel-head"><h2>Vence pronto</h2><span className="label">Próximas 2 semanas</span></div>
          {due.length ? <div className="list">{due.map((i) => <IssueRow key={i.key} issue={i} project={projName(i.project_id)} />)}</div> : <p className="muted">Nada con fecha cercana.</p>}
        </section>}
      </div>

      {modules.goals && (goalRows ?? []).length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Metas</h2><Link className="link" href="/metas">Ver todas</Link></div>
          <div className="gl-grid">{(goalRows ?? []).map((g: { id: string; title: string; color: string; measure: string; current: number; target: number | null }) => { const p = goalPct(g); return (
            <Link key={g.id} href={`/metas?m=${g.id}`} className="gl-card" style={{ ['--gc' as string]: g.color }}><b style={{ fontWeight: 500 }}>{g.title}</b><div className="bar"><i style={{ width: Math.max(p, 2) + '%', background: g.color }} /></div><span className="note">{p}%</span></Link>
          ); })}</div>
        </section>
      )}

      {modules.projects && <section className="panel">
        <div className="panel-head"><h2>Proyectos</h2><span className="label">{spaces.filter((s) => s.projects.length).map((s) => s.name).join(' · ')}</span></div>
        {projects.length ? (
          <div className="projects">
            {projects.map((p) => {
              const pr = prog(p.id);
              return (
                <Link key={p.key} href={`/p/${p.key}`} className="proj">
                  <div className="proj-top">
                    <ProjectMark p={p} size={34} />
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
      </section>}

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
