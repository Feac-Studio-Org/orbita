import Link from 'next/link';
import { getContext } from '@/lib/data';
import { DAYS, addDays, fmtDate, isoWeekday, todayISO } from '@/lib/format';
import { RANGES, bogotaDay, daysBetween, pct, resolveRange } from '@/lib/review';
import { type Habit, isDue } from '@/lib/habits';
import { daysLeft } from '@/lib/tasks';
import { TaskCheck } from '@/components/task-bits';
import { ViewHead } from '@/components/bits';

export const metadata = { title: 'Revisión' };

type T = { id: string; title: string; due_date: string | null; done_at: string | null; goal_id: string | null };
type Block = { id: string; title: string; weekdays: number[]; starts_on: string | null; ends_on: string | null; start_time: string };

/** Revisión estricta: lo programado contra lo cumplido, en el rango que se elija. */
export default async function Review({ searchParams }: { searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, modules } = await getContext();
  const today = todayISO();
  const { from, to, key } = resolveRange(sp.rango, sp.desde, sp.hasta);
  const days = daysBetween(from, to);
  const fromTs = addDays(from, 0) + 'T05:00:00Z', toTs = addDays(to, 1) + 'T05:00:00Z';

  const [{ data: due }, { data: doneIn }, { data: hs }, { data: hc }, { data: bs }, { data: bc }, { data: gs }, { data: gt }] = await Promise.all([
    supabase.from('tasks').select('id, title, due_date, done_at, goal_id').eq('user_id', user.id).gte('due_date', from).lte('due_date', to),
    supabase.from('tasks').select('id, title, due_date, done_at, goal_id').eq('user_id', user.id).gte('done_at', fromTs).lt('done_at', toTs),
    supabase.from('habits').select('*').eq('user_id', user.id).is('archived_at', null),
    supabase.from('habit_checks').select('habit_id, day').eq('user_id', user.id).gte('day', from).lte('day', to),
    supabase.from('schedule_blocks').select('id, title, weekdays, starts_on, ends_on, start_time'),
    supabase.from('block_checks').select('block_id, day').eq('user_id', user.id).gte('day', from).lte('day', to),
    modules.goals ? supabase.from('goals').select('id, title, color, measure, current, target, target_date, created_at, done_at').eq('user_id', user.id).is('done_at', null) : Promise.resolve({ data: [] as never[] }),
    modules.goals ? supabase.from('tasks').select('goal_id, done_at').eq('user_id', user.id).not('goal_id', 'is', null) : Promise.resolve({ data: [] as never[] }),
  ]);
  const dueTasks = (due ?? []) as T[];
  const finished = (doneIn ?? []) as T[];
  const habits = (hs ?? []) as Habit[];
  const blocks = (bs ?? []) as Block[];
  const hDone = new Set((hc ?? []).map((c) => c.habit_id + c.day));
  const bDone = new Set((bc ?? []).map((c) => c.block_id + c.day));
  const live = (b: Block, d: string) => b.weekdays.includes(isoWeekday(d)) && (!b.ends_on || b.ends_on >= d) && (!b.starts_on || b.starts_on <= d);
  // Como en el calendario: un bloque a la misma hora que un hábito de ese día se cuenta una sola vez.
  const twin = (b: Block, d: string) => habits.some((h) => isDue(h, d) && h.at_time && h.at_time.slice(0, 5) === String(b.start_time).slice(0, 5));

  const perDay = days.map((d) => {
    const tDue = dueTasks.filter((t) => t.due_date === d);
    const tOk = tDue.filter((t) => t.done_at && bogotaDay(t.done_at) <= d).length;
    const hDue = habits.filter((h) => isDue(h, d));
    const hOk = hDue.filter((h) => hDone.has(h.id + d)).length;
    const bDue = blocks.filter((b) => live(b, d) && !twin(b, d));
    const bOk = bDue.filter((b) => bDone.has(b.id + d)).length;
    const total = tDue.length + hDue.length + bDue.length, got = tOk + hOk + bOk;
    return { d, t: [tOk, tDue.length], h: [hOk, hDue.length], b: [bOk, bDue.length], done: finished.filter((t) => bogotaDay(t.done_at!) === d).length, total, got };
  });
  const sum = (k: 't' | 'h' | 'b', i: 0 | 1) => perDay.reduce((a, x) => a + x[k][i], 0);
  const T_ok = sum('t', 0), T_due = sum('t', 1), H_ok = sum('h', 0), H_due = sum('h', 1), B_ok = sum('b', 0), B_due = sum('b', 1);
  const late = dueTasks.filter((t) => t.done_at && bogotaDay(t.done_at) > t.due_date!);
  const missed = dueTasks.filter((t) => !t.done_at && t.due_date! < today);
  const global = pct(T_ok + H_ok + B_ok, T_due + H_due + B_due);
  const habitRows = habits.map((h) => { const dd = days.filter((d) => isDue(h, d)); return { h, due: dd.length, ok: dd.filter((d) => hDone.has(h.id + d)).length }; }).filter((x) => x.due).sort((a, b) => a.ok / a.due - b.ok / b.due);
  const goalRows = (gs ?? []).map((g: { id: string; title: string; color: string; measure: string; current: number; target: number | null; target_date: string | null; created_at: string }) => {
    const its = (gt ?? []).filter((t: { goal_id: string }) => t.goal_id === g.id);
    const p = g.measure === 'number' ? (g.target ? Math.min(100, Math.round((Number(g.current) / Number(g.target)) * 100)) : 0) : its.length ? Math.round((its.filter((t: { done_at: string | null }) => t.done_at).length / its.length) * 100) : 0;
    // Ritmo esperado: qué parte del tiempo entre que se creó y la fecha límite ya pasó.
    const start = bogotaDay(g.created_at);
    const span = g.target_date ? Math.max(1, (new Date(g.target_date).getTime() - new Date(start).getTime()) / 864e5) : null;
    const expected = span ? Math.min(100, Math.round(((new Date(today).getTime() - new Date(start).getTime()) / 864e5 / span) * 100)) : null;
    return { g, p, expected, left: g.target_date ? daysLeft(g.target_date) : null };
  });
  const tone = (v: number | null) => (v === null ? '' : v >= 85 ? 'ok' : v >= 60 ? 'warn' : 'bad');
  const fmt = (a: number, b: number) => (b ? `${a}/${b}` : '—');
  const title = key === 'hoy' ? 'Hoy' : key === 'ayer' ? 'Ayer' : `${fmtDate(from)} – ${fmtDate(to)}`;

  return (
    <>
      <ViewHead label={`Revisión · ${days.length} ${days.length === 1 ? 'día' : 'días'}`} title={title} text="Lo programado contra lo cumplido: tareas con plazo, hábitos y bloques del horario." />
      <div className="rv-range">
        <nav className="seg" aria-label="Rango">{RANGES.map(([k, l]) => <Link key={k} href={`/revision?rango=${k}`} aria-current={key === k ? 'page' : undefined}>{l}</Link>)}</nav>
        <form className="inline" action="/revision">
          <input className="inp sm" type="date" name="desde" defaultValue={from} max={today} aria-label="Desde" />
          <input className="inp sm" type="date" name="hasta" defaultValue={to} max={today} aria-label="Hasta" />
          <button className="pill mini" type="submit">Ver rango</button>
        </form>
      </div>

      <div className="stat-row auto">
        <div className="stat"><span className="label">Cumplimiento</span><b className={'num rv-' + tone(global)}>{global === null ? '—' : global + '%'}</b><span>{T_ok + H_ok + B_ok} de {T_due + H_due + B_due} programados</span></div>
        <div className="stat"><span className="label">Tareas a tiempo</span><b className={'num rv-' + tone(pct(T_ok, T_due))}>{fmt(T_ok, T_due)}</b><span>{late.length} tarde · {missed.length} sin hacer</span></div>
        <div className="stat"><span className="label">Hábitos</span><b className={'num rv-' + tone(pct(H_ok, H_due))}>{fmt(H_ok, H_due)}</b><span>{pct(H_ok, H_due) ?? 0}%</span></div>
        <div className="stat"><span className="label">Horario</span><b className={'num rv-' + tone(pct(B_ok, B_due))}>{fmt(B_ok, B_due)}</b><span>bloques marcados</span></div>
        <div className="stat"><span className="label">Terminadas</span><b className="num">{finished.length}</b><span>tareas cerradas en el rango</span></div>
      </div>

      {days.length > 1 && (
        <section className="panel">
          <div className="panel-head"><h2>Por día</h2></div>
          <div className="rv-days">
            <div className="rv-row head"><span>Día</span><span>Tareas</span><span>Hábitos</span><span>Horario</span><span>Total</span></div>
            {[...perDay].reverse().map((x) => { const p = pct(x.got, x.total); return (
              <Link key={x.d} href={`/revision?desde=${x.d}&hasta=${x.d}`} className="rv-row">
                <span>{DAYS[isoWeekday(x.d) - 1].slice(0, 3)} {fmtDate(x.d)}</span>
                <span className="num">{fmt(x.t[0], x.t[1])}</span>
                <span className="num">{fmt(x.h[0], x.h[1])}</span>
                <span className="num">{fmt(x.b[0], x.b[1])}</span>
                <span className="rv-total"><i className="bar"><i style={{ width: `${p ?? 0}%`, background: p === null ? undefined : p >= 85 ? 'var(--ok)' : p >= 60 ? 'var(--warn)' : 'var(--bad)' }} /></i><b className="num">{p === null ? '—' : p + '%'}</b></span>
              </Link>
            ); })}
          </div>
        </section>
      )}

      <div className="grid g-2">
        <section className="panel">
          <div className="panel-head"><h2>Sin cumplir</h2><span className="label">{missed.length + late.length}</span></div>
          {missed.length + late.length ? (
            <div className="tk-rows">
              {missed.map((t) => <div className="tk-row" key={t.id}><TaskCheck id={t.id} done={false} /><Link className="tk-main" href={`/tareas?t=${t.id}`}><b>{t.title}</b></Link><span className="tag bad">Venció {fmtDate(t.due_date)}</span></div>)}
              {late.map((t) => <div className="tk-row done" key={t.id}><TaskCheck id={t.id} done /><span className="tk-main"><b>{t.title}</b></span><span className="tag warn">Tarde: {fmtDate(bogotaDay(t.done_at!))}</span></div>)}
            </div>
          ) : <p className="muted">Todo lo que tenía plazo en este rango se cumplió a tiempo.</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Hábitos</h2><span className="label">De menor a mayor cumplimiento</span></div>
          {habitRows.length ? habitRows.map(({ h, due: dd, ok }) => (
            <div key={h.id} className="rv-habit"><span>{h.title}</span><div className="bar"><i style={{ width: Math.max((ok / dd) * 100, 2) + '%', background: h.color }} /></div><span className="num muted">{ok}/{dd}</span></div>
          )) : <p className="muted">No había hábitos programados.</p>}
        </section>
      </div>

      {goalRows.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Metas</h2><span className="label">Avance contra el ritmo esperado</span></div>
          {goalRows.map(({ g, p, expected, left }) => (
            <Link key={g.id} href={`/metas?m=${g.id}`} className="rv-goal">
              <span>{g.title}</span>
              <div className="bar"><i style={{ width: Math.max(p, 2) + '%', background: g.color }} /></div>
              <span className="num">{p}%</span>
              <span className={'tag ' + (expected === null ? '' : p >= expected ? 'ok' : p >= expected - 15 ? 'warn' : 'bad')}>{expected === null ? 'Sin fecha' : p >= expected ? 'Al día' : `Atrasada (debería ir en ${expected}%)`}{left !== null ? ` · ${left < 0 ? 'vencida' : `${left} d`}` : ''}</span>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
