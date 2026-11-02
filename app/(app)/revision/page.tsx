import Link from 'next/link';
import { getContext } from '@/lib/data';
import { addDays, fmtDate, isoWeekday, todayISO } from '@/lib/format';
import { saveReview } from '@/lib/personal-actions';
import { dueLabel, type Task } from '@/lib/tasks';
import { type Habit, isDue } from '@/lib/habits';
import { MOODS } from '@/lib/personal';
import { TaskCheck } from '@/components/task-bits';
import { ViewHead } from '@/components/bits';

export const metadata = { title: 'Revisión semanal' };

/** Cierre de semana: qué hiciste, qué se quedó, cómo fueron tus hábitos y qué viene. */
export default async function Review({ searchParams }: { searchParams: Promise<{ semana?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await getContext();
  const today = todayISO();
  const thisMonday = addDays(today, 1 - isoWeekday(today));
  const monday = sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) && sp.semana <= thisMonday ? addDays(sp.semana, 1 - isoWeekday(sp.semana)) : thisMonday;
  const sunday = addDays(monday, 6);
  const nextEnd = addDays(sunday, 7);
  const end = sunday < today ? sunday : today;

  const [{ data: doneRows }, { data: openRows }, { data: hs }, { data: cs }, { data: js }, { data: gs }, { data: rv }, { data: past }] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', user.id).gte('done_at', monday + 'T05:00:00Z').lt('done_at', addDays(sunday, 1) + 'T05:00:00Z'),
    supabase.from('tasks').select('*').eq('user_id', user.id).is('done_at', null).lte('due_date', nextEnd).order('due_date'),
    supabase.from('habits').select('*').eq('user_id', user.id).is('archived_at', null),
    supabase.from('habit_checks').select('habit_id, day').eq('user_id', user.id).gte('day', monday).lte('day', sunday),
    supabase.from('journal').select('day, mood').eq('user_id', user.id).gte('day', monday).lte('day', sunday),
    supabase.from('goals').select('id, title, color, done_at, measure, current, target').eq('user_id', user.id).is('done_at', null),
    supabase.from('weekly_reviews').select('wins, blockers, focus').eq('user_id', user.id).eq('week_start', monday).maybeSingle(),
    supabase.from('weekly_reviews').select('week_start').eq('user_id', user.id).order('week_start', { ascending: false }).limit(8),
  ]);
  const done = (doneRows ?? []) as Task[];
  const open = (openRows ?? []) as Task[];
  const overdue = open.filter((t) => t.due_date! <= end && t.due_date! < today);
  const next = open.filter((t) => t.due_date! > end || t.due_date! >= today);
  const habits = (hs ?? []) as Habit[];
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => d <= end);
  const habitRows = habits.map((h) => {
    const due = days.filter((d) => isDue(h, d));
    const got = due.filter((d) => (cs ?? []).some((c) => c.habit_id === h.id && c.day === d)).length;
    return { h, due: due.length, got };
  }).filter((x) => x.due > 0);
  const hDue = habitRows.reduce((a, x) => a + x.due, 0), hGot = habitRows.reduce((a, x) => a + x.got, 0);
  const moods = (js ?? []).filter((j) => j.mood);
  const avg = moods.length ? Math.round(moods.reduce((a, j) => a + j.mood!, 0) / moods.length) : null;

  return (
    <>
      <ViewHead label={`Semana del ${fmtDate(monday)} al ${fmtDate(sunday)}`} title="Revisión" accent="semanal" text="Mira cómo te fue, cierra lo pendiente y decide en qué te enfocas la próxima semana.">
        <div className="inline">
          <Link className="pill mini" href={`/revision?semana=${addDays(monday, -7)}`}>Semana anterior</Link>
          {monday !== thisMonday && <Link className="pill mini" href="/revision">Esta semana</Link>}
        </div>
      </ViewHead>
      {sp.ok && <p className="ok-msg" role="status">{sp.ok}</p>}
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      <div className="stat-row auto">
        <div className="stat"><span className="label">Tareas hechas</span><b className="num">{done.length}</b><span>esta semana</span></div>
        <div className="stat"><span className="label">Se vencieron</span><b className="num" style={{ color: overdue.length ? 'var(--bad)' : undefined }}>{overdue.length}</b><span>{overdue.length ? 'decide qué hacer con ellas' : 'nada vencido'}</span></div>
        <div className="stat"><span className="label">Hábitos</span><b className="num">{hDue ? Math.round((hGot / hDue) * 100) : 0}%</b><span>{hGot} de {hDue} cumplidos</span></div>
        <div className="stat"><span className="label">Ánimo</span><b className="num">{avg ? MOODS[avg - 1][1] : '—'}</b><span>{moods.length ? `promedio de ${moods.length} días` : 'sin diario esta semana'}</span></div>
      </div>
      <div className="grid g-2">
        <section className="panel">
          <div className="panel-head"><h2>Lo que hiciste</h2></div>
          {done.length ? <div className="tk-rows">{done.map((t) => <div className="tk-row done" key={t.id}><TaskCheck id={t.id} done /><span className="tk-main"><b>{t.title}</b></span><span className="tag ok">Hecha</span></div>)}</div> : <p className="muted">Ninguna tarea terminada esta semana.</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Pendiente</h2><Link className="link" href="/tareas?vista=proximas">Reorganizar</Link></div>
          {overdue.length + next.length ? (
            <div className="tk-rows">{[...overdue, ...next].slice(0, 12).map((t) => { const d = dueLabel(t); return <div className="tk-row" key={t.id}><TaskCheck id={t.id} done={false} /><Link className="tk-main" href={`/tareas?t=${t.id}`}><b>{t.title}</b></Link><span className={'tag ' + d.tone}>{d.text}</span></div>; })}</div>
          ) : <p className="muted">Nada pendiente para la próxima semana.</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Hábitos</h2><Link className="link" href="/habitos">Ver</Link></div>
          {habitRows.length ? habitRows.map(({ h, due, got }) => (
            <div key={h.id} className="rv-habit"><span>{h.title}</span><div className="bar"><i style={{ width: Math.max((got / due) * 100, 2) + '%', background: h.color }} /></div><span className="num muted">{got}/{due}</span></div>
          )) : <p className="muted">Sin hábitos esta semana.</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Metas</h2><Link className="link" href="/metas">Ver</Link></div>
          {gs?.length ? <div className="list">{gs.map((g) => <Link className="row" key={g.id} href={`/metas?m=${g.id}`}><span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color }} /><div className="t"><b>{g.title}</b>{g.measure === 'number' && g.target ? <span>{Math.min(100, Math.round((Number(g.current) / Number(g.target)) * 100))}%</span> : null}</div><span className="link">Abrir</span></Link>)}</div> : <p className="muted">No tienes metas abiertas.</p>}
        </section>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Tu cierre</h2>{past?.length ? <div className="chips">{past.map((p) => <Link key={p.week_start} className="chip" href={`/revision?semana=${p.week_start}`} aria-current={p.week_start === monday ? 'page' : undefined}>{fmtDate(p.week_start)}</Link>)}</div> : null}</div>
        <form className="form" action={saveReview} key={monday}>
          <input type="hidden" name="week" value={monday} />
          <div className="grid g-3-form">
            <label className="field">Qué salió bien<textarea name="wins" rows={4} defaultValue={rv?.wins} /></label>
            <label className="field">Qué te frenó<textarea name="blockers" rows={4} defaultValue={rv?.blockers} /></label>
            <label className="field">En qué te enfocas la próxima semana<textarea name="focus" rows={4} defaultValue={rv?.focus} /></label>
          </div>
          <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar revisión</button>
        </form>
      </section>
    </>
  );
}
