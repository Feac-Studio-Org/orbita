import Link from 'next/link';
import { getContext } from '@/lib/data';
import { Empty } from '@/components/bits';
import { Avatar } from '@/components/avatar';
import { ChatRoom } from '@/components/chat';
import { createChannel, endCall, startCall } from '@/lib/actions';

export const metadata = { title: 'Mensajes' };

export default async function Messages({ searchParams }: { searchParams: Promise<{ canal?: string; error?: string }> }) {
  const { canal, error } = await searchParams;
  const { supabase, spaces, projects, user, profile } = await getContext();
  const { data: channels } = await supabase.from('channels').select('id, name, space_id, project_id').order('name');
  const current = channels?.find((c) => c.id === canal) ?? channels?.[0];
  const teams = spaces.filter((s) => s.kind === 'team');
  const since = new Date(Date.now() - 4 * 3600 * 1000).toISOString();

  const [{ data: msgs }, { data: calls }, { data: sm }, { data: pa }] = current ? await Promise.all([
    supabase.from('messages').select('id, body, author_id, author_kind, created_at').eq('channel_id', current.id).order('created_at', { ascending: false }).limit(150),
    supabase.from('calls').select('id, room, started_by, started_at').eq('channel_id', current.id).is('ended_at', null).gte('started_at', since).order('started_at', { ascending: false }),
    supabase.from('space_members').select('user_id, role').eq('space_id', current.space_id),
    current.project_id ? supabase.from('project_access').select('user_id').eq('project_id', current.project_id) : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const access = new Set((pa ?? []).map((a) => a.user_id));
  const memberIds = (sm ?? []).filter((m) => !current?.project_id || ['owner', 'partner'].includes(m.role) || access.has(m.user_id)).map((m) => m.user_id);
  const ids = [...new Set([...memberIds, ...(msgs ?? []).map((m) => m.author_id).filter(Boolean)])] as string[];
  const { data: profs } = ids.length ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids) : { data: [] };
  const people = (profs ?? []).map((p) => ({ id: p.id, name: p.full_name || 'Sin nombre', avatar: p.avatar_url }));
  const members = people.filter((p) => memberIds.includes(p.id));
  const meetUrl = (room: string) => `https://meet.jit.si/${room}#userInfo.displayName=${encodeURIComponent(JSON.stringify(profile?.full_name ?? ''))}&config.prejoinConfig.enabled=false`;
  const projectOf = (pid: string | null) => projects.find((p) => p.id === pid);
  const where = current ? (projectOf(current.project_id)?.name ?? spaces.find((s) => s.id === current.space_id)?.name ?? '') : '';

  return (
    <div className="chat">
      <aside className="chat-side">
        <div className="chat-side-head"><h1>Mensajes</h1></div>
        <div className="chat-channels">
          {teams.map((s) => {
            const list = (channels ?? []).filter((c) => c.space_id === s.id);
            return (
              <div key={s.id} className="chat-group">
                <span className="label">{s.name}</span>
                {list.map((c) => {
                  const pr = projectOf(c.project_id);
                  return (
                    <Link key={c.id} href={`/mensajes?canal=${c.id}`} className="chat-ch" aria-current={c.id === current?.id ? 'page' : undefined}>
                      <span className="hash" style={pr ? { color: pr.color } : undefined}>#</span>
                      <span className="chat-ch-name">{c.name}</span>
                      {pr && <span className="key">{pr.key}</span>}
                    </Link>
                  );
                })}
                {!list.length && <span className="note" style={{ padding: '2px 10px' }}>Sin canales</span>}
                {['owner', 'partner', 'member'].includes(s.role) && (
                  <details className="chat-new"><summary>+ Nuevo canal</summary>
                    <form className="form" action={createChannel}><input type="hidden" name="space" value={s.id} /><input className="inp" name="name" placeholder="nombre-del-canal" required /><button className="pill mini" type="submit">Crear</button></form>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {current ? (
        <section className="chat-main">
          <header className="chat-head">
            <div className="chat-title">
              <h2># {current.name}</h2>
              <span className="note">{where} · {members.length} {members.length === 1 ? 'persona' : 'personas'}</span>
            </div>
            <div className="avatars hide-s" title={members.map((m) => m.name).join(', ')}>{members.slice(0, 5).map((m) => <Avatar key={m.id} name={m.name} url={m.avatar} size={28} />)}</div>
            <form action={startCall}><input type="hidden" name="channel" value={current.id} /><button className="pill" type="submit">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 2.5h2.5l1.2 3-1.5 1a7 7 0 0 0 4.3 4.3l1-1.5 3 1.2V13a1 1 0 0 1-1 1A11 11 0 0 1 2 3.5a1 1 0 0 1 1-1Z" /></svg>
              Llamar</button></form>
          </header>
          {error && <p className="err" role="alert" style={{ margin: '10px 20px 0' }}>{error}</p>}
          {calls?.map((c) => (
            <div key={c.id} className="call-bar">
              <span className="live-dot" />
              <div><b>Llamada en curso</b><span className="note"> · desde las {new Date(c.started_at).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })} · voz, video y pantalla</span></div>
              <a className="pill solid mini" href={meetUrl(c.room)} target="_blank" rel="noreferrer">Unirme</a>
              <form action={endCall}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="channel" value={current.id} /><button className="pill mini" type="submit">Terminar</button></form>
            </div>
          ))}
          <ChatRoom key={current.id} channelId={current.id} channelName={current.name} initial={(msgs ?? []).slice().reverse()} people={people} me={user.id} />
        </section>
      ) : <section className="chat-main"><Empty>No tienes canales todavía. Crea uno en un espacio de equipo.</Empty></section>}
    </div>
  );
}
