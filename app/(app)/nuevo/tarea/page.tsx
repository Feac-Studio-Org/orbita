import { getContext } from '@/lib/data';
import { PRIORITY } from '@/lib/format';
import { ViewHead } from '@/components/bits';
import { createIssue } from '@/lib/actions';

export const metadata = { title: 'Nueva tarea' };

export default async function NewIssue({ searchParams }: { searchParams: Promise<{ proyecto?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, spaces, projects } = await getContext();
  const current = projects.find((p) => p.key === sp.proyecto?.toUpperCase()) ?? projects[0];
  const { data: epics } = current ? await supabase.from('epics').select('id, name').eq('project_id', current.id).neq('status', 'done').order('position') : { data: [] };
  return (
    <>
      <ViewHead label="Trabajo" title="Nueva" accent="tarea" text="Va al proyecto que elijas, dentro de su épica." />
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      {projects.length ? (
        <form className="panel form" action={createIssue} style={{ maxWidth: 720 }}>
          <label className="field">Qué hay que hacer<input name="title" required autoFocus placeholder="Ej.: Probar el flujo de pagos en sandbox" /></label>
          <div className="two">
            <label className="field">Proyecto
              <select name="project" defaultValue={current?.key}>
                {spaces.filter((s) => s.projects.length).map((s) => <optgroup key={s.id} label={s.name}>{s.projects.map((p) => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}</optgroup>)}
              </select>
            </label>
            <label className="field">Épica de {current?.name}
              <select name="epic_id" defaultValue=""><option value="">Sin épica</option>{epics?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </label>
          </div>
          <div className="two">
            <label className="field">Prioridad<select name="priority" defaultValue="medium">{Object.entries(PRIORITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="field">Fecha<input type="date" name="due_date" /></label>
          </div>
          <label className="field">Descripción<textarea name="description" placeholder="Qué hay que hacer y cómo saber que quedó listo." /></label>
          <p className="note">Si cambias de proyecto, las épicas se actualizan al abrir esta página desde ese proyecto.</p>
          <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Crear tarea</button>
        </form>
      ) : <p className="muted">Primero crea un proyecto.</p>}
    </>
  );
}
