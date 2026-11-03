import Link from 'next/link';
import { cookies } from 'next/headers';
import { getContext } from '@/lib/data';
import { addDays, fmtDate, isoWeekday, todayISO } from '@/lib/format';
import { createList, createTask, deleteList, deleteTask, updateList, updateTask } from '@/lib/task-actions';
import { LIST_COLORS, TASK_REPEAT, dueLabel, remindText, type Task, type TaskList } from '@/lib/tasks';
import { QuickTask, StepCheck, TaskCheck, TaskForm, TaskSummary } from '@/components/task-bits';
import { DeleteButton } from '@/components/delete-button';
import { ViewHead } from '@/components/bits';

export const metadata = { title: 'Tareas' };

const VIEWS = [['hoy', 'Hoy'], ['proximas', 'Próximas'], ['lista', 'Listas'], ['hechas', 'Hechas']] as const;

export default async function Tasks({ searchParams }: { searchParams: Promise<{ vista?: string; lista?: string; t?: string; nueva?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await getContext();
  const today = todayISO();
  const [{ data: listRows }, { data: open }, { data: doneRows }, { data: goalRows }] = await Promise.all([
    supabase.from('task_lists').select('id, name, color, position').eq('user_id', user.id).order('position'),
    supabase.from('tasks').select('*').eq('user_id', user.id).is('done_at', null).order('due_date', { nullsFirst: false }).order('created_at'),
    supabase.from('tasks').select('*').eq('user_id', user.id).not('done_at', 'is', null).order('done_at', { ascending: false }).limit(60),
    supabase.from('goals').select('id, title').eq('user_id', user.id).is('done_at', null).order('created_at'),
  ]);
  const goals = goalRows ?? [];
  const lists = (listRows ?? []) as TaskList[];
  const tasks = (open ?? []) as Task[];
  const done = (doneRows ?? []) as Task[];
  const selected = sp.t ? [...tasks, ...done].find((t) => t.id === sp.t) : undefined;
  const list = lists.find((l) => l.id === sp.lista);
  const view = list ? 'lista' : VIEWS.some(([v]) => v === sp.vista) ? sp.vista! : 'hoy';
  const jar = await cookies();
  const mode = jar.get('tk_resumen')?.value;
  const lastList = lists.find((l) => l.id === jar.get('tk_lista')?.value)?.id ?? null;
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
    body = late.length + dueToday.length + noDate.length + soon.length ? (
      <>
        <Group title="Vencidas" items={late} hint="Te sigo avisando cada día hasta que las marques" />
        <Group title="Para hoy" items={dueToday} />
        <Group title="Pronto" items={soon} hint="Próximos 3 días" />
        <Group title="Sin plazo" items={noDate} />
      </>
    ) : <p className="muted tk-empty">{tasks.length ? 'Nada para hoy ni para los próximos días.' : 'No tienes tareas pendientes. Escribe arriba la primera.'}</p>;
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
    body = done.length ? <Group title="Últimas terminadas" items={done} hint="Hasta 60" /> : <p className="muted tk-empty">Todavía no has terminado ninguna.</p>;
  } else if (list) {
    const items = tasks.filter((t) => t.list_id === list.id);
    body = items.length ? <div className="tk-rows">{items.map((t) => <Row key={t.id} t={t} />)}</div> : <p className="muted tk-empty">Esta lista está vacía. Escribe arriba para agregar la primera tarea.</p>;
  } else {
    body = lists.length ? (
      <>
        {lists.map((l) => <Group key={l.id} title={l.name} items={tasks.filter((t) => t.list_id === l.id)} />)}
        <Group title="Sin lista" items={tasks.filter((t) => !t.list_id)} />
        {!tasks.length && <p className="muted tk-empty">Tus listas están vacías.</p>}
      </>
    ) : (
      <div className="tk-nolists">
        <b>Todavía no tienes listas</b>
        <p className="muted">Las listas sirven para separar lo de la universidad, la casa, los trámites o lo que quieras. Son opcionales: puedes usar Tareas sin ellas.</p>
        <form className="inline" action={createList}>
          <input type="hidden" name="from" value={from} />
          <input className="inp" name="name" placeholder="Nombre de la lista, por ejemplo Universidad" maxLength={60} required aria-label="Nombre de la nueva lista" />
          <button className="pill solid mini" type="submit">Crear lista</button>
        </form>
      </div>
    );
  }

  const flash = sp.ok ? <p className="ok-msg" role="status">{sp.ok}</p> : sp.error ? <p className="err" role="alert">{sp.error}</p> : null;
  const close = from;
  const counts: Record<string, number> = { hoy: late.length + dueToday.length, proximas: week.length + later.length, lista: tasks.length, hechas: 0 };
  const titles: Record<string, string> = { hoy: 'Hoy', proximas: 'Próximas', lista: 'Todas las listas', hechas: 'Hechas' };

  return (
    <>
      <ViewHead label="Tus pendientes · solo tú los ves" title="Tareas" text="Lo que tienes que hacer, con su plazo. Órbita te avisa antes de que se venza.">
        <Link className="pill solid" href={`${from}&nueva=1`}><span className="pill__dot" />Nueva tarea</Link>
      </ViewHead>
      <TaskSummary mode={mode === 'cards' || mode === 'hidden' ? mode : 'compact'} items={[
        { label: 'Vencidas', value: late.length, hint: late.length ? 'hazlas primero' : 'nada vencido', href: '/tareas?vista=hoy', bad: true },
        { label: 'Hoy', value: dueToday.length, hint: 'con plazo hoy', href: '/tareas?vista=hoy' },
        { label: 'Esta semana', value: week.length, hint: 'hasta el domingo', href: '/tareas?vista=proximas' },
        { label: 'Hechas en 7 días', value: done.filter((t) => t.done_at!.slice(0, 10) >= addDays(today, -7)).length, hint: 'en los últimos 7 días', href: '/tareas?vista=hechas' },
      ]} />

      <nav className="tabs tk-tabs" aria-label="Vistas de tareas">
        {VIEWS.map(([v, l]) => (
          <Link key={v} className="tab" href={`/tareas?vista=${v}`} aria-current={view === v ? 'page' : undefined}>
            {v === 'lista' ? 'Listas' : l}{counts[v] > 0 && <span className="tab-n">{counts[v]}</span>}
          </Link>
        ))}
      </nav>

      {view === 'lista' && lists.length > 0 && (
        <div className="tk-lists">
          <Link className="chip" href="/tareas?vista=lista" aria-current={!list ? 'page' : undefined}>Todas</Link>
          {lists.map((l) => (
            <Link key={l.id} className="chip" href={`/tareas?vista=lista&lista=${l.id}`} aria-current={list?.id === l.id ? 'page' : undefined}>
              <i className="dot" style={{ background: l.color }} />{l.name}<span className="num">{tasks.filter((t) => t.list_id === l.id).length || ''}</span>
            </Link>
          ))}
          <details className="tk-addlist">
            <summary className="chip">+ Nueva lista</summary>
            <form className="inline" action={createList}>
              <input type="hidden" name="from" value={from} />
              <input className="inp" name="name" placeholder="Nombre de la lista" maxLength={60} required autoFocus aria-label="Nombre de la nueva lista" />
              <button className="pill solid mini" type="submit">Crear</button>
            </form>
          </details>
        </div>
      )}

      {flash}

      {sp.nueva && !selected && (
        <section className="panel">
          <div className="panel-head"><h2>Nueva tarea</h2><Link className="link" href={close}>Cerrar</Link></div>
          <TaskForm action={createTask} lists={lists} goals={goals} from={from} defaultList={list?.id ?? lastList} />
        </section>
      )}
      {selected && (
        <section className="panel tk-detail">
          <div className="panel-head">
            <div className="inline"><TaskCheck id={selected.id} done={!!selected.done_at} color={listOf(selected.list_id)?.color} /><h2>{selected.title}</h2></div>
            <div className="inline"><DeleteButton action={deleteTask} fields={{ id: selected.id, from }} what={`la tarea «${selected.title}»`} /><Link className="link" href={close}>Cerrar</Link></div>
          </div>
          {selected.due_date && !selected.done_at && <p className="note">{remindText(selected.remind_days)} a las {selected.remind_time.slice(0, 5)}{selected.remind_overdue ? ', y cada día si se vence.' : '.'}</p>}
          {selected.steps.length > 0 && (
            <div className="tk-steps">{selected.steps.map((x, i) => <StepCheck key={i} id={selected.id} index={i} done={x.done} text={x.t} />)}</div>
          )}
          <TaskForm action={updateTask} lists={lists} goals={goals} task={selected} from={from} submit="Guardar cambios" />
        </section>
      )}

      <section className="panel tk-panel">
        <div className="panel-head">
          {list ? (
            <h2 className="tk-ptitle"><i className="dot" style={{ background: list.color }} />{list.name}<span className="num muted">{tasks.filter((t) => t.list_id === list.id).length}</span></h2>
          ) : <h2 className="tk-ptitle">{titles[view]}</h2>}
          {list && (
            <div className="inline">
              <details className="tk-listedit">
                <summary className="del-btn with-label">Editar</summary>
                <form className="inline tk-listedit-form" action={updateList}>
                  <input type="hidden" name="id" value={list.id} />
                  <input className="inp" name="name" defaultValue={list.name} maxLength={60} aria-label="Nombre de la lista" />
                  <select className="inp sm" name="color" defaultValue={list.color} aria-label="Color">{LIST_COLORS.map((c, i) => <option key={c} value={c}>Color {i + 1}</option>)}</select>
                  <button className="pill mini" type="submit">Guardar</button>
                </form>
              </details>
              <DeleteButton action={deleteList} fields={{ id: list.id }} what={`la lista «${list.name}»`} detail="Sus tareas no se borran: quedan en «Sin lista»." />
            </div>
          )}
        </div>
        {view !== 'hechas' && (view !== 'lista' || list || lists.length > 0) && <QuickTask key={list?.id ?? view} list={list?.id ?? lastList} lists={lists} fixed={!!list} placeholder={list ? `Agregar a ${list.name}…` : 'Agregar una tarea…'} />}
        {body}
      </section>
    </>
  );
}
