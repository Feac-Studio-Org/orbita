'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/* Llamada propia de Órbita: WebRTC entre los participantes (malla), señalización por un canal privado de Realtime.
   Sin límite de tiempo. Pensada para grupos pequeños (2 a 6 personas). */

type Peer = { id: string; name: string; avatar: string | null; stream: MediaStream | null; mic: boolean; cam: boolean; screen: boolean };
type Signal = { from: string; to: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type State = { name: string; avatar: string | null; mic: boolean; cam: boolean; screen: boolean };

function Tile({ peer, me, muted }: { peer: Peer; me?: boolean; muted?: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (v.current && v.current.srcObject !== peer.stream) v.current.srcObject = peer.stream; }, [peer.stream]);
  const showVideo = peer.stream && (peer.cam || peer.screen) && peer.stream.getVideoTracks().some((t) => t.readyState === 'live');
  return (
    <div className={'tile' + (peer.screen ? ' screen' : '')}>
      <video ref={v} autoPlay playsInline muted={muted} style={{ display: showVideo ? 'block' : 'none', transform: me && !peer.screen ? 'scaleX(-1)' : undefined }} />
      {!showVideo && (
        <div className="tile-avatar">
          {peer.avatar ? <img src={peer.avatar} alt="" /> : <span>{(peer.name || '?').trim().charAt(0).toUpperCase()}</span>}
        </div>
      )}
      <div className="tile-name">{!peer.mic && <MicOff />}{me ? 'Tú' : peer.name}{peer.screen && ' · pantalla'}</div>
    </div>
  );
}

const I = ({ d }: { d: React.ReactNode }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const MicOn = () => <I d={<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>} />;
const MicOff = () => <I d={<><path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.7 2.5M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18" /></>} />;
const CamOn = () => <I d={<><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="m16 10 5-3v10l-5-3" /></>} />;
const CamOff = () => <I d={<><path d="M16 16v.5A1.5 1.5 0 0 1 14.5 18H5.5A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6H6M10 6h4a2 2 0 0 1 2 2v2l5-3v10M3 3l18 18" /></>} />;
const Screen = () => <I d={<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M12 13V7M9 10l3-3 3 3" /></>} />;
const Hang = () => <I d={<path d="M3 15.5c5-4.7 13-4.7 18 0l-2.3 2.3-3.4-1.6v-2.6a10 10 0 0 0-6.6 0v2.6l-3.4 1.6Z" />} />;

export function CallRoom({ callId, title, me, ice, backHref, active }: { callId: string; title: string; me: { id: string; name: string; avatar: string | null }; ice: RTCIceServer[]; backHref: string; active: boolean }) {
  const supabase = useRef(createClient()).current;
  const myId = useRef(me.id + ':' + Math.random().toString(36).slice(2, 8)).current;
  const [joined, setJoined] = useState(false);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [screen, setScreen] = useState(false);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [error, setError] = useState('');
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const pcs = useRef(new Map<string, { pc: RTCPeerConnection; polite: boolean; making: boolean; ignore: boolean }>());
  const chan = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const stateRef = useRef<State>({ name: me.name, avatar: me.avatar, mic: true, cam: true, screen: false });

  // Vista previa antes de entrar.
  useEffect(() => {
    let stop = false;
    (async () => {
      let s: MediaStream | null = null;
      try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: { width: { ideal: 1280 }, height: { ideal: 720 } } }); }
      catch {
        try { s = await navigator.mediaDevices.getUserMedia({ audio: true }); setCam(false); stateRef.current.cam = false; }
        catch { setError('No hay acceso al micrófono ni a la cámara. Revisa los permisos del navegador.'); }
      }
      if (stop) { s?.getTracks().forEach((t) => t.stop()); return; }
      localRef.current = s; setLocal(s);
    })();
    return () => { stop = true; };
  }, []);

  useEffect(() => { if (!joined) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [joined]);

  const send = useCallback((payload: Signal) => { chan.current?.send({ type: 'broadcast', event: 'signal', payload }); }, []);

  const track = useCallback(() => { chan.current?.track({ ...stateRef.current }); }, []);

  const connect = useCallback((other: string) => {
    if (pcs.current.has(other)) return pcs.current.get(other)!;
    const pc = new RTCPeerConnection({ iceServers: ice });
    const entry = { pc, polite: myId > other, making: false, ignore: false };
    pcs.current.set(other, entry);
    const s = localRef.current;
    s?.getTracks().forEach((t) => pc.addTrack(screenTrack.current && t.kind === 'video' ? screenTrack.current : t, s));
    pc.onicecandidate = ({ candidate }) => { if (candidate) send({ from: myId, to: other, candidate: candidate.toJSON() }); };
    pc.onnegotiationneeded = async () => {
      try { entry.making = true; await pc.setLocalDescription(); send({ from: myId, to: other, description: pc.localDescription!.toJSON() }); }
      catch {} finally { entry.making = false; }
    };
    pc.ontrack = ({ streams }) => { const st = streams[0]; setPeers((p) => ({ ...p, [other]: { ...(p[other] ?? { id: other, name: '', avatar: null, mic: true, cam: true, screen: false }), stream: st } })); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') pc.restartIce(); };
    return entry;
  }, [ice, myId, send]);

  const drop = useCallback((other: string) => {
    pcs.current.get(other)?.pc.close();
    pcs.current.delete(other);
    setPeers((p) => { const n = { ...p }; delete n[other]; return n; });
  }, []);

  async function join() {
    setError('');
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    const ch = supabase.channel('call:' + callId, { config: { private: true, presence: { key: myId }, broadcast: { self: false } } });
    chan.current = ch;
    ch.on('broadcast', { event: 'signal' }, async ({ payload }: { payload: Signal }) => {
      if (payload.to !== myId) return;
      const e = connect(payload.from);
      const { pc } = e;
      try {
        if (payload.description) {
          const collision = payload.description.type === 'offer' && (e.making || pc.signalingState !== 'stable');
          e.ignore = !e.polite && collision;
          if (e.ignore) return;
          await pc.setRemoteDescription(payload.description);
          if (payload.description.type === 'offer') { await pc.setLocalDescription(); send({ from: myId, to: payload.from, description: pc.localDescription!.toJSON() }); }
        } else if (payload.candidate) {
          try { await pc.addIceCandidate(payload.candidate); } catch (err) { if (!e.ignore) throw err; }
        }
      } catch {}
    });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState<State>();
      const ids = Object.keys(st).filter((k) => k !== myId);
      ids.forEach((id) => {
        const info = st[id][0];
        setPeers((p) => ({ ...p, [id]: { ...(p[id] ?? { id, stream: null }), id, name: info.name, avatar: info.avatar, mic: info.mic, cam: info.cam, screen: info.screen } as Peer }));
        // El de id menor inicia la conexión; el otro espera la oferta.
        if (!pcs.current.has(id) && myId < id) connect(id);
      });
      [...pcs.current.keys()].filter((k) => !ids.includes(k)).forEach(drop);
    });
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') { track(); setJoined(true); setStarted(Date.now()); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('No se pudo entrar a la llamada. Revisa tu conexión e intenta de nuevo.');
    });
  }

  const leave = useCallback(async (end = false) => {
    pcs.current.forEach(({ pc }) => pc.close());
    pcs.current.clear();
    if (chan.current) { await chan.current.untrack(); supabase.removeChannel(chan.current); chan.current = null; }
    localRef.current?.getTracks().forEach((t) => t.stop());
    screenTrack.current?.stop();
    if (end) await supabase.from('calls').update({ ended_at: new Date().toISOString() }).eq('id', callId).is('ended_at', null);
    window.location.href = backHref;
  }, [backHref, callId, supabase]);

  useEffect(() => () => { pcs.current.forEach(({ pc }) => pc.close()); if (chan.current) supabase.removeChannel(chan.current); localRef.current?.getTracks().forEach((t) => t.stop()); }, [supabase]);

  function toggleMic() {
    const v = !mic; setMic(v); stateRef.current.mic = v;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = v)); track();
  }
  function toggleCam() {
    const v = !cam; setCam(v); stateRef.current.cam = v;
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = v)); track();
  }
  async function toggleScreen() {
    if (screen) return stopScreen();
    try {
      const d = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const t = d.getVideoTracks()[0];
      screenTrack.current = t;
      screenStream.current = d;
      t.onended = () => stopScreen();
      pcs.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find((x) => x.track?.kind === 'video');
        if (sender) sender.replaceTrack(t); else pc.addTrack(t, localRef.current ?? d);
      });
      setScreen(true); stateRef.current.screen = true; track();
    } catch {}
  }
  function stopScreen() {
    const cam0 = localRef.current?.getVideoTracks()[0] ?? null;
    pcs.current.forEach(({ pc }) => { const sender = pc.getSenders().find((x) => x.track?.kind === 'video'); if (sender) sender.replaceTrack(cam0); });
    screenTrack.current?.stop(); screenTrack.current = null; screenStream.current = null;
    setScreen(false); stateRef.current.screen = false; track();
  }

  const mine: Peer = { id: myId, name: me.name, avatar: me.avatar, stream: screen && screenStream.current ? screenStream.current : local, mic, cam, screen };
  const list = Object.values(peers);
  const secs = started ? Math.floor((now - started) / 1000) : 0;
  const clock = `${Math.floor(secs / 3600) ? Math.floor(secs / 3600) + ':' : ''}${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  if (!active) return <div className="call-ended"><b>Esta llamada ya terminó.</b><a className="pill" href={backHref}>Volver a mensajes</a></div>;

  return (
    <div className="call">
      <header className="call-top">
        <div><b>{title}</b><span className="note">{joined ? `${list.length + 1} en la llamada · ${clock}` : 'Revisa tu cámara y micrófono antes de entrar'}</span></div>
        <a className="link" href={backHref}>Volver al chat</a>
      </header>
      {error && <p className="err" role="alert" style={{ textAlign: 'center' }}>{error}</p>}
      <div className={'tiles n' + Math.min(list.length + 1, 6)}>
        <Tile peer={mine} me muted />
        {list.map((p) => <Tile key={p.id} peer={p} />)}
      </div>
      {joined && list.length === 0 && <p className="note" style={{ textAlign: 'center' }}>Esperando a que alguien más entre. Ya les llegó el aviso.</p>}
      <div className="call-controls">
        <button className={'cc' + (mic ? '' : ' off')} onClick={toggleMic} aria-label={mic ? 'Silenciar' : 'Activar micrófono'} title={mic ? 'Silenciar' : 'Activar micrófono'}>{mic ? <MicOn /> : <MicOff />}</button>
        <button className={'cc' + (cam ? '' : ' off')} onClick={toggleCam} disabled={!local?.getVideoTracks().length} aria-label={cam ? 'Apagar cámara' : 'Encender cámara'} title={cam ? 'Apagar cámara' : 'Encender cámara'}>{cam ? <CamOn /> : <CamOff />}</button>
        {joined && typeof navigator !== 'undefined' && 'getDisplayMedia' in (navigator.mediaDevices ?? {}) && <button className={'cc' + (screen ? ' on' : '')} onClick={toggleScreen} aria-label="Compartir pantalla" title="Compartir pantalla"><Screen /></button>}
        {joined ? (
          <>
            <button className="cc hang" onClick={() => leave(list.length === 0)} aria-label="Salir de la llamada" title="Salir"><Hang /></button>
            {list.length > 0 && <button className="link" onClick={() => leave(true)}>Terminar para todos</button>}
          </>
        ) : <button className="pill solid" onClick={join} disabled={!local && !error}>Unirme a la llamada</button>}
      </div>
    </div>
  );
}
