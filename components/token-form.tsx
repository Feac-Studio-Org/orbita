'use client';
import { useActionState, useState } from 'react';
import { createToken } from '@/lib/actions';

export function TokenForm({ origin }: { origin: string }) {
  const [state, action, pending] = useActionState(createToken, {} as { token?: string; error?: string });
  const [copied, setCopied] = useState('');
  const copy = (v: string, what: string) => navigator.clipboard.writeText(v).then(() => setCopied(what));
  return (
    <div className="form">
      <form action={action} className="inline">
        <input className="inp" name="name" placeholder="Para qué IA o equipo (ej.: Claude en el portátil)" required />
        <button className="pill" type="submit" disabled={pending}>{pending ? 'Generando…' : 'Generar token'}</button>
      </form>
      {state.error && <p className="err">{state.error}</p>}
      {state.token && (
        <div className="callout form">
          <b>Cópialo ahora: no se vuelve a mostrar.</b>
          <label className="field">Dirección con el token incluido (para IAs que solo piden una URL)
            <input className="inp mono" readOnly value={`${origin}/api/mcp/${state.token}`} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="inline">
            <button className="pill mini" type="button" onClick={() => copy(`${origin}/api/mcp/${state.token}`, 'dirección')}>Copiar dirección</button>
            <button className="pill mini" type="button" onClick={() => copy(state.token!, 'token')}>Copiar solo el token</button>
            {copied && <span className="ok-msg">Copiado: {copied}</span>}
          </div>
          <p className="note">Si tu IA permite encabezados, usa {origin}/api/mcp con «Authorization: Bearer» y el token.</p>
        </div>
      )}
    </div>
  );
}
