import Link from 'next/link';
import { getContext } from '@/lib/data';
import { DAYS, hhmm } from '@/lib/format';
import { IssueRow, ViewHead } from '@/components/bits';

export const metadata = { title: 'Mi espacio' };

export default async function Personal() {
  const { supabase, spaces } = await getContext();
  const personal = spaces.find((s) => s.kind === 'personal');
  if (!personal) return <p className="muted">No tienes espacio personal.</p>;
  const [{ data: blocks }, { data: dbs }, { data: issues }] = await Promise.all([
    supabase.from('schedule_blocks').select('*').eq('space_id', personal.id).order('start_time'),
    supabase.from('user_databases').select('id, name, properties').eq('space_id', personal.id).order('position'),
    supabase.from('issues').select('key, title, status, priority, due_date, project_id').in('project_id', personal.projects.map((p) => p.id)).neq('status', 'done'),
  ]);
  const materias = dbs?.find((d) => d.name === 'Materias');
  const { data: rows } = materias ? await supabase.from('user_db_rows').select('values').eq('database_id', materias.id).order('position') : { data: [] };
  const study = (blocks ?? []).filter((b) => b.kind === 'study');
  const hours = study.reduce((a, b) => {
    const [h1, m1] = b.start_time.split(':').map(Number); const [h2, m2] = b.end_time.split(':').map(Number);
    return a + ((h2 * 60 + m2 - h1 * 60 - m1) / 60) * b.weekdays.length;
  }, 0);

  return (
    <>
      <ViewHead label="Espacio personal · solo tú lo ves" title="Mi" accent="espacio" text="Universidades, estudio y horario, aparte del trabajo." />
      <div className="stat-row">
        <div className="stat"><span className="label">Materias</span><b className="num">{rows?.length ?? 0}</b><span>{rows?.filter((r: any) => r.values.estado === 'Cursando').length ?? 0} cursando</span></div>
        <div className="stat"><span className="label">Estudio</span><b className="num">{String(Math.round(hours * 100) / 100).replace('.', ',')} h</b><span>planeadas a la semana</span></div>
        <div className="stat"><span className="label">Pendientes</span><b className="num">{issues?.length ?? 0}</b><span>trámites y entregas</span></div>
        <div className="stat"><span className="label">Bases propias</span><b className="num">{dbs?.length ?? 0}</b><span>tablas a tu medida</span></div>
      </div>
      <div className="grid g-home">
        <section className="panel">
          <div className="panel-head"><h2>Materias</h2>{materias && <Link className="link" href={`/personal/bases?db=${materias.id}`}>Editar</Link>}</div>
          <div className="list">
            {(rows ?? []).map((r: any, i: number) => (
              <div className="row" key={i}>
                <span className={'tag ' + (r.values.universidad === 'UV' ? 'bad' : 'warn')}>{r.values.universidad}</span>
                <div className="t"><b>{r.values.materia}</b><span>{r.values.horario}</span></div>
                <span className={'tag ' + (r.values.estado === 'Cursando' ? 'ok' : '')}>{r.values.estado}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Plan de estudio</h2><Link className="link" href="/calendario">Calendario</Link></div>
          <div className="list">
            {study.map((b) => (
              <div className="row" key={b.id}><span className="tag v">Estudio</span><div className="t"><b>{b.title}</b><span>{b.weekdays.map((d: number) => DAYS[d - 1].slice(0, 3)).join(', ')} · {hhmm(b.start_time)} – {hhmm(b.end_time)}</span></div><span /></div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Pendientes personales</h2><Link className="link" href="/nuevo/tarea?proyecto=UNI">Nueva</Link></div>
        {issues?.length ? <div className="list">{issues.map((i) => <IssueRow key={i.key} issue={i} />)}</div> : <p className="muted">Nada pendiente.</p>}
      </section>
    </>
  );
}
