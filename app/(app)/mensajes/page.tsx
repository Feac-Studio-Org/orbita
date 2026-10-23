import Link from 'next/link';
import { getContext } from '@/lib/data';
import { initial } from '@/lib/format';
import { Empty, ViewHead } from '@/components/bits';
import { createChannel, endCall, sendMessage, startCall } from '@/lib/actions';

export const metadata = { title: 'Mensajes' };

export default async function Messages({ searchParams }: { searchParams: Promise<{ canal?: string; error?: string }> }) {
  const { canal, error } = await searchParams;
  const { supabase, spaces } = await getContext();
  const { data: channels } = await supabase.from('channels').select('id, name, space_id, project_id').order('name');
  const current = channels?.find((c) => c.id === canal) ?? channels?.[0];
  const { data: msgs } = current ? await supabase.from('messages').select('id, body, author_id, author_kind, created_at').eq('channel_id', current.id).order('created_at').limit(200) : { data: [] };
  const ids = [...new Set((msgs ?? []).map((m) => m.author_id).filter(Boolean))];
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids) : { data: [] as { id: string; full_name: string }[] };
  const teams = spaces.filter((s) => s.kind === 'team');
  const since = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
  const { data: calls } = current ? await supabase.from('calls').select('id, room, started_by, started_at').eq('channel_id', current.id).is('ended_at', null).gte('started_at', since).order('started_at', { ascending: false }) : { data: [] };
  const { data: me } = await supabase.from('profiles').select('full_name').eq('id', (await supabase.auth.getUser()).data.user!.id).single();
  const meetUrl = (room: string) => `https://meet.jit.si/${room}#userInfo.displayName=${encodeURIComponent(JSON.stringify(me?.full_name ?? ''))}&config.prejoinConfig.enabled=false`;

  return (
    <>
      <ViewHead label="Equipo" title="Mensajes" text="Un canal por espacio o proyecto. Solo lo ven quienes tienen acceso." />
      <div className="docs">
        <nav className="tree">
          {teams.map((s) => {
            const list = (channels ?? []).filter((c) => c.space_id === s.id);
            return (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="label" style={{ padding: '8px 10px 4px' }}>{s.name}</span>
                {list.map((c) => <Link key={c.id} href={`/mensajes?canal=${c.id}`} aria-current={c.id === current?.id ? 'page' : undefined}># {c.name}</Link>)}
                {['owner', 'partner', 'member'].includes(s.role) && (
                  <details className="add" style={{ padding: '4px 10px' }}><summary className="link">+ Canal</summary>
                    <form className="form" action={createChannel}><input type="hidden" name="space" value={s.id} /><input className="inp" name="name" placeholder="nombre-del-canal" required /><button className="pill mini" type="submit">Crear</button></form>
                  </details>
                )}
              </div>
            );
          })}
        </nav>
        {current ? (
          <section className="panel" style={{ minHeight: 420 }}>
            <div className="panel-head"><h2># {current.name}</h2>
              <form action={startCall}><input type="hidden" name="channel" value={current.id} /><button className="pill" type="submit"><span className="pill__dot" />Iniciar llamada</button></form>
            </div>
            {error && <p className="err" role="alert">{error}</p>}
            {calls?.map((c) => (
              <div key={c.id} className="callout inline" style={{ justifyContent: 'space-between' }}>
                <div><b>Llamada en curso</b><div className="note">Desde las {new Date(c.started_at).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })} · voz, video y pantalla compartida</div></div>
                <div className="inline">
                  <a className="pill solid" href={meetUrl(c.room)} target="_blank" rel="noreferrer">Unirme</a>
                  <form action={endCall}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="channel" value={current.id} /><button className="pill mini" type="submit">Terminar</button></form>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              {msgs?.length ? msgs.map((m) => {
                const who = m.author_kind === 'assistant' ? 'Asistente' : people?.find((p) => p.id === m.author_id)?.full_name ?? 'Alguien';
                return (
                  <div key={m.id} className="comment" style={{ borderTop: 0, padding: 0 }}>
                    <span className="avatar">{m.author_kind === 'assistant' ? 'IA' : initial(who)}</span>
                    <div><div className="who">{who}<span>{new Date(m.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })}</span></div><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</p></div>
                  </div>
                );
              }) : <p className="muted">Todavía no hay mensajes en este canal.</p>}
            </div>
            <form action={sendMessage} className="inline"><input type="hidden" name="channel" value={current.id} /><input className="inp" name="body" placeholder={`Escribe en # ${current.name}`} required autoComplete="off" /><button className="pill solid" type="submit">Enviar</button></form>
          </section>
        ) : <Empty>No tienes canales todavía.</Empty>}
      </div>
    </>
  );
}
