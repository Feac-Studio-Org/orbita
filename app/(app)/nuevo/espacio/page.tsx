import { ViewHead } from '@/components/bits';
import { createSpace, joinWithCode } from '@/lib/actions';

export const metadata = { title: 'Crear un espacio' };

export default async function NewSpace({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <ViewHead label="Espacios" title="Crear o unirse a un" accent="espacio" text="Un espacio agrupa personas alrededor de algo: un equipo con sus proyectos o un grupo que sigue sus hábitos junto. Elige la plantilla y Órbita lo arma." />
      {error && <p className="err" role="alert">{error}</p>}
      <div className="grid g-2">
        <form className="panel form" action={createSpace}>
          <div className="panel-head"><h2>Crear espacio</h2></div>
          <fieldset className="tpl" style={{ border: 0 }}>
            <legend className="label" style={{ marginBottom: 8 }}>Plantilla</legend>
            <label className="tpl-opt"><input type="radio" name="template" value="team" defaultChecked /><span><b>Equipo de trabajo</b><small>Proyectos con tableros, sprints, documentación, finanzas y mensajes.</small></span></label>
            <label className="tpl-opt"><input type="radio" name="template" value="habits" /><span><b>Hábitos en comunidad</b><small>Cada uno pone sus hábitos, se ven el avance del día, se animan y siguen su constancia juntos.</small></span></label>
          </fieldset>
          <label className="field">Nombre<input name="name" required maxLength={80} placeholder="Ej.: Proyecto de grado o Track-FMJ" /></label>
          <label className="field">Descripción<input name="description" placeholder="Una línea" /></label>
          <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Crear espacio</button>
        </form>
        <form className="panel form" action={joinWithCode}>
          <div className="panel-head"><h2>Unirse con un código</h2></div>
          <p className="muted" style={{ fontSize: 13.5 }}>El dueño del espacio te da el código desde Miembros y roles.</p>
          <label className="field">Código<input name="code" required placeholder="Ej.: 7K2QF91A0C" style={{ textTransform: 'uppercase' }} /></label>
          <button className="pill" type="submit" style={{ alignSelf: 'flex-start' }}>Unirme</button>
        </form>
      </div>
    </>
  );
}
