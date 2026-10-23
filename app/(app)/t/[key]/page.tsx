import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContext } from '@/lib/data';
import { PRIORITY, STATUS, fmtDate, initial, isLate } from '@/lib/format';
import { Markdown } from '@/components/bits';
import { addComment, addSubtask, toggleSubtask, updateIssue } from '@/lib/actions';

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  return { title: (await params).key.toUpperCase() };
}

const EVENT: Record<string, string> = { created: 'Tarea creada', status: 'Estado', priority: 'Prioridad', due_date: 'Fecha', epic: 'Épica cambiada', sprint: 'Sprint cambiado', assignee: 'Responsable cambiado' };
const ACTOR: Record<string, string> = { user: '', assistant: 'Asistente · ', import: 'Importado · ', system: 'Sistema · ' };

export default async function IssuePage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ editar?: string; error?: string }> }) {
  const { key } = await params;
  const sp = await searchParams;
  const { supabase, projects } = await getContext();
  const { data: i } = await supabase.from('issues').select('*').eq('key', key.toUpperCase()).single();
  if (!i) notFound();
  const p = projects.find((x) => x.id === i.project_id)!;
  const [{ data: epics }, { data: subs }, { data: comments }, { data: events }] = await Promise.all([
    supabase.from('epics').select('id, key, name').eq('project_id', p.id).order('position'),
    supabase.from('subtasks').select('id, title, done').eq('issue_id', i.id).order('position'),
    supabase.from('comments').select('id, body, author_id, author_kind, author_label, created_at').eq('issue_id', i.id).order('created_at'),
    supabase.from('issue_events').select('kind, data, actor_kind, created_at').eq('issue_id', i.id).order('created_at', { ascending: false }).limit(30),
  ]);
  const authorIds = [...new Set((comments ?? []).map((c) => c.author_id).filter(Boolean))];
  const { data: people } = authorIds.length ? await supabase.from('profiles').select('id, full_name').in('id', authorIds) : { data: [] as { id: string; full_name: string }[] };
  const late = isLate(i.due_date, i.status);
  const describe = (e: { kind: string; data: any }) => {
    const base = EVENT[e.kind] ?? e.kind;
    if (e.kind === 'status') return `${base}: ${STATUS[e.data.from]} → ${STATUS[e.data.to]}`;
    if (e.kind === 'priority') return `${base}: ${PRIORITY[e.data.to]}`;
    if (e.kind === 'due_date') return `${base}: ${e.data.to ? fmtDate(e.data.to) : 'sin fecha'}`;
    return base;
  };

  return (
    <>
      <div className="view-head">
        <div>
          <div className="label"><Link href={`/p/${p.key}`}>{p.name}</Link> · {i.key}</div>
          <h1 style={{ fontSize: 'clamp(24px, 2.6vw, 34px)' }}>{i.title}</h1>
        </div>
        {i.source_url && <a className="pill mini" href={i.source_url} target="_blank" rel="noreferrer">Ver original</a>}
      </div>
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      <div className="issue">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section className="panel">
            <div className="panel-head"><h2>Descripción</h2>{!sp.editar && <Link className="pill mini" href={`/t/${i.key}?editar=1`}>Editar</Link>}</div>
            {sp.editar ? (
              <form className="form" action={updateIssue}>
                <input type="hidden" name="key" value={i.key} />
                <label className="field">Título<input name="title" defaultValue={i.title} required /></label>
                <label className="field">Descripción (Markdown)<textarea name="description" defaultValue={i.description} style={{ minHeight: 220 }} /></label>
                <div className="inline"><button className="pill solid" type="submit">Guardar</button><Link className="link" href={`/t/${i.key}`}>Cancelar</Link></div>
              </form>
            ) : i.description ? <Markdown text={i.description} /> : <p className="muted">Sin descripción.</p>}
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Subtareas</h2><span className="note num">{subs?.filter((s) => s.done).length ?? 0}/{subs?.length ?? 0}</span></div>
            {subs?.map((s) => (
              <form key={s.id} action={toggleSubtask} className="check">
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="key" value={i.key} /><input type="hidden" name="done" value={s.done ? '0' : '1'} />
                <button type="submit" className="check" style={{ textAlign: 'left' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--line-2)', background: s.done ? 'var(--violet)' : 'transparent', display: 'inline-block', flex: 'none' }} aria-hidden />
                  <span style={{ textDecoration: s.done ? 'line-through' : undefined, color: s.done ? 'var(--mute)' : undefined }}>{s.title}</span>
                  <span className="sr">{s.done ? 'Marcar como pendiente' : 'Marcar como hecha'}</span>
                </button>
              </form>
            ))}
            <form action={addSubtask} className="inline"><input type="hidden" name="key" value={i.key} /><input className="inp" name="title" placeholder="Nueva subtarea" required /><button className="pill mini" type="submit">Agregar</button></form>
          </section>

          <section className="panel" id="comentarios">
            <div className="panel-head"><h2>Comentarios</h2></div>
            {comments?.length ? comments.map((c: any) => {
              const who = c.author_label || people?.find((x) => x.id === c.author_id)?.full_name || 'Alguien';
              return (
                <div className="comment" key={c.id}>
                  <span className="avatar" style={c.author_kind !== 'user' ? { background: 'var(--violet-wash)', color: 'var(--violet-hi)', fontSize: 10 } : undefined}>{c.author_kind !== 'user' ? 'IA' : initial(who)}</span>
                  <div style={{ minWidth: 0 }}><div className="who">{who}<span>{new Date(c.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })}</span></div><Markdown text={c.body} /></div>
                </div>
              );
            }) : <p className="muted">Sin comentarios.</p>}
            <form action={addComment} className="form"><input type="hidden" name="key" value={i.key} /><textarea className="inp" name="body" placeholder="Escribe un comentario" required style={{ minHeight: 80 }} /><button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Comentar</button></form>
          </section>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form className="panel" action={updateIssue}>
            <input type="hidden" name="key" value={i.key} />
            <dl className="fields">
              <dt>Estado</dt><dd><select className="inp sm" name="status" defaultValue={i.status} aria-label="Estado">{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></dd>
              <dt>Prioridad</dt><dd><select className="inp sm" name="priority" defaultValue={i.priority} aria-label="Prioridad">{Object.entries(PRIORITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></dd>
              <dt>Tipo</dt><dd><select className="inp sm" name="type" defaultValue={i.type} aria-label="Tipo"><option value="task">Tarea</option><option value="story">Historia</option><option value="bug">Error</option></select></dd>
              <dt>Épica</dt><dd><select className="inp sm" name="epic_id" defaultValue={i.epic_id ?? ''} aria-label="Épica" style={{ maxWidth: '100%' }}><option value="">Sin épica</option>{epics?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></dd>
              <dt>Fecha</dt><dd><input className="inp sm" type="date" name="due_date" defaultValue={i.due_date ?? ''} aria-label="Fecha" />{late && <span className="tag bad" style={{ marginLeft: 6 }}>Atrasada</span>}</dd>
            </dl>
            <button className="pill solid" type="submit" style={{ justifyContent: 'center' }}>Guardar cambios</button>
          </form>
          <section className="panel">
            <div className="panel-head"><h2>Historial</h2></div>
            <div className="history">
              {events?.length ? events.map((e, n) => <span key={n}>{new Date(e.created_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })} · {ACTOR[e.actor_kind]}{describe(e)}</span>) : <span>Sin cambios registrados.</span>}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Código</h2></div>
            <p className="muted" style={{ fontSize: 13 }}>Pon <span className="mono violet">{i.key}</span> al inicio de los commits y las ramas para enlazarlos con esta tarea.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
