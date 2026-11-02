import Link from 'next/link';
import { getContext } from '@/lib/data';
import { addDays, fmtDate, isoWeekday, todayISO } from '@/lib/format';
import { createList, createTask, deleteList, deleteTask, updateList, updateTask } from '@/lib/task-actions';
import { LIST_COLORS, TASK_REPEAT, dueLabel, remindText, type Task, type TaskList } from '@/lib/tasks';
import { StepCheck, TaskCheck, TaskForm } from '@/components/task-bits';
import { ViewHead } from '@/components/bits';

export const metadata = { title: 'Tareas' };

const VIEWS = [['hoy', 'Hoy'], ['proximas', 'Próximas'], ['lista', 'Listas'], ['hechas', 'Hechas']] as const;

export default async function Tasks({ searchParams }: { searchParams: Promise<{ vista?: string; lista?: string; t?: string; nueva?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await getContext();
  const today = todayISO();
  const [{ data: listRows }, { data: open }, { data: doneRows }] = await Promise.all([
    supabase.from('task_lists').select('id, name, color, position').eq('user_id', user.id).order('position'),
    supabase.from('tasks').select('*').eq('user_id', user.id).is('done_at', null).order('due_date', { nullsFirst: false }).order('created_at'),
    supabase.from('tasks').select('*').eq('user_id', user.id).not('done_at', 'is', null).order('done_at', { ascending: false }).limit(60),
  ]);
  const lists = (listRows ?? []) as TaskList[];
  const tasks = (open ?? []) as Task[];
  const done = (doneRows ?? []) as Task[];
  const selected = sp.t ? [...tasks, ...done].find((t) => t.id === sp.t) : undefined;
  const view = VIEWS.some(([v]) => v === sp.vista) ? sp.vista! : selected?.list_id ? 'lista' : 'hoy';
  const list = lists.find((l) => l.id === sp.lista);
  const from = `/tareas?vista=${view}${list ? `&lista=${list.id}` : ''}`;
  const listOf = (id: string | null) => lists.find((l) => l.id === id);

  const late = tasks.filter((t) => t.due_date && t.due_date < today);
  const dueToday = tasks.filter((t) => t.due_date === today);
  const noDate = tasks.filter((t) => !t.due_date);
  const endOfWeek = addDays(today, 7 - isoWeekday(today));
  const week = tasks.filter((t) => t.due_date && t.due_date > today && t.due_date <= endOfWeek);
  const later = tasks.filter((t) => t.due_date && t.due_date > endOfWeek);
  const soon = tasks.filter((t) => t.due_date && t.due_date > today && t.due_date <= addDays(today, 3));

  const Row = ({ t }: { t: Task }) => {
    const d = dueLabel(t);
    const l = listOf(t.list_id);
    const steps = t.steps.length ? `${t.steps.filter((x) => x.done).length}/${t.steps.length} pasos` : '';
    return (
      <div className={'tk-row' + (t.done_at ? ' done' : '') + (t.id === selected?.id ? ' sel' : '')}>
        <TaskCheck id={t.id} done={!!t.done_at} color={l?.color} />
        <Link className="tk-main" href={`${from}&t=${t.id}`}>
          <b>{t.priority === 'high' && <span className="tk-prio" title="Prioridad alta" />}{t.title}</b>
          <span>
            {l && view !== 'lista' && <i className="tk-list" style={{ ['--lc' as string]: l.color }}>{l.name}</i>}
            {steps && <i>{steps}</i>}
            {t.repeat !== 'none' && <i>{TASK_REPEAT[t.repeat]}</i>}
            {t.notes && <i>Con notas</i>}
          </span>
        </Link>
        <span className={'tag ' + d.tone}>{d.text}</span>
      </div>
    );
  };
  const Group = ({ title, items, hint }: { title: string; items: Task[]; hint?: string }) => items.length ? (
    <section className="tk-group">
      <div className="tk-gh"><h3>{title}</h3><span className="num muted">{items.length}</span>{hint && <span className="note">{hint}</span>}</div>
      <div className="tk-rows">{items.map((t) => <Row key={t.id} t={t} />)}</div>
    </section>
  ) : null;

  let body: React.ReactNode;
  if (view === 'hoy') {
    body = late.length + dueToday.length + noDate.length ? (
      <>
        <Group title="Vencidas" items={late} hint="Te sigo avisando cada día hasta que las marques" />
        <Group title="Para hoy" items={dueToday} />
        <Group title="Pronto" items={soon} hint="Próximos 3 días" />
        <Group title="Sin plazo" items={noDate} />
      </>
    ) : <p className="muted tk-empty">Nada para hoy. {soon.length ? `Tienes ${soon.length} para los próximos días.` : ''}</p>;
  } else if (view === 'proximas') {
    const byDay = new Map<string, Task[]>();
    for (const t of week) byDay.set(t.due_date!, [...(byDay.get(t.due_date!) ?? []), t]);
    body = late.length + dueToday.length + week.length + later.length ? (
      <>
        <Group title="Vencidas" items={late} />
        <Group title="Hoy" items={dueToday} />
        {[...byDay.entries()].map(([d, items]) => <Group key={d} title={d === addDays(today, 1) ? 'Mañana' : `${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][isoWeekday(d) - 1]} ${fmtDate(d)}`} items={items} />)}
        <Group title="Más adelante" items={later} />
      </>
    ) : <p className="muted tk-empty">No tienes tareas con plazo. Ponle fecha a una y Órbita te recuerda antes.</p>;
  } else if (view === 'hechas') {
    body = done.length ? <Group title="Hechas" items={done} hint="Las últimas 60" /> : <p className="muted tk-empty">Todavía no has terminado ninguna.</p>;
  } else {
    const shown = list ? [list] : lists;
    body = (
      <>
        {list && (
          <details className="tk-listedit">
            <summary className="link">Editar lista</summary>
            <form className="inline" action={updateList}>
              <input type="hidden" name="id" value={list.id} />
              <input className="inp" name="name" defaultValue={list.name} maxLength={60} aria-label="Nombre de la lista" />
              <select className="inp sm" name="color" defaultValue={list.color} aria-label="Color">{LIST_COLORS.map((c, i) => <option key={c} value={c}>Color {i + 1}</option>)}</select>
              <button className="pill mini" type="submit">Guardar</button>
            </form>
            <form action={deleteList}><input type="hidden" name="id" value={list.id} /><button className="pill mini danger" type="submit">Eliminar lista (las tareas se conservan)</button></form>
          </details>
        )}
        {shown.map((l) => <Group key={l.id} title={l.name} items={tasks.filter((t) => t.list_id === l.id)} />)}
        {!list && <Group title="Sin lista" items={tasks.filter((t) => !t.list_id)} />}
        {list && !tasks.some((t) => t.list_id === list.id) && <p className="muted tk-empty">Esta lista está vacía.</p>}
        {!list && !lists.length && <p className="muted tk-empty">Crea listas para separar lo de la universidad, la casa, trámites o lo que quieras.</p>}
      </>
    );
  }

  const flash = sp.ok ? <p className="ok-msg" role="status">{sp.ok}</p> : sp.error ? <p className="err" role="alert">{sp.error}</p> : null;
  const close = from;

  return (
    <>
      <ViewHead label="Tus pendientes · solo tú los ves" title="Tareas" text="Lo que tienes que hacer, con su plazo. Órbita te avisa antes de que se venza.">
        <Link className="pill solid" href={`${from}&nueva=1`}><span className="pill__dot" />Nueva tarea</Link>
      </ViewHead>
      {flash}
      <div className="stat-row">
        <div className="stat"><span className="label">Vencidas</span><b className="num" style={{ color: late.length ? 'var(--bad)' : undefined }}>{late.length}</b><span>{late.length ? 'hazlas primero' : 'nada vencido'}</span></div>
        <div className="stat"><span className="label">Hoy</span><b className="num">{dueToday.length}</b><span>con plazo hoy</span></div>
        <div className="stat"><span className="label">Esta semana</span><b className="num">{week.length}</b><span>hasta el domingo</span></div>
        <div className="stat"><span className="label">Hechas</span><b className="num">{done.filter((t) => t.done_at!.slice(0, 10) >= addDays(today, -7)).length}</b><span>en los últimos 7 días</span></div>
      </div>
      <div className="tk-layout">
        <aside className="tk-side" aria-label="Listas">
          <nav className="tk-nav">
            {VIEWS.map(([v, l]) => (
              <Link key={v} href={`/tareas?vista=${v}`} aria-current={view === v && !list ? 'page' : undefined}>
                {l}<span className="num">{v === 'hoy' ? late.length + dueToday.length || '' : v === 'proximas' ? week.length + later.length || '' : v === 'lista' ? tasks.length || '' : ''}</span>
              </Link>
            ))}
          </nav>
          <span className="label" style={{ padding: '0 10px' }}>Mis listas</span>
          <nav className="tk-nav">
            {lists.map((l) => (
              <Link key={l.id} href={`/tareas?vista=lista&lista=${l.id}`} aria-current={list?.id === l.id ? 'page' : undefined}>
                <i className="dot" style={{ background: l.color }} />{l.name}<span className="num">{tasks.filter((t) => t.list_id === l.id).length || ''}</span>
              </Link>
            ))}
          </nav>
          <form className="tk-newlist" action={createList}>
            <input type="hidden" name="from" value={from} />
            <input className="inp" name="name" placeholder="Nueva lista" maxLength={60} aria-label="Nombre de la nueva lista" />
            <button className="pill mini" type="submit">Crear</button>
          </form>
        </aside>

        <div className="tk-body">
          {(sp.nueva || (!tasks.length && !done.length)) && !selected && (
            <section className="panel">
              <div className="panel-head"><h2>Nueva tarea</h2>{sp.nueva && <Link className="link" href={close}>Cerrar</Link>}</div>
              <TaskForm action={createTask} lists={lists} from={from} defaultList={list?.id} />
            </section>
          )}
          {selected && (
            <section className="panel tk-detail">
              <div className="panel-head">
                <div className="inline"><TaskCheck id={selected.id} done={!!selected.done_at} color={listOf(selected.list_id)?.color} /><h2>{selected.title}</h2></div>
                <Link className="link" href={close}>Cerrar</Link>
              </div>
              {selected.due_date && !selected.done_at && <p className="note">{remindText(selected.remind_days)} a las {selected.remind_time.slice(0, 5)}{selected.remind_overdue ? ', y cada día si se vence.' : '.'}</p>}
              {selected.steps.length > 0 && (
                <div className="tk-steps">{selected.steps.map((x, i) => <StepCheck key={i} id={selected.id} index={i} done={x.done} text={x.t} />)}</div>
              )}
              <TaskForm action={updateTask} lists={lists} task={selected} from={from} submit="Guardar cambios">
                <button className="pill mini danger" type="submit" formAction={deleteTask} formNoValidate>Eliminar</button>
              </TaskForm>
            </section>
          )}
          <div className="panel tk-panel">
            {list && <div className="panel-head"><h2><i className="dot" style={{ background: list.color, marginRight: 8 }} />{list.name}</h2></div>}
            {body}
          </div>
        </div>
      </div>
    </>
  );
}
