import Link from 'next/link';
import { getContext } from '@/lib/data';
import { addDays, fmtDate, isoWeekday, todayISO } from '@/lib/format';
import { completeGoal, createGoal, deleteGoal, linkGoalHabits, setGoalProgress, updateGoal } from '@/lib/personal-actions';
import { createTask } from '@/lib/task-actions';
import { LIST_COLORS, daysLeft, dueLabel, type Task } from '@/lib/tasks';
import { type Habit, isDue } from '@/lib/habits';
import { TaskCheck } from '@/components/task-bits';
import { ViewHead } from '@/components/bits';

export const metadata = { title: 'Metas' };

type Goal = { id: string; title: string; why: string; target_date: string | null; measure: 'tasks' | 'number'; target: number | null; current: number; unit: string; color: string; done_at: string | null };

const fmtN = (n: number) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 });

function GoalForm({ g, action, submit }: { g?: Goal; action: (f: FormData) => void; submit: string }) {
  return (
    <form className="form" action={action}>
      {g && <input type="hidden" name="id" value={g.id} />}
      <label className="field">Meta<input name="title" required maxLength={200} defaultValue={g?.title} placeholder="Ej.: Aprobar Bases de Datos o Ahorrar 2 millones" /></label>
      <label className="field">Por qué la quieres (opcional)<input name="why" defaultValue={g?.why} /></label>
      <div className="two">
        <label className="field">Para cuándo<input type="date" name="date" defaultValue={g?.target_date ?? ''} /></label>
        <label className="field">Color<select name="color" defaultValue={g?.color ?? LIST_COLORS[0]}>{LIST_COLORS.map((c, i) => <option key={c} value={c}>Color {i + 1}</option>)}</select></label>
      </div>
      <fieldset className="field" style={{ border: 0 }}>
        <legend style={{ marginBottom: 6 }}>Cómo se mide el avance</legend>
        <label className="tk-inline"><input type="radio" name="measure" value="tasks" defaultChecked={(g?.measure ?? 'tasks') === 'tasks'} />Con las tareas de la meta (avanza al terminarlas)</label>
        <label className="tk-inline"><input type="radio" name="measure" value="number" defaultChecked={g?.measure === 'number'} />Con un número (ej. ahorrar, kilómetros, páginas)</label>
      </fieldset>
      <div className="two">
        <label className="field">Llegar a (si es con número)<input name="target" inputMode="decimal" defaultValue={g?.target ?? ''} placeholder="2000000" /></label>
        <label className="field">Unidad<input name="unit" maxLength={30} defaultValue={g?.unit} placeholder="pesos, km, páginas" /></label>
      </div>
      <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>{submit}</button>
    </form>
  );
}

export default async function Goals({ searchParams }: { searchParams: Promise<{ m?: string; nueva?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await getContext();
  const today = todayISO();
  const monday = addDays(today, 1 - isoWeekday(today));
  const [{ data: gs }, { data: ts }, { data: hs }, { data: cs }] = await Promise.all([
    supabase.from('goals').select('*').eq('user_id', user.id).order('done_at', { nullsFirst: true }).order('target_date', { nullsFirst: false }),
    supabase.from('tasks').select('*').eq('user_id', user.id).not('goal_id', 'is', null),
    supabase.from('habits').select('*').eq('user_id', user.id).is('archived_at', null),
    supabase.from('habit_checks').select('habit_id, day').eq('user_id', user.id).gte('day', monday),
  ]);
  const goals = (gs ?? []) as Goal[];
  const tasks = (ts ?? []) as (Task & { goal_id: string })[];
  const habits = (hs ?? []) as (Habit & { goal_id: string | null })[];
  const pct = (g: Goal) => {
    if (g.done_at) return 100;
    if (g.measure === 'number') return g.target ? Math.min(100, Math.round((Number(g.current) / Number(g.target)) * 100)) : 0;
    const its = tasks.filter((t) => t.goal_id === g.id);
    return its.length ? Math.round((its.filter((t) => t.done_at).length / its.length) * 100) : 0;
  };
  const sel = goals.find((g) => g.id === sp.m);
  const active = goals.filter((g) => !g.done_at);

  return (
    <>
      <ViewHead label="Lo que quieres lograr" title="Metas" text="Cada meta con su fecha y su avance, y las tareas y hábitos que la empujan.">
        <Link className="pill solid" href="/metas?nueva=1"><span className="pill__dot" />Nueva meta</Link>
      </ViewHead>
      {sp.ok && <p className="ok-msg" role="status">{sp.ok}</p>}
      {sp.error && <p className="err" role="alert">{sp.error}</p>}

      {(sp.nueva || !goals.length) && !sel && (
        <section className="panel"><div className="panel-head"><h2>Nueva meta</h2>{sp.nueva && <Link className="link" href="/metas">Cerrar</Link>}</div><GoalForm action={createGoal} submit="Crear meta" /></section>
      )}

      {sel && (() => {
        const its = tasks.filter((t) => t.goal_id === sel.id).sort((a, b) => (a.done_at ? 1 : 0) - (b.done_at ? 1 : 0) || (a.due_date ?? '9').localeCompare(b.due_date ?? '9'));
        const linked = habits.filter((h) => h.goal_id === sel.id);
        const p = pct(sel);
        const left = sel.target_date ? daysLeft(sel.target_date) : null;
        return (
          <section className="panel gl-detail" style={{ ['--gc' as string]: sel.color }}>
            <div className="panel-head">
              <div><h2>{sel.title}</h2>{sel.why && <p className="muted" style={{ fontSize: 13.5 }}>{sel.why}</p>}</div>
              <Link className="link" href="/metas">Cerrar</Link>
            </div>
            <div className="gl-progress">
              <div className="bar big"><i style={{ width: Math.max(p, 2) + '%', background: sel.color }} /></div>
              <b className="num">{p}%</b>
            </div>
            <p className="note">
              {sel.measure === 'number' ? `${fmtN(sel.current)} de ${fmtN(sel.target ?? 0)} ${sel.unit}` : `${its.filter((t) => t.done_at).length} de ${its.length} tareas hechas`}
              {sel.target_date ? ` · ${left !== null && left < 0 && !sel.done_at ? `venció hace ${-left} días` : `para el ${fmtDate(sel.target_date)}${left !== null && !sel.done_at ? ` (faltan ${left} días)` : ''}`}` : ''}
            </p>
            {sel.measure === 'number' && !sel.done_at && (
              <form className="inline" action={setGoalProgress}>
                <input type="hidden" name="id" value={sel.id} />
                <input className="inp" name="add" inputMode="decimal" placeholder={`Sumar ${sel.unit || 'avance'}`} aria-label="Cuánto sumar" />
                <button className="pill mini" type="submit">Sumar</button>
              </form>
            )}
            <div className="grid g-2">
              <div>
                <h3 className="gl-h">Tareas de esta meta</h3>
                <div className="tk-rows">{its.map((t) => { const d = dueLabel(t); return (
                  <div className={'tk-row' + (t.done_at ? ' done' : '')} key={t.id}><TaskCheck id={t.id} done={!!t.done_at} color={sel.color} /><Link className="tk-main" href={`/tareas?t=${t.id}`}><b>{t.title}</b></Link><span className={'tag ' + d.tone}>{d.text}</span></div>
                ); })}</div>
                <form className="inline" action={createTask} style={{ marginTop: 8 }}>
                  <input type="hidden" name="from" value={`/metas?m=${sel.id}`} />
                  <input type="hidden" name="goal" value={sel.id} />
                  <input className="inp" name="title" required placeholder="Agregar una tarea a la meta" aria-label="Nueva tarea de la meta" />
                  <input className="inp sm" type="date" name="due" aria-label="Plazo" />
                  <button className="pill mini" type="submit">Agregar</button>
                </form>
              </div>
              <div>
                <h3 className="gl-h">Hábitos que la empujan</h3>
                {linked.length ? linked.map((h) => {
                  const due = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => d <= today && isDue(h, d));
                  const got = due.filter((d) => (cs ?? []).some((c) => c.habit_id === h.id && c.day === d)).length;
                  return <div className="row" key={h.id}><span className="dot" style={{ width: 8, height: 8, borderRadius: '50%', background: h.color }} /><div className="t"><b>{h.title}</b><span>Esta semana {got} de {due.length}</span></div><span /></div>;
                }) : <p className="muted" style={{ fontSize: 13.5 }}>Ninguno todavía.</p>}
                {habits.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary className="link">Elegir hábitos</summary>
                    <form className="form" action={linkGoalHabits} style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={sel.id} />
                      {habits.map((h) => <label key={h.id} className="tk-inline"><input type="checkbox" name="habit" value={h.id} defaultChecked={h.goal_id === sel.id} />{h.title}</label>)}
                      <button className="pill mini" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar</button>
                    </form>
                  </details>
                )}
              </div>
            </div>
            <details>
              <summary className="link">Editar meta</summary>
              <div style={{ marginTop: 10 }}><GoalForm g={sel} action={updateGoal} submit="Guardar" /></div>
            </details>
            <div className="inline">
              <form action={completeGoal}><input type="hidden" name="id" value={sel.id} /><input type="hidden" name="done" value={sel.done_at ? '0' : '1'} /><button className="pill mini" type="submit">{sel.done_at ? 'Reabrir' : 'Marcar como cumplida'}</button></form>
              <form action={deleteGoal}><input type="hidden" name="id" value={sel.id} /><button className="pill mini danger" type="submit">Eliminar meta</button></form>
            </div>
          </section>
        );
      })()}

      {goals.length > 0 && (
        <div className="gl-grid">
          {goals.map((g) => {
            const p = pct(g);
            const left = g.target_date ? daysLeft(g.target_date) : null;
            return (
              <Link key={g.id} href={`/metas?m=${g.id}`} className={'gl-card' + (g.done_at ? ' done' : '') + (g.id === sel?.id ? ' on' : '')} style={{ ['--gc' as string]: g.color }}>
                <div className="gl-top"><b>{g.title}</b>{g.done_at ? <span className="tag ok">Cumplida</span> : left !== null ? <span className={'tag ' + (left < 0 ? 'bad' : left <= 14 ? 'warn' : '')}>{left < 0 ? 'Vencida' : `${left} días`}</span> : null}</div>
                <div className="bar"><i style={{ width: Math.max(p, 2) + '%', background: g.color }} /></div>
                <span className="note">{p}% · {g.measure === 'number' ? `${fmtN(g.current)} de ${fmtN(g.target ?? 0)} ${g.unit}` : `${tasks.filter((t) => t.goal_id === g.id && t.done_at).length} de ${tasks.filter((t) => t.goal_id === g.id).length} tareas`}</span>
              </Link>
            );
          })}
        </div>
      )}
      {goals.length > 0 && !active.length && <p className="muted">Cumpliste todas tus metas. Crea la siguiente.</p>}
    </>
  );
}
