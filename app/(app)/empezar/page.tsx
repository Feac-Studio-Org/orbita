import { getContext } from '@/lib/data';
import { finishOnboarding } from '@/lib/actions';

export const metadata = { title: 'Bienvenida' };

const TOOLS = [
  ['tasks', 'Tareas', 'Pendientes con fecha límite, por listas (universidad, casa, trámites). Te avisa antes de que se venzan.'],
  ['habits', 'Hábitos', 'Lo que quieres hacer seguido: ejercicio, leer, estudiar. Márcalo cada día, solo o en grupo con amigos.'],
  ['projects', 'Proyectos', 'Trabajo en equipo: tableros, documentos y, si los necesitas, sprints y épicas.'],
  ['goals', 'Metas', 'Lo que quieres lograr, con fecha y avance.'],
  ['calendar', 'Calendario', 'Tu horario de la semana, tus eventos y tus plazos, con recordatorios.'],
  ['notes', 'Notas', 'Apuntes e ideas, por carpetas.'],
  ['review', 'Revisión', 'Cuánto cumpliste por día, semana o rango de fechas.'],
  ['finance', 'Finanzas', 'Gastos, suscripciones e ingresos.'],
  ['bases', 'Bases de datos', 'Tablas a tu medida, por ejemplo tus materias.'],
] as const;

/** Primera vez: la persona elige para qué usa Órbita. Se puede cambiar después en Ajustes. */
export default async function Welcome() {
  const { profile, user, modules } = await getContext();
  const first = (profile?.full_name || user.email || '').split(' ')[0];
  return (
    <div className="onb">
      <div className="label">Bienvenida</div>
      <h1>Hola, <span className="serif violet">{first}</span>. ¿Para qué vas a usar Órbita?</h1>
      <p className="muted">Marca una o varias. Solo verás lo que elijas, y puedes cambiarlo cuando quieras en Ajustes.</p>
      <form className="form" action={finishOnboarding}>
        <div className="onb-grid">
          {TOOLS.map(([k, t, d]) => (
            <label key={k} className="onb-opt">
              <input type="checkbox" name={k} defaultChecked={['tasks', 'habits', 'calendar', 'goals', 'notes', 'review'].includes(k) || (k === 'projects' && modules.projects)} />
              <span><b>{t}</b><small>{d}</small></span>
            </label>
          ))}
        </div>
        <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Empezar</button>
      </form>
    </div>
  );
}
