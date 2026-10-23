import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContext, spaceOf } from '@/lib/data';
import { FIN_STATUS, PERIOD, PRIORITY, STATUS, money } from '@/lib/format';
import { Board } from '@/components/board';
import { Empty, Markdown } from '@/components/bits';
import { createDoc, createEpic, createExpense, saveDoc } from '@/lib/actions';

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  return { title: (await params).key.toUpperCase() };
}

const TABS = [['tablero', 'Tablero'], ['backlog', 'Backlog'], ['epicas', 'Épicas'], ['documentos', 'Documentos'], ['finanzas', 'Finanzas']] as const;

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ tab?: string; doc?: string; editar?: string }> }) {
  const { key } = await params;
  const sp = await searchParams;
  const { supabase, projects, spaces, modules } = await getContext();
  const p = projects.find((x) => x.key === key.toUpperCase());
  if (!p) notFound();
  const space = spaceOf(spaces, p.space_id)!;
  const showFinance = modules.finance && space.modules.finance !== false && ['owner', 'partner'].includes(space.role);
  const tabs = TABS.filter(([t]) => t !== 'finanzas' || showFinance);
  const tab = tabs.some(([t]) => t === sp.tab) ? sp.tab! : 'tablero';

  const [{ data: issues }, { data: epics }] = await Promise.all([
    supabase.from('issues').select('id, key, number, title, status, priority, due_date, epic_id, type').eq('project_id', p.id).order('number'),
    supabase.from('epics').select('id, key, name, description, status, position').eq('project_id', p.id).order('position').order('created_at'),
  ]);
  const epicName = (id: string | null) => epics?.find((e) => e.id === id)?.name;
  const all = issues ?? [];
  const done = all.filter((i) => i.status === 'done').length;

  let body: React.ReactNode = null;
  if (tab === 'tablero') {
    body = all.length ? <Board issues={all.map((i) => ({ ...i, epic: epicName(i.epic_id) }))} /> :
      <Empty action={<Link className="pill" href={`/nuevo/tarea?proyecto=${p.key}`}>Crear la primera tarea</Link>}>Este proyecto todavía no tiene tareas.</Empty>;
  } else if (tab === 'backlog') {
    const groups = [...(epics ?? []).map((e) => ({ name: `${e.key} · ${e.name}`, items: all.filter((i) => i.epic_id === e.id) })), { name: 'Sin épica', items: all.filter((i) => !i.epic_id) }].filter((g) => g.items.length);
    body = groups.length ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map((g) => (
          <div className="bl-group" key={g.name}>
            <div className="bl-head"><b>{g.name}</b><span className="muted num" style={{ fontSize: 12.5 }}>{g.items.length} tareas</span></div>
            {g.items.map((i) => (
              <Link key={i.key} href={`/t/${i.key}`} className="bl-row">
                <span className="key">{i.key}</span>
                <span style={{ overflowWrap: 'anywhere' }}>{i.title}</span>
                <span className={'tag hide-s ' + (i.status === 'done' ? 'ok' : i.status === 'progress' ? 'v' : i.status === 'review' ? 'warn' : '')}>{STATUS[i.status]}</span>
                <span className={'prio ' + i.priority} title={PRIORITY[i.priority]} />
              </Link>
            ))}
          </div>
        ))}
      </div>
    ) : <Empty>Sin tareas todavía.</Empty>;
  } else if (tab === 'epicas') {
    body = (
      <div className="epics">
        {(epics ?? []).map((e) => {
          const its = all.filter((i) => i.epic_id === e.id);
          const d = its.filter((i) => i.status === 'done').length;
          const pct = its.length ? Math.round((d / its.length) * 100) : e.status === 'done' ? 100 : 0;
          return (
            <div className="epic" key={e.id}>
              <span className="key">{e.key}</span><b>{e.name}</b>
              {e.description && <p>{e.description}</p>}
              <div className="bar"><i style={{ width: Math.max(pct, 3) + '%', background: p.color }} /></div>
              <span className="note num">{d} de {its.length} tareas{e.status === 'done' ? ' · cerrada' : ''}</span>
            </div>
          );
        })}
        <details className="epic add">
          <summary className="link" style={{ fontSize: 14 }}>+ Nueva épica</summary>
          <form className="form" action={createEpic}>
            <input type="hidden" name="project" value={p.key} />
            <label className="field">Nombre<input name="name" required /></label>
            <label className="field">Para qué es<input name="description" /></label>
            <button className="pill solid" type="submit">Crear épica</button>
          </form>
        </details>
      </div>
    );
  } else if (tab === 'documentos') {
    const { data: docs } = await supabase.from('doc_pages').select('id, title, body, source_url, position, updated_at').eq('project_id', p.id).order('position');
    const current = docs?.find((d) => d.id === sp.doc) ?? docs?.[0];
    body = (
      <div className="docs">
        <nav className="tree">
          {(docs ?? []).map((d) => <Link key={d.id} href={`/p/${p.key}?tab=documentos&doc=${d.id}`} aria-current={d.id === current?.id ? 'page' : undefined}>{d.title}</Link>)}
          <details className="add" style={{ padding: '6px 10px' }}>
            <summary className="link">+ Nueva página</summary>
            <form className="form" action={createDoc}><input type="hidden" name="project" value={p.key} /><input className="inp" name="title" placeholder="Título" required /><button className="pill mini" type="submit">Crear</button></form>
          </details>
        </nav>
        {current ? (
          <article className="doc">
            <div className="panel-head"><span className="label">{p.name} · Documentación</span>
              {sp.editar ? <Link className="link" href={`/p/${p.key}?tab=documentos&doc=${current.id}`}>Cancelar</Link> : <Link className="pill mini" href={`/p/${p.key}?tab=documentos&doc=${current.id}&editar=1`}>Editar</Link>}
            </div>
            {sp.editar ? (
              <form className="form" action={saveDoc}>
                <input type="hidden" name="id" value={current.id} /><input type="hidden" name="project" value={p.key} />
                <label className="field">Título<input name="title" defaultValue={current.title} required /></label>
                <label className="field">Contenido (Markdown: # títulos, - listas, | tablas |, `código`, **negrita**)<textarea name="body" defaultValue={current.body} style={{ minHeight: 420, fontFamily: 'var(--f-mono)', fontSize: 13 }} /></label>
                <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar</button>
                <p className="note">La versión anterior queda guardada en el historial.</p>
              </form>
            ) : (
              <>
                <h2>{current.title}</h2>
                <Markdown text={current.body || '_Página vacía._'} />
                {current.source_url && <p className="note">Original: <a className="link" href={current.source_url} target="_blank" rel="noreferrer">{current.source_url.includes('atlassian') ? 'Confluence' : 'fuente'}</a></p>}
              </>
            )}
          </article>
        ) : <Empty>Este proyecto todavía no tiene documentación.</Empty>}
      </div>
    );
  } else if (tab === 'finanzas') {
    const { data: fin } = await supabase.from('finance_entries').select('*').eq('project_id', p.id).order('created_at');
    body = (
      <>
        {fin?.length ? (
          <div className="table-wrap"><table className="t"><thead><tr><th>Concepto</th><th>Valor</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>
            {fin.map((f) => <tr key={f.id}><td><b style={{ fontWeight: 500 }}>{f.concept}</b>{f.note && <div className="note">{f.note}</div>}</td><td className="num">{Number(f.amount) ? money(f.amount, f.currency) : 'Gratis'}</td><td className="muted">{PERIOD[f.period]}</td><td><span className={'tag ' + (f.status === 'pending' ? 'warn' : f.status === 'paid' ? 'ok' : 'v')}>{FIN_STATUS[f.status]}</span></td></tr>)}
          </tbody></table></div>
        ) : <Empty>Este proyecto no tiene gastos anotados.</Empty>}
        <details className="panel add">
          <summary className="link" style={{ fontSize: 14 }}>+ Anotar gasto de {p.name}</summary>
          <form className="form" action={createExpense}>
            <input type="hidden" name="space" value={p.space_id} /><input type="hidden" name="project" value={p.id} /><input type="hidden" name="return" value={`/p/${p.key}?tab=finanzas`} />
            <div className="two"><label className="field">Concepto<input name="concept" required /></label><label className="field">Valor<input name="amount" inputMode="decimal" required /></label></div>
            <div className="two">
              <label className="field">Moneda<select name="currency"><option value="COP">Pesos (COP)</option><option value="USD">Dólares (USD)</option></select></label>
              <label className="field">Tipo<select name="period"><option value="once">Gasto único</option><option value="monthly">Suscripción mensual</option><option value="yearly">Suscripción anual</option></select></label>
            </div>
            <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar</button>
          </form>
        </details>
      </>
    );
  }

  return (
    <>
      <div className="view-head">
        <div>
          <div className="label">{space.name}{space.role === 'partner' ? ' · espacio compartido' : ''} · {p.key}</div>
          <h1>{p.name}</h1>
          <p>{p.description}{p.repo && <> Repositorio: {p.repo_url ? <a className="link mono" href={p.repo_url} target="_blank" rel="noreferrer">{p.repo}</a> : <span className="mono">{p.repo}</span>}</>}</p>
        </div>
        <div className="inline">
          <span className="tag v" style={{ padding: '6px 12px' }}>{p.status_label}</span>
          <span className="tag num" style={{ padding: '6px 12px' }}>{done}/{all.length} hechas</span>
          <Link className="pill" href={`/nuevo/tarea?proyecto=${p.key}`}><span className="pill__dot" />Nueva tarea</Link>
        </div>
      </div>
      <nav className="tabs">{tabs.map(([t, l]) => <Link key={t} className="tab" href={`/p/${p.key}?tab=${t}`} aria-current={t === tab ? 'page' : undefined}>{l}</Link>)}</nav>
      {body}
    </>
  );
}
