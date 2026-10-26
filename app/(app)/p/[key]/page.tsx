import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContext, spaceOf } from '@/lib/data';
import { FIN_STATUS, PERIOD, PRIORITY, ROLE, STATUS, addDays, fmtDate, isLate, money, todayISO } from '@/lib/format';
import { Board } from '@/components/board';
import { Avatar } from '@/components/avatar';
import { Donut, STATUS_COLOR } from '@/components/charts';
import { Empty, Markdown } from '@/components/bits';
import { closeSprint, createDoc, createEpic, createExpense, createSprint, saveDoc, startSprint } from '@/lib/actions';
import { SprintPicker } from '@/components/sprint-picker';
import { ProjectMark } from '@/components/project-mark';
import { ImageUpload } from '@/components/image-upload';

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  return { title: (await params).key.toUpperCase() };
}

const TABS = [['resumen', 'Resumen'], ['tablero', 'Tablero'], ['backlog', 'Backlog'], ['sprints', 'Sprints'], ['epicas', 'Épicas'], ['documentos', 'Documentos'], ['finanzas', 'Finanzas']] as const;

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' });
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ tab?: string; doc?: string; editar?: string; sprint?: string; ok?: string; error?: string }> }) {
  const { key } = await params;
  const sp = await searchParams;
  const { supabase, projects, spaces, modules } = await getContext();
  const p = projects.find((x) => x.key === key.toUpperCase());
  if (!p) notFound();
  const space = spaceOf(spaces, p.space_id)!;
  const canEdit = space.role !== 'guest';
  const showFinance = modules.finance && space.modules.finance !== false && ['owner', 'partner'].includes(space.role);
  const tabs = TABS.filter(([t]) => t !== 'finanzas' || showFinance);
  const tab = tabs.some(([t]) => t === sp.tab) ? sp.tab! : 'resumen';

  const [{ data: issues }, { data: epics }, { data: sm }, { data: pa }, { data: sprintRows }] = await Promise.all([
    supabase.from('issues').select('id, key, number, title, status, priority, due_date, epic_id, sprint_id, assignee_id, updated_at, subtasks (done)').eq('project_id', p.id).order('number'),
    supabase.from('epics').select('id, key, name, description, status, start_date, end_date, position').eq('project_id', p.id).order('position').order('created_at'),
    supabase.from('space_members').select('user_id, role').eq('space_id', p.space_id),
    supabase.from('project_access').select('user_id').eq('project_id', p.id),
    supabase.from('sprints').select('id, name, goal, start_date, end_date, state, created_at').eq('project_id', p.id).order('created_at'),
  ]);
  const all = issues ?? [];
  const eps = epics ?? [];
  const access = new Set((pa ?? []).map((a) => a.user_id));
  const team = (sm ?? []).filter((m) => ['owner', 'partner'].includes(m.role) || access.has(m.user_id));
  const { data: profs } = team.length ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', team.map((m) => m.user_id)) : { data: [] };
  const people = team.map((m) => { const pr = profs?.find((x) => x.id === m.user_id); return { id: m.user_id, name: pr?.full_name || 'Sin nombre', avatar: pr?.avatar_url ?? null, role: m.role as string }; });
  const epicName = (id: string | null) => eps.find((e) => e.id === id)?.name;
  const sprints = sprintRows ?? [];
  const activeSprint = sprints.find((x) => x.state === 'active');
  const openSprints = sprints.filter((x) => x.state !== 'closed');
  const daysLeft = (end: string | null) => end ? Math.round((new Date(end + 'T12:00:00Z').getTime() - new Date(todayISO() + 'T12:00:00Z').getTime()) / 864e5) : null;
  const sprintStats = (id: string) => { const its = all.filter((i) => i.sprint_id === id); const d = its.filter((i) => i.status === 'done').length; return { its, d, pct: its.length ? Math.round((d / its.length) * 100) : 0 }; };
  const flash = sp.ok ? <p className="ok-msg" role="status">{sp.ok}</p> : sp.error ? <p className="err" role="alert">{sp.error}</p> : null;
  const done = all.filter((i) => i.status === 'done').length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const late = all.filter((i) => isLate(i.due_date, i.status));
  const soon = all.filter((i) => i.status !== 'done' && i.due_date && !isLate(i.due_date, i.status) && i.due_date <= addDays(todayISO(), 14)).sort((a, b) => a.due_date!.localeCompare(b.due_date!));

  let body: React.ReactNode = null;
  if (tab === 'resumen') {
    const ids = all.map((i) => i.id);
    const [{ data: events }, { data: comments }] = ids.length ? await Promise.all([
      supabase.from('issue_events').select('issue_id, actor_id, actor_kind, kind, data, created_at').in('issue_id', ids).order('created_at', { ascending: false }).limit(14),
      supabase.from('comments').select('issue_id, author_id, author_kind, author_label, created_at').in('issue_id', ids).order('created_at', { ascending: false }).limit(8),
    ]) : [{ data: [] }, { data: [] }];
    const feed = [
      ...(events ?? []).map((e) => ({ ...e, what: e.kind === 'created' ? 'creó' : e.kind === 'status' ? `movió a ${STATUS[(e.data as { to?: string })?.to ?? ''] ?? 'otro estado'}` : 'actualizó' })),
      ...(comments ?? []).map((c) => ({ issue_id: c.issue_id, actor_id: c.author_id, actor_kind: c.author_kind, created_at: c.created_at, what: 'comentó en', label: c.author_label })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12);
    const actor = (f: { actor_id: string | null; actor_kind: string; label?: string | null }) => f.actor_kind !== 'user' ? (f.label || 'Asistente') : people.find((x) => x.id === f.actor_id)?.name ?? 'Alguien';
    const issueOf = (id: string) => all.find((i) => i.id === id);
    const statusData = (['todo', 'progress', 'review', 'done'] as const).map((s) => ({ label: STATUS[s], value: all.filter((i) => i.status === s).length, color: STATUS_COLOR[s] }));
    const openBy = (uid: string) => all.filter((i) => i.assignee_id === uid && i.status !== 'done').length;
    const unassigned = all.filter((i) => !i.assignee_id && i.status !== 'done').length;

    body = (
      <>
        <div className="stat-row">
          <div className="stat"><span className="label">Avance</span><b className="num">{pct}%</b><div className="bar" style={{ marginTop: 4 }}><i style={{ width: Math.max(pct, 2) + '%', background: p.color }} /></div><span>{done} de {all.length} tareas hechas</span></div>
          <div className="stat"><span className="label">Abiertas</span><b className="num">{all.length - done}</b><span>{all.filter((i) => i.status === 'progress').length} en curso ahora</span></div>
          <div className="stat"><span className="label">Atrasadas</span><b className="num" style={{ color: late.length ? 'var(--bad)' : undefined }}>{late.length}</b><span>{late.length ? 'revísalas hoy' : 'nada atrasado'}</span></div>
          <div className="stat"><span className="label">Próximas 2 semanas</span><b className="num">{soon.length}</b><span>con fecha de entrega</span></div>
        </div>

        {activeSprint && (() => { const stx = sprintStats(activeSprint.id); const left = daysLeft(activeSprint.end_date); return (
          <Link href={`/p/${p.key}?tab=tablero`} className="sprint-now">
            <span className="live-dot" />
            <div><span className="label">Sprint activo</span><b>{activeSprint.name}</b>{activeSprint.goal && <span className="muted"> · {activeSprint.goal}</span>}</div>
            <div className="bar" style={{ width: 160 }}><i style={{ width: Math.max(stx.pct, 2) + '%', background: p.color }} /></div>
            <span className="num">{stx.d}/{stx.its.length}</span>
            {left !== null && <span className={'tag ' + (left < 0 ? 'bad' : left <= 2 ? 'warn' : '')}>{left < 0 ? `Vencido hace ${-left} d` : `${left} días`}</span>}
          </Link>
        ); })()}
        <div className="grid g-sum">
          <section className="panel">
            <div className="panel-head"><h2>Estado de las tareas</h2><Link className="link" href={`/p/${p.key}?tab=tablero`}>Abrir tablero</Link></div>
            {all.length ? <Donut data={statusData} center={`${pct}%`} sub="hecho" /> : <p className="muted">Sin tareas todavía.</p>}
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Épicas</h2><Link className="link" href={`/p/${p.key}?tab=epicas`}>Ver todas</Link></div>
            {eps.length ? (
              <div className="ep-list">
                {eps.slice(0, 6).map((e) => {
                  const its = all.filter((i) => i.epic_id === e.id);
                  const d = its.filter((i) => i.status === 'done').length;
                  const ep = its.length ? Math.round((d / its.length) * 100) : e.status === 'done' ? 100 : 0;
                  return (
                    <div key={e.id} className="ep-row">
                      <div className="ep-top"><span className="ep-name">{e.name}</span><span className="num muted">{d}/{its.length}</span></div>
                      <div className="bar"><i style={{ width: Math.max(ep, 2) + '%', background: ep === 100 ? 'var(--ok)' : p.color }} /></div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="muted">Sin épicas. Agrúpalas para ver el avance por fase.</p>}
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Equipo</h2>{space.modules.members !== false && ['owner', 'partner'].includes(space.role) && <Link className="link" href={`/miembros/${space.id}`}>Gestionar</Link>}</div>
            <div className="people">
              {people.map((x) => (
                <div key={x.id} className="person">
                  <Avatar name={x.name} url={x.avatar} size={30} />
                  <div><b>{x.name}</b><span>{ROLE[x.role]}</span></div>
                  <span className="num muted" title="Tareas abiertas asignadas">{openBy(x.id)}</span>
                </div>
              ))}
              {unassigned > 0 && <p className="note">{unassigned} tareas abiertas sin responsable.</p>}
            </div>
            {(p.repo || p.repo_url) && (
              <div className="links-box">
                <span className="label">Enlaces</span>
                {p.repo_url ? <a className="link mono" href={p.repo_url} target="_blank" rel="noreferrer">{p.repo || p.repo_url}</a> : <span className="mono muted">{p.repo}</span>}
              </div>
            )}
          </section>
        </div>

        <div className="grid g-2">
          <section className="panel">
            <div className="panel-head"><h2>Atrasadas y próximas</h2><span className="label">Por fecha</span></div>
            {late.length + soon.length ? (
              <div className="list">
                {[...late, ...soon].slice(0, 10).map((i) => (
                  <Link key={i.key} href={`/t/${i.key}`} className="row-due">
                    <span className={'prio ' + i.priority} title={PRIORITY[i.priority]} />
                    <span className="row-title">{i.title}<small className="key">{i.key}{i.epic_id ? ' · ' + epicName(i.epic_id) : ''}</small></span>
                    <span className={'tag ' + (isLate(i.due_date, i.status) ? 'bad' : '')}>{isLate(i.due_date, i.status) ? 'Atrasada · ' : ''}{fmtDate(i.due_date)}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="muted">Nada vence en las próximas dos semanas.</p>}
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Actividad reciente</h2></div>
            {feed.length ? (
              <ol className="feed">
                {feed.map((f, n) => {
                  const it = issueOf(f.issue_id);
                  return (
                    <li key={n}>
                      <span className={'feed-dot' + (f.actor_kind !== 'user' ? ' ai' : '')} />
                      <p><b>{actor(f)}</b> {f.what} {it ? <Link className="link" href={`/t/${it.key}`}>{it.key}</Link> : 'una tarea'}{it && <span className="muted"> · {it.title}</span>}</p>
                      <time className="note">{ago(f.created_at)}</time>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="muted">Todavía no hay actividad.</p>}
          </section>
        </div>
      </>
    );
  } else if (tab === 'tablero') {
    const chosen = sp.sprint ?? (activeSprint ? activeSprint.id : 'all');
    const cur = sprints.find((x) => x.id === chosen);
    const boardIssues = chosen === 'all' ? all : chosen === 'backlog' ? all.filter((i) => !i.sprint_id) : all.filter((i) => i.sprint_id === chosen);
    const st = cur ? sprintStats(cur.id) : null;
    const left = cur ? daysLeft(cur.end_date) : null;
    body = (
      <>
        <div className="sprint-bar">
          <nav className="seg" aria-label="Qué tareas ver">
            {openSprints.map((x) => <Link key={x.id} href={`/p/${p.key}?tab=tablero&sprint=${x.id}`} aria-current={chosen === x.id ? 'page' : undefined}>{x.name}{x.state === 'active' && <span className="live-dot" />}</Link>)}
            <Link href={`/p/${p.key}?tab=tablero&sprint=backlog`} aria-current={chosen === 'backlog' ? 'page' : undefined}>Sin sprint</Link>
            <Link href={`/p/${p.key}?tab=tablero&sprint=all`} aria-current={chosen === 'all' ? 'page' : undefined}>Todas</Link>
          </nav>
          {cur && st ? (
            <div className="sprint-info">
              {cur.goal && <span className="muted">{cur.goal}</span>}
              <div className="bar" style={{ width: 120 }}><i style={{ width: Math.max(st.pct, 2) + '%', background: p.color }} /></div>
              <span className="num">{st.pct}%</span>
              {left !== null && <span className={'tag ' + (left < 0 ? 'bad' : left <= 2 ? 'warn' : '')}>{cur.state === 'planned' ? 'Sin empezar' : left < 0 ? `Vencido hace ${-left} d` : left === 0 ? 'Termina hoy' : `${left} días restantes`}</span>}
            </div>
          ) : !sprints.length && canEdit ? <Link className="link" href={`/p/${p.key}?tab=sprints`}>Organiza las tareas en sprints</Link> : null}
        </div>
        {boardIssues.length || canEdit ? (
          <Board key={chosen} project={p.key} canEdit={canEdit} epics={eps.map((e) => ({ id: e.id, name: e.name }))} people={people}
            issues={boardIssues.map((i) => ({ key: i.key, title: i.title, status: i.status, priority: i.priority, due_date: i.due_date, epic_id: i.epic_id, epic: epicName(i.epic_id), assignee_id: i.assignee_id,
              subtasks: [((i.subtasks as { done: boolean }[]) ?? []).filter((x) => x.done).length, ((i.subtasks as unknown[]) ?? []).length] as [number, number] }))} />
        ) : <Empty>No hay tareas aquí.</Empty>}
      </>
    );
  } else if (tab === 'backlog') {
    const groups = [
      ...openSprints.map((x) => ({ id: x.id, name: x.name, sub: x.state === 'active' ? 'Activo' : 'Planeado', items: all.filter((i) => i.sprint_id === x.id) })),
      { id: 'backlog', name: 'Backlog', sub: 'Sin sprint', items: all.filter((i) => !i.sprint_id || sprints.find((x) => x.id === i.sprint_id)?.state === 'closed').filter((i) => i.status !== 'done' || !i.sprint_id) },
    ];
    body = all.length ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!sprints.length && canEdit && <div className="callout inline" style={{ justifyContent: 'space-between' }}><span>Divide el trabajo en entregas: crea un sprint y pásale las tareas que harás en esas semanas.</span><Link className="pill mini" href={`/p/${p.key}?tab=sprints`}>Crear sprint</Link></div>}
        {groups.map((g) => (
          <div className="bl-group" key={g.id}>
            <div className="bl-head"><b>{g.name}</b><span className="tag">{g.sub}</span><span className="muted num" style={{ fontSize: 12.5, marginLeft: 'auto' }}>{g.items.filter((i) => i.status === 'done').length}/{g.items.length} hechas</span></div>
            {g.items.length ? g.items.map((i) => (
              <div key={i.key} className="bl-row bl-row-sp">
                <span className="key">{i.key}</span>
                <Link href={`/t/${i.key}`} className="bl-title">{i.title}{i.epic_id && <small className="epic-chip">{epicName(i.epic_id)}</small>}</Link>
                <span className={'tag hide-s ' + (i.status === 'done' ? 'ok' : i.status === 'progress' ? 'v' : i.status === 'review' ? 'warn' : '')}>{STATUS[i.status]}</span>
                <span className={'prio ' + i.priority} title={PRIORITY[i.priority]} />
                {canEdit && openSprints.length > 0 ? <SprintPicker issue={i.key} value={openSprints.some((x) => x.id === i.sprint_id) ? i.sprint_id : null} sprints={openSprints.map((x) => ({ id: x.id, name: x.name }))} /> : <span />}
              </div>
            )) : <p className="muted" style={{ padding: '12px 16px', fontSize: 13 }}>{g.id === 'backlog' ? 'Todo está asignado a un sprint.' : 'Sin tareas. Pásale tareas desde el Backlog con el selector de cada fila.'}</p>}
          </div>
        ))}
      </div>
    ) : <Empty>Sin tareas todavía.</Empty>;
  } else if (tab === 'sprints') {
    const n = sprints.length + 1;
    const end = addDays(todayISO(), 14);
    body = (
      <div className="sprints">
        {flash}
        {sprints.length === 0 && <div className="callout">Un sprint es una entrega con fecha: eliges las tareas que harás en ese tiempo (normalmente 1 o 2 semanas), las trabajas en el tablero y al final lo cierras. Lo que no se terminó pasa al siguiente.</div>}
        {[...sprints].sort((a, b) => ({ active: 0, planned: 1, closed: 2 } as Record<string, number>)[a.state] - ({ active: 0, planned: 1, closed: 2 } as Record<string, number>)[b.state]).map((x) => {
          const stx = sprintStats(x.id);
          const left = daysLeft(x.end_date);
          const pending = stx.its.filter((i) => i.status !== 'done').length;
          return (
            <section key={x.id} className={'sprint-card ' + x.state}>
              <div className="sc-head">
                <div>
                  <div className="inline"><b>{x.name}</b><span className={'tag ' + (x.state === 'active' ? 'v' : x.state === 'closed' ? 'ok' : '')}>{x.state === 'active' ? 'Activo' : x.state === 'closed' ? 'Cerrado' : 'Planeado'}</span></div>
                  {x.goal && <p className="muted">{x.goal}</p>}
                </div>
                <span className="note num">{x.start_date ? fmtDate(x.start_date) : 'Sin inicio'} – {x.end_date ? fmtDate(x.end_date) : 'sin fin'}{x.state === 'active' && left !== null ? ` · ${left < 0 ? `vencido hace ${-left} d` : `${left} días restantes`}` : ''}</span>
              </div>
              <div className="sc-progress">
                <div className="bar"><i style={{ width: Math.max(stx.pct, 2) + '%', background: x.state === 'closed' ? 'var(--ok)' : p.color }} /></div>
                <span className="num muted">{stx.d} de {stx.its.length} tareas · {stx.pct}%</span>
              </div>
              {canEdit && x.state !== 'closed' && (
                <div className="sc-actions">
                  {x.state === 'planned' && <form action={startSprint}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="project" value={p.key} /><button className="pill solid mini" type="submit" disabled={!!activeSprint}>Empezar sprint</button></form>}
                  {x.state === 'active' && (
                    <form action={closeSprint} className="inline">
                      <input type="hidden" name="id" value={x.id} /><input type="hidden" name="project" value={p.key} />
                      {pending > 0 && <label className="note">{pending} sin terminar pasan a <select className="inp" name="dest" style={{ width: 'auto', display: 'inline-block', padding: '5px 8px' }}><option value="backlog">Backlog</option>{sprints.filter((y) => y.state === 'planned').map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>}
                      <button className="pill mini" type="submit">Cerrar sprint</button>
                    </form>
                  )}
                  <Link className="link" href={`/p/${p.key}?tab=tablero&sprint=${x.id}`}>Ver en el tablero</Link>
                  <Link className="link" href={`/p/${p.key}?tab=backlog`}>Agregar tareas</Link>
                </div>
              )}
            </section>
          );
        })}
        {canEdit && (
          <details className="panel add" open={sprints.length === 0}>
            <summary className="link" style={{ fontSize: 14 }}>+ Nuevo sprint</summary>
            <form className="form" action={createSprint}>
              <input type="hidden" name="project" value={p.key} />
              <div className="two"><label className="field">Nombre<input name="name" defaultValue={`Sprint ${n}`} required /></label><label className="field">Objetivo (qué se entrega)<input name="goal" placeholder="Ej. Pagos funcionando en producción" /></label></div>
              <div className="two"><label className="field">Inicio<input type="date" name="start" defaultValue={todayISO()} /></label><label className="field">Fin<input type="date" name="end" defaultValue={end} /></label></div>
              <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Crear sprint</button>
            </form>
          </details>
        )}
      </div>
    );
  } else if (tab === 'epicas') {
    body = (
      <div className="ep-cards">
        {eps.map((e) => {
          const its = all.filter((i) => i.epic_id === e.id);
          const d = its.filter((i) => i.status === 'done').length;
          const ep = its.length ? Math.round((d / its.length) * 100) : e.status === 'done' ? 100 : 0;
          const inProg = its.filter((i) => i.status === 'progress' || i.status === 'review').length;
          return (
            <details className="ep-card" key={e.id}>
              <summary>
                <div className="ep-card-main">
                  <span className="key">{e.key}</span>
                  <b>{e.name}</b>
                  {e.description && <p>{e.description}</p>}
                </div>
                <div className="ep-card-side">
                  <span className={'tag ' + (ep === 100 ? 'ok' : inProg ? 'v' : '')}>{ep === 100 ? 'Completa' : inProg ? 'En curso' : d ? 'Avanzando' : 'Sin empezar'}</span>
                  {(e.start_date || e.end_date) && <span className="note num">{fmtDate(e.start_date)} – {fmtDate(e.end_date)}</span>}
                </div>
                <div className="ep-card-bar">
                  <div className="bar"><i style={{ width: Math.max(ep, 2) + '%', background: ep === 100 ? 'var(--ok)' : p.color }} /></div>
                  <span className="num muted">{ep}% · {d} de {its.length}</span>
                </div>
              </summary>
              <div className="ep-card-list">
                {its.length ? its.map((i) => (
                  <Link key={i.key} href={`/t/${i.key}`} className="bl-row">
                    <span className="key">{i.key}</span><span style={{ overflowWrap: 'anywhere' }}>{i.title}</span>
                    <span className={'tag hide-s ' + (i.status === 'done' ? 'ok' : i.status === 'progress' ? 'v' : i.status === 'review' ? 'warn' : '')}>{STATUS[i.status]}</span>
                    <span className={'prio ' + i.priority} />
                  </Link>
                )) : <p className="muted" style={{ padding: '10px 16px' }}>Esta épica no tiene tareas.</p>}
              </div>
            </details>
          );
        })}
        {canEdit && (
          <details className="panel add">
            <summary className="link" style={{ fontSize: 14 }}>+ Nueva épica</summary>
            <form className="form" action={createEpic}>
              <input type="hidden" name="project" value={p.key} />
              <label className="field">Nombre<input name="name" required /></label>
              <label className="field">Para qué es<input name="description" /></label>
              <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Crear épica</button>
            </form>
          </details>
        )}
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
      <div className="proj-head" style={{ ['--pc' as string]: p.color }}>
        {canEdit ? <ImageUpload kind="logo" folder={p.id} project={p.id} label={p.logo_url ? 'Cambiar logo' : 'Poner logo'} className="proj-logo-up"><ProjectMark p={p} size={56} radius={16} /></ImageUpload> : <ProjectMark p={p} size={56} radius={16} />}
        <div className="proj-title">
          <div className="label">{space.name}{space.role === 'partner' ? ' · espacio compartido' : ''} · {p.key}</div>
          <h1>{p.name}</h1>
          {p.description && <p>{p.description}</p>}
        </div>
        <div className="proj-actions">
          <span className="tag v" style={{ padding: '6px 12px' }}>{p.status_label}</span>
          <div className="avatars" title={people.map((x) => x.name).join(', ')}>{people.slice(0, 4).map((x) => <Avatar key={x.id} name={x.name} url={x.avatar} size={28} />)}</div>
          {canEdit && <Link className="pill solid" href={`/nuevo/tarea?proyecto=${p.key}`}>Nueva tarea</Link>}
        </div>
      </div>
      <nav className="tabs">{tabs.map(([t, l]) => <Link key={t} className="tab" href={`/p/${p.key}?tab=${t}`} aria-current={t === tab ? 'page' : undefined}>{l}{t === 'tablero' && <span className="tab-n num">{all.length - done}</span>}</Link>)}</nav>
      {body}
    </>
  );
}
