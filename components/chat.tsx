'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from './avatar';

export type Msg = { id: string; body: string; author_id: string | null; author_kind: string; created_at: string };
type Person = { id: string; name: string; avatar: string | null };

const TZ = 'America/Bogota';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
function dayLabel(iso: string) {
  const k = dayKey(iso);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const yest = new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: TZ });
  if (k === today) return 'Hoy';
  if (k === yest) return 'Ayer';
  return new Date(iso).toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
}
const time = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

export function ChatRoom({ channelId, channelName, initial, people, me }: { channelId: string; channelName: string; initial: Msg[]; people: Person[]; me: string }) {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [known, setKnown] = useState(people);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const supabase = useRef(createClient()).current;

  useEffect(() => { setMsgs(initial); }, [initial]);

  // Mensajes nuevos en vivo.
  useEffect(() => {
    const ch = supabase.channel('chat-' + channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, async (payload) => {
        const m = payload.new as Msg;
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur.filter((x) => !(x.id.startsWith('tmp-') && x.body === m.body && x.author_id === m.author_id)), m]));
        if (m.author_id && !known.some((p) => p.id === m.author_id)) {
          const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', m.author_id).single();
          if (data) setKnown((k) => [...k, { id: data.id, name: data.full_name || 'Alguien', avatar: data.avatar_url }]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channelId, supabase, known]);

  // Bajar al último mensaje.
  useLayoutEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, channelId]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText(''); setError('');
    const tmp: Msg = { id: 'tmp-' + Date.now(), body, author_id: me, author_kind: 'user', created_at: new Date().toISOString() };
    setMsgs((cur) => [...cur, tmp]);
    const { data, error } = await supabase.from('messages').insert({ channel_id: channelId, author_id: me, body }).select('id, body, author_id, author_kind, created_at').single();
    if (error) { setError('No se pudo enviar: ' + error.message); setMsgs((cur) => cur.filter((x) => x.id !== tmp.id)); setText(body); return; }
    setMsgs((cur) => (cur.some((x) => x.id === data.id) ? cur.filter((x) => x.id !== tmp.id) : cur.map((x) => (x.id === tmp.id ? data : x))));
    box.current?.focus();
  }

  const who = (m: Msg) => m.author_kind === 'assistant' ? { name: 'Asistente', avatar: null } : known.find((p) => p.id === m.author_id) ?? { name: 'Alguien', avatar: null };

  return (
    <>
      <div className="chat-list" ref={list}>
        {!msgs.length && (
          <div className="chat-empty">
            <b>{channelName}</b>
            <p>Este es el comienzo de la conversación. Escribe el primer mensaje o inicia una llamada.</p>
          </div>
        )}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const grouped = !newDay && prev && prev.author_id === m.author_id && prev.author_kind === m.author_kind && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60000;
          const w = who(m);
          const mine = m.author_id === me && m.author_kind === 'user';
          return (
            <div key={m.id}>
              {newDay && <div className="day-sep"><span>{dayLabel(m.created_at)}</span></div>}
              <div className={'msg' + (grouped ? ' grouped' : '') + (mine ? ' mine' : '') + (m.id.startsWith('tmp-') ? ' sending' : '')}>
                <div className="msg-av">{!grouped && (m.author_kind === 'assistant' ? <span className="avatar ai">IA</span> : <Avatar name={w.name} url={w.avatar} size={34} />)}</div>
                <div className="msg-body">
                  {!grouped && <div className="msg-head"><b>{mine ? 'Tú' : w.name}</b><time>{time(m.created_at)}</time></div>}
                  <p title={grouped ? time(m.created_at) : undefined}>{m.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="composer">
        {error && <p className="err" role="alert">{error}</p>}
        <div className="composer-box">
          <textarea ref={box} rows={1} value={text} placeholder={`Escribe en ${channelName}`} aria-label="Mensaje"
            onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="send" onClick={send} disabled={!text.trim()} aria-label="Enviar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 8h10M8.5 4l4 4-4 4" /></svg>
          </button>
        </div>
        <p className="note">Enter envía · Shift + Enter hace un salto de línea</p>
      </div>
    </>
  );
}
