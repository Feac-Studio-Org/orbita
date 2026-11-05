'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { type Ev, REMIND, REPEAT, bogota } from '@/lib/events';
import { DeleteButton } from './delete-button';

/**
 * Crear o editar un evento en una ventana encima del calendario.
 * El disparador es lo que se toca: el evento en la semana, el botón "Editar" o "Nuevo evento".
 */
export function EventDialog({ event, today, save, remove, className, style, title, children }: {
  event?: Ev | null; today: string; save: (f: FormData) => Promise<void>; remove: (f: FormData) => void;
  className?: string; style?: React.CSSProperties; title?: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [allDay, setAllDay] = useState(!!event?.all_day);
  const [key, setKey] = useState(0); // al abrir de nuevo, el formulario arranca con los datos actuales
  useEffect(() => setMounted(true), []);
  const st = event ? bogota(event.starts_at) : null, en = event ? bogota(event.ends_at) : null;

  const open = () => { setAllDay(!!event?.all_day); setKey((k) => k + 1); ref.current?.showModal(); };
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    // La confirmación de "Eliminar" vive en otra ventana, pero su envío sube por aquí: se deja pasar.
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => { await save(f); });
    ref.current?.close();
  };

  return (
    <>
      <button type="button" className={className} style={style} title={title} onClick={open}>{children}</button>
      {mounted && createPortal(
        <dialog ref={ref} className="ev-dialog" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
          <form key={key} className="form ev-box" onSubmit={submit}>
            <div className="ev-head">
              <h3>{event ? 'Editar evento' : 'Nuevo evento'}</h3>
              <button type="button" className="ev-x" aria-label="Cerrar" onClick={() => ref.current?.close()}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </div>
            {event && <input type="hidden" name="id" value={event.id} />}
            {event && event.repeat !== 'none' && <p className="note">Se repite ({REPEAT[event.repeat].toLowerCase()}): los cambios aplican a todas las fechas.</p>}
            <label className="field">Título<input name="title" required maxLength={120} placeholder="Ej.: Reunión con el cliente" defaultValue={event?.title} /></label>
            <div className="two">
              <label className="field">Fecha<input type="date" name="date" required defaultValue={st?.date ?? today} /></label>
              <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" name="all_day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />Todo el día</label>
            </div>
            {!allDay && (
              <div className="two">
                <label className="field">Desde<input type="time" name="start" defaultValue={event && !event.all_day ? st!.time : '09:00'} /></label>
                <label className="field">Hasta<input type="time" name="end" defaultValue={event && !event.all_day ? en!.time : '10:00'} /></label>
              </div>
            )}
            <div className="two">
              <label className="field">Repetir<select name="repeat" defaultValue={event?.repeat ?? 'none'}>{Object.entries(REPEAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="field">Aviso<select name="remind" defaultValue={event ? (event.remind_min === null ? '' : String(event.remind_min)) : '10'}>{REMIND.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <div className="two">
              <label className="field">Lugar<input name="location" defaultValue={event?.location} /></label>
              <label className="field">Color<input type="color" name="color" defaultValue={event?.color ?? '#c77dff'} /></label>
            </div>
            <label className="field">Notas<input name="notes" defaultValue={event?.notes} /></label>
            <div className="ev-actions">
              {event && <DeleteButton action={remove} fields={{ id: event.id }} what={`el evento «${event.title}»`} label="Eliminar" />}
              <span style={{ flex: 1 }} />
              <button type="button" className="pill mini" onClick={() => ref.current?.close()}>Cancelar</button>
              <button type="submit" className="pill mini solid" disabled={pending}>{event ? 'Guardar cambios' : 'Crear evento'}</button>
            </div>
          </form>
        </dialog>,
        document.body,
      )}
    </>
  );
}

/** Mantiene la página al día: se refresca al volver a ella y cada 20 s mientras está a la vista (cambios hechos en otro equipo). */
export function LiveRefresh({ every = 20000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => { if (navigator.onLine && document.visibilityState === 'visible' && !document.querySelector('dialog[open]')) router.refresh(); };
    const t = setInterval(tick, every);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [router, every]);
  return null;
}
