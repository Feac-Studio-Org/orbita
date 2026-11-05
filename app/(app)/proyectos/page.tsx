import Link from 'next/link';
import { getContext } from '@/lib/data';
import { ProjectMark } from '@/components/project-mark';
import { Empty, ViewHead } from '@/components/bits';

export const metadata = { title: 'Proyectos' };

export default async function Projects() {
  const { supabase, spaces } = await getContext();
  const withProjects = spaces.filter((s) => s.projects.length);
  const { data: counts } = await supabase.from('issues').select('project_id, status');
  const prog = (id: string) => {
    const all = (counts ?? []).filter((c) => c.project_id === id);
    return { total: all.length, pct: all.length ? Math.round((all.filter((c) => c.status === 'done').length / all.length) * 100) : 0 };
  };
  return (
    <>
      <ViewHead label="Tu trabajo" title="Proyectos" text="Cada proyecto dentro de su espacio." />
      {withProjects.length ? withProjects.map((s) => (
        <section className="panel" key={s.id}>
          <div className="panel-head"><h2>{s.name}</h2></div>
          <div className="projects">
            {s.projects.map((p) => {
              const pr = prog(p.id);
              return (
                <Link key={p.key} href={`/p/${p.key}`} className="proj">
                  <div className="proj-top">
                    <ProjectMark p={p} size={34} />
                    <div style={{ minWidth: 0 }}><b>{p.name}</b><span>{p.description}</span></div>
                  </div>
                  <span className="tag v" style={{ alignSelf: 'flex-start' }}>{p.status_label}</span>
                  <div className="bar"><i style={{ width: Math.max(pr.pct, 3) + '%', background: p.color }} /></div>
                  <div className="proj-foot"><span className="num">{pr.pct}% hecho</span><span className="num">{pr.total} tareas</span></div>
                </Link>
              );
            })}
          </div>
        </section>
      )) : <Empty action={<Link className="pill" href="/nuevo/espacio">Crear un espacio</Link>}>Todavía no tienes proyectos.</Empty>}
    </>
  );
}
