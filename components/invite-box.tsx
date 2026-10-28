'use client';
import { useState, useTransition } from 'react';
import { createHabitInvite } from '@/lib/actions';

/** Genera un código para que alguien entre al grupo; se copia o se comparte con un toque. */
export function InviteBox({ space, name }: { space: string; name: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const text = (c: string) => `Únete a ${name} en Órbita para llevar nuestros hábitos juntos.\n1. Crea tu cuenta en https://orbita-feac.vercel.app/login?modo=registro\n2. Entra a «Crear o unirse a un espacio» y escribe el código: ${c}`;
  return (
    <div className="invite-box">
      {code ? (
        <>
          <span className="label">Código de invitación · vence en 14 días</span>
          <b className="invite-code">{code}</b>
          <div className="inline">
            <button type="button" className="pill solid" onClick={async () => { try { await navigator.clipboard.writeText(text(code)); setCopied(true); } catch {} }}>{copied ? 'Copiado' : 'Copiar invitación'}</button>
            {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" className="pill" onClick={() => navigator.share({ title: name, text: text(code) }).catch(() => {})}>Compartir</button>}
            <button type="button" className="link" onClick={() => { setCode(''); setCopied(false); }}>Otro código</button>
          </div>
          <p className="note">Pásale el mensaje a la persona: crea su cuenta, escribe el código y ya aparece en el grupo.</p>
        </>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13.5 }}>Genera un código y compártelo. Cada persona crea su cuenta, lo escribe y entra al grupo con sus propios hábitos.</p>
          <button type="button" className="pill solid" disabled={pending} onClick={() => start(async () => { const r = await createHabitInvite(space); if ('code' in r && r.code) setCode(r.code); else setError(r.error ?? 'No se pudo generar.'); })}>{pending ? 'Generando…' : 'Invitar a alguien'}</button>
          {error && <p className="err">{error}</p>}
        </>
      )}
    </div>
  );
}
