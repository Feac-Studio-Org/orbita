'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal, useFormStatus } from 'react-dom';
import { Icon } from './icons';

function Confirm() {
  const { pending } = useFormStatus();
  return <button className="pill mini del-yes" type="submit" disabled={pending}>{pending ? 'Eliminando…' : 'Sí, eliminar'}</button>;
}

/** Cesto de basura que pregunta antes de borrar. `what` es lo que se borra ("la tarea «X»"). */
export function DeleteButton({ action, fields, what, detail, label }: {
  action: (f: FormData) => void; fields: Record<string, string>; what: string; detail?: string; label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <>
      <button type="button" className={'del-btn' + (label ? ' with-label' : '')} onClick={() => ref.current?.showModal()} aria-label={`Eliminar ${what}`} title="Eliminar">
        <Icon name="trash" size={15} />{label}
      </button>
      {mounted && createPortal(
        <dialog ref={ref} className="del-dialog" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
          <form action={action} className="del-box">
            {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <span className="del-ico"><Icon name="trash" size={18} /></span>
            <h3>¿Eliminar {what}?</h3>
            <p>{detail ?? 'No se puede deshacer.'}</p>
            <div className="del-actions">
              <button className="pill mini" type="button" onClick={() => ref.current?.close()}>Cancelar</button>
              <Confirm />
            </div>
          </form>
        </dialog>,
        document.body,
      )}
    </>
  );
}
