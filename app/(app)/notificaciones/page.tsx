import { getContext } from '@/lib/data';
import { ViewHead } from '@/components/bits';
import { markAllRead, openNotification, saveNotificationPrefs } from '@/lib/actions';

const KINDS: [string, string][] = [['comment', 'Comentarios en tareas que sigues'], ['status', 'Cambios de estado'], ['assigned', 'Tareas que te asignan'], ['due', 'Vencimientos (hoy y mañana, a las 7:00)'], ['message', 'Mensajes en tus canales'], ['call', 'Llamadas'], ['billing', 'Cobros de suscripciones (3 días antes)'], ['member', 'Alguien se unió a tu espacio']];

export const metadata = { title: 'Notificaciones' };

export default async function Notifications({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const { supabase, user } = await getContext();
  const { data: prefs } = await supabase.from('notification_prefs').select('*').eq('user_id', user.id);
  const pref = (k: string, f: 'in_app' | 'push') => prefs?.find((p) => p.kind === k)?.[f] ?? true;
  const [{ data: items }, { data: activity }] = await Promise.all([
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('activity_log').select('summary, actor_kind, created_at, space_id').order('created_at', { ascending: false }).limit(20),
  ]);
  return (
    <>
      <ViewHead label="Todo en un lugar" title="Notificaciones" text="Avisos para ti y la actividad reciente de tus espacios.">
        {!!items?.some((n) => !n.read_at) && <form action={markAllRead}><button className="pill" type="submit">Marcar todo como leído</button></form>}
      </ViewHead>
      <section className="panel">
        <div className="panel-head"><h2>Para ti</h2></div>
        {items?.length ? <div className="list">{items.map((n) => {
          const href = n.link?.issue ? `/t/${n.link.issue}` : n.link?.channel ? `/mensajes?canal=${n.link.channel}` : n.link?.path ?? '/notificaciones';
          return (
            <form key={n.id} action={openNotification}>
              <input type="hidden" name="id" value={n.id} /><input type="hidden" name="href" value={href} />
              <button type="submit" className="row" style={{ width: '100%', textAlign: 'left' }}><span className="dot" style={{ background: n.read_at ? 'transparent' : 'var(--violet-hi)', border: '1px solid var(--line-2)', borderRadius: '50%' }} /><div className="t"><b style={{ fontWeight: n.read_at ? 400 : 600 }}>{n.title}</b><span>{new Date(n.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })}</span></div><span /></button>
            </form>
          );
        })}</div> : <p className="muted">No tienes avisos.</p>}
      </section>
      {ok && <p className="ok-msg" role="status">{ok}</p>}
      <form className="panel form" action={saveNotificationPrefs}>
        <div className="panel-head"><h2>Qué te llega</h2><span className="label">Órbita · Celular</span></div>
        <div className="table-wrap" style={{ border: 0 }}><table className="t keep"><thead><tr><th>Aviso</th><th>En Órbita</th><th>En el celular</th></tr></thead><tbody>
          {KINDS.map(([k, l]) => (
            <tr key={k}><td><input type="hidden" name="kind" value={k} />{l}</td>
              <td><input type="checkbox" name={`app:${k}`} defaultChecked={pref(k, 'in_app')} aria-label={`${l} en Órbita`} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} /></td>
              <td><input type="checkbox" name={`push:${k}`} defaultChecked={pref(k, 'push')} aria-label={`${l} en el celular`} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} /></td></tr>
          ))}
        </tbody></table></div>
        <p className="note">En el celular, la app de Órbita muestra el aviso mientras esté abierta o en segundo plano.</p>
        <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar</button>
      </form>
      <section className="panel">
        <div className="panel-head"><h2>Actividad reciente</h2></div>
        {activity?.length ? <div className="list">{activity.map((a, n) => (
          <div className="row" key={n}><span className="tag">{a.actor_kind === 'assistant' ? 'Asistente' : a.actor_kind === 'system' ? 'Sistema' : 'Persona'}</span><div className="t"><b>{a.summary}</b></div><span className="note num">{a.created_at.slice(0, 10)}</span></div>
        ))}</div> : <p className="muted">Sin actividad.</p>}
      </section>
    </>
  );
}
