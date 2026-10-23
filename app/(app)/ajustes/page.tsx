import { getContext } from '@/lib/data';
import { ViewHead } from '@/components/bits';
import { saveModules } from '@/lib/actions';

export const metadata = { title: 'Ajustes' };

const MODS = [
  ['messages', 'Mensajes', 'Canales por espacio y proyecto. Si trabajas solo, apágalo.'],
  ['finance', 'Finanzas', 'Gastos, suscripciones e ingresos, separados por espacio y por proyecto.'],
  ['assistant', 'Asistente (MCP)', 'Conecta la IA que prefieras para que lea y actualice tus espacios.'],
  ['calendar', 'Calendario', 'Semana con tu horario y, si lo conectas, Google Calendar.'],
  ['bases', 'Bases de datos propias', 'Tablas a tu medida en tu espacio personal.'],
] as const;

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const { spaces, modules } = await getContext();
  const own = spaces.filter((s) => s.role === 'owner');
  return (
    <>
      <ViewHead label="Tu cuenta" title="Ajustes" text="Activa solo lo que usas. Lo que apagas desaparece de la barra sin borrar sus datos." />
      {ok && <p className="ok-msg" role="status">{ok}</p>}
      <form className="form" action={saveModules}>
        <section className="panel">
          <div className="panel-head"><h2>Módulos</h2></div>
          <div>{MODS.map(([k, t, d]) => (
            <label key={k} className="toggle-row"><div><b>{t}</b><span>{d}</span></div><input type="checkbox" name={k} defaultChecked={modules[k]} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} /></label>
          ))}</div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Por espacio</h2><span className="label">Solo los espacios donde eres dueño</span></div>
          {own.map((s) => (
            <div key={s.id}>
              <input type="hidden" name="space" value={s.id} />
              <span className="label">{s.name}</span>
              {(s.kind === 'personal' ? [['finance', 'Finanzas personales', 'Tus gastos, aparte de los de cualquier espacio.']] : [
                ['portfolio', 'Portafolio', 'Resumen de todos los proyectos del espacio.'],
                ['finance', 'Finanzas del espacio', 'Costos del espacio y de cada proyecto.'],
                ['members', 'Miembros y roles', 'Quién ve cada proyecto.'],
              ]).map(([k, t, d]) => (
                <label key={k} className="toggle-row"><div><b>{t}</b><span>{d}</span></div><input type="checkbox" name={`${s.id}:${k}`} defaultChecked={(s.modules as any)[k] !== false && (k !== 'portfolio' || !!s.modules.portfolio)} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} /></label>
              ))}
            </div>
          ))}
        </section>
        <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar ajustes</button>
      </form>
    </>
  );
}
