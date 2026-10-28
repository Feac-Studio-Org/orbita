'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createHabit } from '@/lib/actions';
import { HABIT_COLORS, SUGGESTED, WD } from '@/lib/habits';
import { HABIT_ICONS, HabitIcon } from './habit-icon';

type Option = { title: string; icon: string; color: string; people?: number; weekdays?: number[]; at_time?: string | null };
const PRESETS: [string, number[]][] = [['Todos los días', [1, 2, 3, 4, 5, 6, 7]], ['Entre semana', [1, 2, 3, 4, 5]], ['3 veces', [1, 3, 5]], ['Fines de semana', [6, 7]]];

/** Crear un hábito en tres toques: qué, qué días, a qué hora. */
export function HabitWizard({ space, options = [], google = false, shared = true, label = 'Agregar hábito', taken = [] }: { space: string; options?: Option[]; google?: boolean; shared?: boolean; label?: string; taken?: string[] }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [custom, setCustom] = useState(false);
  const [icon, setIcon] = useState('check');
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [gcal, setGcal] = useState(google);
  const [error, setError] = useState('');

  const takenKeys = new Set(taken.map((t) => t.toLowerCase().trim()));
  const merged: Option[] = [...options];
  for (const s of SUGGESTED) if (!merged.some((o) => o.title.toLowerCase() === s.title.toLowerCase())) merged.push(s);
  const choices = merged.filter((o) => !takenKeys.has(o.title.toLowerCase().trim()));

  function open() { setStep(0); setTitle(''); setCustom(false); setError(''); setDays([1, 2, 3, 4, 5, 6, 7]); setTime(''); dlg.current?.showModal(); }
  function choose(o: Option) { setTitle(o.title); setIcon(o.icon); setColor(o.color); if (o.weekdays?.length) setDays(o.weekdays); if (o.at_time) setTime(o.at_time.slice(0, 5)); setStep(1); }
  function save() {
    setError('');
    start(async () => {
      const r = await createHabit({ space, title, icon, color, weekdays: days, at_time: time || null, minutes: time ? minutes : null, shared, gcal: gcal && !!time });
      if (r.error) return setError(r.error);
      dlg.current?.close();
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="pill solid" onClick={open}><span className="pill__dot" />{label}</button>
      <dialog ref={dlg} className="hw" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <div className="hw-in">
          <div className="hw-steps" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
          {step === 0 && (
            <>
              <h2>¿Qué quieres hacer?</h2>
              <p className="muted">Elige uno o escribe el tuyo.</p>
              <div className="hw-grid">
                {choices.map((o) => (
                  <button key={o.title} type="button" className="hw-opt" style={{ ['--hc' as string]: o.color }} onClick={() => choose(o)}>
                    <span className="hw-ico"><HabitIcon name={o.icon} size={20} /></span>
                    <b>{o.title}</b>
                    {o.people ? <small>{o.people === 1 ? '1 persona' : `${o.people} personas`} lo hacen</small> : <small>Sugerido</small>}
                  </button>
                ))}
                <button type="button" className="hw-opt other" onClick={() => setCustom(true)}><span className="hw-ico"><HabitIcon name="pen" size={20} /></span><b>Otro</b><small>Escríbelo tú</small></button>
              </div>
              {custom && (
                <form className="hw-custom" onSubmit={(e) => { e.preventDefault(); if (title.trim()) setStep(1); }}>
                  <input className="inp" autoFocus placeholder="Ej.: Caminar 30 minutos" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
                  <div className="hw-icons">{HABIT_ICONS.map((n) => <button key={n} type="button" aria-label={n} className={icon === n ? 'on' : ''} onClick={() => setIcon(n)}><HabitIcon name={n} /></button>)}</div>
                  <div className="hw-colors">{HABIT_COLORS.map((c) => <button key={c} type="button" aria-label={c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />)}</div>
                  <button className="pill solid" type="submit" disabled={!title.trim()}>Seguir</button>
                </form>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <h2><span className="hw-badge" style={{ ['--hc' as string]: color }}><HabitIcon name={icon} size={18} /></span>{title}</h2>
              <p className="muted">¿Qué días?</p>
              <div className="hw-presets">{PRESETS.map(([l, d]) => <button key={l} type="button" className={days.join() === d.join() ? 'on' : ''} onClick={() => setDays(d)}>{l}</button>)}</div>
              <div className="hw-days">{WD.map((d, i) => { const n = i + 1; const on = days.includes(n); return <button key={d} type="button" className={on ? 'on' : ''} onClick={() => setDays(on ? days.filter((x) => x !== n) : [...days, n].sort())}>{d}</button>; })}</div>
              <p className="note">{days.length} {days.length === 1 ? 'vez' : 'veces'} por semana</p>
              <div className="hw-nav"><button type="button" className="link" onClick={() => setStep(0)}>Atrás</button><button type="button" className="pill solid" disabled={!days.length} onClick={() => setStep(2)}>Seguir</button></div>
            </>
          )}
          {step === 2 && (
            <>
              <h2>¿A qué hora?</h2>
              <p className="muted">Opcional. Con hora aparece en tu día en orden y te lo recordamos.</p>
              <div className="hw-times">
                {['06:00', '07:00', '10:00', '12:00', '15:00', '18:00', '20:00', '21:00'].map((t) => <button key={t} type="button" className={time === t ? 'on' : ''} onClick={() => setTime(time === t ? '' : t)}>{t}</button>)}
                <input type="time" className="inp" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Otra hora" />
              </div>
              {time && (
                <div className="hw-presets">{[15, 30, 45, 60, 90].map((m) => <button key={m} type="button" className={minutes === m ? 'on' : ''} onClick={() => setMinutes(m)}>{m < 60 ? `${m} min` : `${m / 60} h`.replace('1.5 h', '1 h 30')}</button>)}</div>
              )}
              {google && time && <label className="check"><input type="checkbox" checked={gcal} onChange={(e) => setGcal(e.target.checked)} />Agregar también a mi Google Calendar</label>}
              {error && <p className="err" role="alert">{error}</p>}
              <div className="hw-nav"><button type="button" className="link" onClick={() => setStep(1)}>Atrás</button><button type="button" className="pill solid" disabled={pending} onClick={save}>{pending ? 'Guardando…' : 'Listo'}</button></div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
