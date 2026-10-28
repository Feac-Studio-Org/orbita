'use client';
import { useState, useTransition } from 'react';
import { sendNudge } from '@/lib/actions';

/** Animar a alguien que todavía no cumple un hábito: le llega un aviso. */
export function NudgeButton({ to, habit, name, what }: { to: string; habit: string; name: string; what: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [state, setState] = useState<'' | 'sent' | string>('');
  const [pending, start] = useTransition();
  const first = name.split(' ')[0];
  const presets = [`${first}, ¿ya hiciste ${what.toLowerCase()}?`, `Bro, ¿por qué no has hecho ${what.toLowerCase()} todavía?`, `Vamos, ${first}, tú puedes. Hazlo ya.`];
  function send(text: string) {
    start(async () => {
      const r = await sendNudge(to, habit, text);
      setState(r.error ?? 'sent');
      if (!r.error) setTimeout(() => { setOpen(false); setState(''); }, 1400);
    });
  }
  return (
    <span className="nudge">
      <button type="button" className="nudge-btn" onClick={() => setOpen(!open)} title={`Animar a ${first}`}>Animar</button>
      {open && (
        <span className="nudge-pop" role="dialog" aria-label={`Animar a ${first}`}>
          {state === 'sent' ? <b className="ok-msg">Enviado a {first}</b> : (
            <>
              {presets.map((p) => <button key={p} type="button" disabled={pending} onClick={() => send(p)}>{p}</button>)}
              <form onSubmit={(e) => { e.preventDefault(); if (msg.trim()) send(msg); }}>
                <input className="inp" placeholder="Escribe tu mensaje" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={140} />
              </form>
              {state && <span className="err">{state}</span>}
            </>
          )}
        </span>
      )}
    </span>
  );
}
