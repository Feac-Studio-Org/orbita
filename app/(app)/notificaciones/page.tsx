import Link from 'next/link';
import { getContext } from '@/lib/data';
import { ViewHead } from '@/components/bits';
import { markAllRead } from '@/lib/actions';

export const metadata = { title: 'Notificaciones' };

export default async function Notifications() {
  const { supabase, user } = await getContext();
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
          const href = n.link?.issue ? `/t/${n.link.issue}` : n.link?.path ?? '#';
          return <Link key={n.id} href={href} className="row"><span className="dot" style={{ background: n.read_at ? 'transparent' : 'var(--violet-hi)', border: '1px solid var(--line-2)', borderRadius: '50%' }} /><div className="t"><b>{n.title}</b><span>{new Date(n.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })}</span></div><span /></Link>;
        })}</div> : <p className="muted">No tienes avisos.</p>}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Actividad reciente</h2></div>
        {activity?.length ? <div className="list">{activity.map((a, n) => (
          <div className="row" key={n}><span className="tag">{a.actor_kind === 'assistant' ? 'Asistente' : a.actor_kind === 'system' ? 'Sistema' : 'Persona'}</span><div className="t"><b>{a.summary}</b></div><span className="note num">{a.created_at.slice(0, 10)}</span></div>
        ))}</div> : <p className="muted">Sin actividad.</p>}
      </section>
    </>
  );
}
