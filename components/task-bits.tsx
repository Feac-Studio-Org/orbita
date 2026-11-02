'use client';
import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { quickTask, setStepDone, setTaskDone } from '@/lib/task-actions';
import { DEFAULT_REMIND, REMIND_OPTIONS, TASK_PRIORITY, TASK_REPEAT, type Task, type TaskList } from '@/lib/tasks';

/** Casilla redonda para marcar una tarea; se ve hecha al instante. */
export function TaskCheck({ id, done, color = 'var(--violet-hi)' }: { id: string; done: boolean; color?: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [on, set] = useOptimistic(done);
  return (
    <button type="button" className={'tk-check' + (on ? ' on' : '')} style={{ ['--tc' as string]: color }} aria-pressed={on} aria-label={on ? 'Marcar como pendiente' : 'Marcar como hecha'}
      onClick={() => start(async () => { set(!on); await setTaskDone(id, !on); router.refresh(); })}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" /></svg>
    </button>
  );
}

export function StepCheck({ id, index, done, text }: { id: string; index: number; done: boolean; text: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [on, set] = useOptimistic(done);
  return (
    <label className={'tk-step' + (on ? ' on' : '')}>
      <input type="checkbox" checked={on} onChange={() => start(async () => { set(!on); await setStepDone(id, index, !on); router.refresh(); })} />
      <span>{text}</span>
    </label>
  );
}

const iso = (n: number) => {
  const d = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const QUICK: [string, number][] = [['Hoy', 0], ['Mañana', 1], ['En 3 días', 3], ['En 4 días', 4], ['En una semana', 7], ['En 2 semanas', 14]];

/** Formulario completo de tarea: plazo con atajos, recordatorios a elegir, pasos y repetición. */
export function TaskForm({ action, lists, goals = [], task, from, defaultList, submit = 'Crear tarea', children }: {
  action: (f: FormData) => void; lists: TaskList[]; goals?: { id: string; title: string }[]; task?: Task & { goal_id?: string | null }; from: string; defaultList?: string | null; submit?: string; children?: React.ReactNode;
}) {
  const [due, setDue] = useState(task?.due_date ?? '');
  const [remind, setRemind] = useState<number[]>(task?.remind_days ?? DEFAULT_REMIND);
  const toggle = (n: number) => setRemind((r) => (r.includes(n) ? r.filter((x) => x !== n) : [...r, n]));
  return (
    <form className="form tk-form" action={action}>
      <input type="hidden" name="from" value={from} />
      {task && <input type="hidden" name="id" value={task.id} />}
      <input type="hidden" name="remind_set" value="1" />
      <label className="field">Qué hay que hacer<input name="title" required maxLength={200} defaultValue={task?.title} placeholder="Ej.: Trabajo de la universidad" autoFocus={!task} /></label>
      <div className="field">
        <span>Plazo</span>
        <div className="tk-quick">
          {QUICK.map(([l, n]) => <button type="button" key={l} className={'chip' + (due === iso(n) ? ' on' : '')} onClick={() => setDue(iso(n))}>{l}</button>)}
          <button type="button" className={'chip' + (!due ? ' on' : '')} onClick={() => setDue('')}>Sin plazo</button>
        </div>
        <div className="two">
          <input className="inp" type="date" name="due" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Fecha límite" />
          <input className="inp" type="time" name="time" defaultValue={task?.due_time?.slice(0, 5) ?? ''} aria-label="Hora límite (opcional)" />
        </div>
      </div>
      {due && (
        <fieldset className="field tk-remind">
          <legend>Recordatorios</legend>
          <div className="tk-quick">
            {REMIND_OPTIONS.map((n) => (
              <label key={n} className={'chip' + (remind.includes(n) ? ' on' : '')}>
                <input type="checkbox" name="remind" value={n} checked={remind.includes(n)} onChange={() => toggle(n)} />
                {n === 0 ? 'El mismo día' : n === 1 ? '1 día antes' : `${n} días antes`}
              </label>
            ))}
          </div>
          <div className="two">
            <label className="field">A qué hora avisar<input className="inp" type="time" name="remind_time" defaultValue={task?.remind_time?.slice(0, 5) ?? '08:00'} /></label>
            <label className="tk-inline"><input type="checkbox" name="overdue" defaultChecked={task?.remind_overdue ?? true} />Si se vence sin hacer, avisar cada día</label>
          </div>
        </fieldset>
      )}
      <div className="two">
        <label className="field">Lista
          <select className="inp" name="list" defaultValue={task?.list_id ?? defaultList ?? ''}>
            <option value="">Sin lista</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="field">Prioridad
          <select className="inp" name="priority" defaultValue={task?.priority ?? 'medium'}>
            {Object.entries(TASK_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      {goals.length > 0 && (
        <label className="field">Meta (opcional)
          <select className="inp" name="goal" defaultValue={task?.goal_id ?? ''}>
            <option value="">Ninguna</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </label>
      )}
      <details className="tk-more" open={!!task && (!!task.notes || task.steps.length > 0 || task.repeat !== 'none')}>
        <summary className="link">Más: pasos, notas y repetición</summary>
        <label className="field">Pasos (uno por línea)<textarea name="steps" rows={3} defaultValue={task?.steps.map((x) => (x.done ? '[x] ' : '') + x.t).join('\n')} placeholder={'Buscar fuentes\nEscribir borrador\nRevisar y entregar'} /></label>
        <label className="field">Notas<textarea name="notes" rows={3} defaultValue={task?.notes} /></label>
        <label className="field">Se repite
          <select className="inp" name="repeat" defaultValue={task?.repeat ?? 'none'}>
            {Object.entries(TASK_REPEAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </details>
      <div className="inline">
        <button className="pill solid" type="submit">{submit}</button>
        {children}
      </div>
    </form>
  );
}

/** Agregar rápido: nombre y, si quieres, en cuántos días. Dentro de una lista, la tarea queda en esa lista. */
export function QuickTask({ list = null, placeholder = 'Agregar una tarea…' }: { list?: string | null; placeholder?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <form className="tk-qadd" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await quickTask(title, days === null ? null : iso(days), list);
        if ('error' in r && r.error) { setErr(r.error); return; }
        setTitle(''); setDays(null); setErr(''); router.refresh();
      });
    }}>
      <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} aria-label="Nueva tarea" />
      <div className="tk-quick">
        {QUICK.slice(0, 5).map(([l, n]) => <button type="button" key={l} className={'chip' + (days === n ? ' on' : '')} onClick={() => setDays(days === n ? null : n)}>{l}</button>)}
        <button className="pill solid mini" type="submit" disabled={pending || !title.trim()}>Agregar</button>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  );
}


type SummaryMode = 'cards' | 'compact' | 'hidden';
/** Resumen de Tareas: en tarjetas, en una línea o escondido. Se recuerda en este navegador. */
export function TaskSummary({ mode: initial, items }: { mode: SummaryMode; items: { label: string; value: number; hint: string; href: string; bad?: boolean }[] }) {
  const [mode, setMode] = useState<SummaryMode>(initial);
  const set = (m: SummaryMode) => { setMode(m); document.cookie = `tk_resumen=${m}; path=/; max-age=31536000; samesite=lax`; };
  if (mode === 'hidden') return (
    <button type="button" className="tk-sum-show" onClick={() => set('compact')}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>Mostrar resumen
    </button>
  );
  const tools = (
    <div className="tk-sum-tools">
      <button type="button" onClick={() => set(mode === 'cards' ? 'compact' : 'cards')} aria-label={mode === 'cards' ? 'Hacer el resumen más pequeño' : 'Hacer el resumen más grande'} title={mode === 'cards' ? 'Más pequeño' : 'Más grande'}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{ transform: mode === 'cards' ? 'rotate(180deg)' : undefined }}><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <button type="button" onClick={() => set('hidden')} aria-label="Ocultar el resumen" title="Ocultar">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
    </div>
  );
  if (mode === 'compact') return (
    <div className="tk-sum compact">
      <div className="tk-sum-line">
        {items.map((i) => <a key={i.label} href={i.href} className={'tk-sum-chip' + (i.bad && i.value ? ' bad' : '')}><b className="num">{i.value}</b>{i.label}</a>)}
      </div>
      {tools}
    </div>
  );
  return (
    <div className="tk-sum">
      <div className="stat-row">
        {items.map((i) => <a key={i.label} href={i.href} className="stat"><span className="label">{i.label}</span><b className="num" style={{ color: i.bad && i.value ? 'var(--bad)' : undefined }}>{i.value}</b><span>{i.hint}</span></a>)}
      </div>
      {tools}
    </div>
  );
}
