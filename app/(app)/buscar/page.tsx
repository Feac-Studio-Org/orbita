import Link from 'next/link';
import { getContext } from '@/lib/data';
import { IssueRow, ViewHead } from '@/components/bits';

export const metadata = { title: 'Buscar' };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  const { supabase, projects } = await getContext();
  const like = `%${q.replace(/[%_,().*\\]/g, ' ').trim()}%`;
  const [{ data: issues }, { data: docs }] = q.length >= 2 ? await Promise.all([
    supabase.from('issues').select('key, title, status, priority, due_date, project_id').or(`title.ilike.${like},key.ilike.${like},description.ilike.${like}`).limit(30),
    supabase.from('doc_pages').select('id, title, project_id').or(`title.ilike.${like},body.ilike.${like}`).limit(20),
  ]) : [{ data: [] }, { data: [] }];
  const ps = q.length >= 2 ? projects.filter((p) => (p.name + ' ' + p.key + ' ' + p.description).toLowerCase().includes(q.toLowerCase())) : [];
  const pname = (id: string | null) => projects.find((p) => p.id === id);
  const total = (issues?.length ?? 0) + (docs?.length ?? 0) + ps.length;
  return (
    <>
      <ViewHead label="Buscar" title={q ? `«${q}»` : 'Buscar'} text={q.length >= 2 ? `${total} resultados en tareas, proyectos y documentos.` : 'Escribe al menos dos letras.'} />
      {ps.length > 0 && <section className="panel"><div className="panel-head"><h2>Proyectos</h2></div><div className="list">{ps.map((p) => <Link key={p.id} href={`/p/${p.key}`} className="row"><span className="proj-mark" style={{ width: 28, height: 28, background: p.color + '22', color: p.color }}>{p.key.slice(0, 3)}</span><div className="t"><b>{p.name}</b><span>{p.description}</span></div><span /></Link>)}</div></section>}
      {!!issues?.length && <section className="panel"><div className="panel-head"><h2>Tareas</h2></div><div className="list">{issues.map((i) => <IssueRow key={i.key} issue={i} project={pname(i.project_id)?.name} />)}</div></section>}
      {!!docs?.length && <section className="panel"><div className="panel-head"><h2>Documentos</h2></div><div className="list">{docs.map((d) => { const p = pname(d.project_id); return <Link key={d.id} href={p ? `/p/${p.key}?tab=documentos&doc=${d.id}` : '/'} className="row"><span className="tag">Doc</span><div className="t"><b>{d.title}</b><span>{p?.name}</span></div><span /></Link>; })}</div></section>}
    </>
  );
}
