import Link from 'next/link';
import { getContext } from '@/lib/data';
import { DAYS, MES, addDays, hhmm, isoWeekday, todayISO } from '@/lib/format';
import { accessToken, googleConfigured, listEvents, type GEvent } from '@/lib/google';
import { addBlockWithGoogle, disconnectGoogle, removeBlock } from '@/lib/calendar-actions';
import { ViewHead } from '@/components/bits';
import { HabitToggle } from '@/components/habit-toggle';
import { HabitWizard } from '@/components/habit-wizard';
import { type Check, type Habit, isDue } from '@/lib/habits';

export const metadata = { title: 'Calendario' };

type Item = { id?: string; title: string; start: number; end: number; cls: string; time: string; google?: boolean; gcal?: string | null };
const S = 5.5, E = 23, PX = 38;
const toH = (t: string) => { const [h, m] = t.split(':').map(Number); return h + m / 60; };

export default async function Calendar({ searchParams }: { searchParams: Promise<{ semana?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, spaces, user } = await getContext();
  const today = todayISO();
  const base = sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : today;
  const monday = addDays(base, 1 - isoWeekday(base));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const personal = spaces.find((s) => s.kind === 'personal');

  const [{ data: blocks }, { data: status }, { data: myHabits }, { data: hchecks }, { data: bchecks }] = await Promise.all([
    supabase.from('schedule_blocks').select('*').order('start_time'),
    supabase.rpc('google_connection_status'),
    supabase.from('habits').select('*').eq('user_id', user.id).is('archived_at', null).order('at_time'),
    supabase.from('habit_checks').select('habit_id, day, user_id, done_at').gte('day', monday < today ? monday : today),
    supabase.from('block_checks').select('block_id, day').gte('day', monday < today ? monday : today),
  ]);
  const conn = (status as { connected: boolean; google_email: string }[] | null)?.[0];

  let gEvents: GEvent[] = [];
  let gError = '';
  if (conn && googleConfigured()) {
    const { data: rt } = await supabase.rpc('google_refresh_token');
    const token = rt ? await accessToken(String(rt)) : null;
    if (token) gEvents = await listEvents(token, `${monday}T00:00:00-05:00`, `${addDays(monday, 7)}T00:00:00-05:00`);
    else gError = 'Google no aceptó la conexión guardada. Desconéctala y vuelve a conectar.';
  }

  const days: { date: string; items: Item[]; allDay: string[] }[] = week.map((date, i) => {
    const wd = i + 1;
    const own: Item[] = (blocks ?? [])
      .filter((b) => b.weekdays.includes(wd) && (!b.ends_on || b.ends_on >= date) && (!b.starts_on || b.starts_on <= date))
      .map((b) => ({ id: b.id, title: b.title, start: toH(b.start_time), end: toH(b.end_time), cls: b.kind + (b.tag === 'UAO' ? ' uao' : ''), time: `${hhmm(b.start_time)} – ${hhmm(b.end_time)}`, gcal: b.gcal_event_id }));
    const fromGoogle: Item[] = [];
    const allDay: string[] = [];
    for (const e of gEvents) {
      if (e.start.date) { if (e.start.date <= date && (e.end.date ?? '') > date) allDay.push(e.summary ?? 'Sin título'); continue; }
      const st = e.start.dateTime!, en = e.end.dateTime!;
      if (st.slice(0, 10) !== date) continue;
      const item = { title: e.summary ?? 'Sin título', start: toH(st.slice(11, 16)), end: toH(en.slice(11, 16)), cls: 'google', time: `${hhmm(st.slice(11, 16))} – ${hhmm(en.slice(11, 16))}`, google: true };
      // Si el mismo bloque ya está en Órbita (mismo nombre y hora), no se repite.
      const dup = own.some((o) => o.title.toLowerCase() === item.title.toLowerCase() && Math.abs(o.start - item.start) < 0.01) || own.some((o) => o.gcal && (e.recurringEventId === o.gcal || e.id === o.gcal));
      if (!dup) fromGoogle.push(item);
    }
    return { date, items: [...own, ...fromGoogle].sort((a, b) => a.start - b.start), allDay };
  });

  // Carriles para eventos que se cruzan
  const laid = days.map((d) => {
    const lanes: number[] = [];
    return d.items.map((it) => {
      let lane = lanes.findIndex((end) => end <= it.start);
      if (lane < 0) { lane = lanes.length; lanes.push(it.end); } else lanes[lane] = it.end;
      return { ...it, lane };
    }).map((it, _, arr) => ({ ...it, lanes: Math.max(1, ...arr.filter((o) => o.start < it.end && o.end > it.start).map((o) => o.lane + 1)) }));
  });
  const H = (E - S) * PX;
  const label = (iso: string) => { const [, m, d] = iso.split('-'); return `${+d} ${MES[+m - 1]}`; };

  return (
    <>
      <ViewHead label={conn ? `Conectado con Google Calendar · ${conn.google_email}` : 'Tu horario semanal'} title="Semana" text="Tu horario de Órbita y, si lo conectas, tus eventos de Google Calendar en una sola vista.">
        <div className="inline">
          <Link className="pill mini" href={`/calendario?semana=${addDays(monday, -7)}`}>Anterior</Link>
          <Link className="pill mini" href="/calendario">Hoy</Link>
          <Link className="pill mini" href={`/calendario?semana=${addDays(monday, 7)}`}>Siguiente</Link>
        </div>
      </ViewHead>
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      {gError && <p className="err" role="alert">{gError}</p>}
      {sp.ok && <p className="ok-msg" role="status">{sp.ok}</p>}

      {(() => {
        // Hoy: cada bloque del horario y cada hábito se marca con un toque.
        const wd = isoWeekday(today);
        const live = (b: { weekdays: number[]; ends_on: string | null; starts_on: string | null }, d: string) => b.weekdays.includes(isoWeekday(d)) && (!b.ends_on || b.ends_on >= d) && (!b.starts_on || b.starts_on <= d);
        // Todos tus hábitos (también los de espacios de hábitos). Si un bloque empieza a la misma hora que un hábito, se marca una sola vez.
        const hs = ((myHabits ?? []) as Habit[]).filter((h) => isDue(h, today));
        const todays = (blocks ?? []).filter((b) => live(b, today) && b.kind !== 'class' && !hs.some((h) => h.at_time && h.at_time.slice(0, 5) === String(b.start_time).slice(0, 5)));
        const hc = (hchecks ?? []) as Check[];
        const total = todays.length + hs.length;
        const doneN = todays.filter((b) => (bchecks ?? []).some((c) => c.block_id === b.id && c.day === today)).length + hs.filter((h) => hc.some((c) => c.habit_id === h.id && c.day === today)).length;
        // Semana: cumplido de lo que tocaba hasta hoy.
        let wDue = 0, wGot = 0;
        for (const d of week) {
          if (d > today) break;
          for (const b of (blocks ?? []).filter((x) => live(x, d) && x.kind !== 'class' && !((myHabits ?? []) as Habit[]).some((h) => isDue(h, d) && h.at_time && h.at_time.slice(0, 5) === String(x.start_time).slice(0, 5)))) { wDue++; if ((bchecks ?? []).some((c) => c.block_id === b.id && c.day === d)) wGot++; }
          for (const h of ((myHabits ?? []) as Habit[]).filter((x) => isDue(x, d))) { wDue++; if (hc.some((c) => c.habit_id === h.id && c.day === d)) wGot++; }
        }
        const pct = total ? Math.round((doneN / total) * 100) : 0;
        return (
          <section className="panel today-track">
            <div className="panel-head">
              <h2>Hoy, {DAYS[wd - 1].toLowerCase()} {label(today)}</h2>
              <div className="inline"><span className="label">{doneN} de {total} · semana {wDue ? Math.round((wGot / wDue) * 100) : 0}%</span>{personal && <HabitWizard space={personal.id} shared={false} google={!!conn} label="Nuevo hábito" taken={((myHabits ?? []) as Habit[]).map((h) => h.title)} />}</div>
            </div>
            <div className="hbp-bar big"><i style={{ width: `${pct}%` }} /></div>
            {total ? (
              <div className="ht-grid">
                {[...todays.map((b) => ({ t: b.start_time as string, el: <HabitToggle key={'b' + b.id} block={b.id} day={today} done={(bchecks ?? []).some((c) => c.block_id === b.id && c.day === today)} title={b.title} sub={`${hhmm(b.start_time)} – ${hhmm(b.end_time)}`} color={b.kind === 'work' ? '#5fa8f5' : b.kind === 'routine' ? '#9a92a8' : b.kind === 'review' ? '#4cc38a' : '#c77dff'} icon={b.kind === 'work' ? 'briefcase' : b.kind === 'routine' ? 'dumbbell' : b.title.toLowerCase().includes('trading') ? 'chart' : b.title.toLowerCase().includes('ingl') ? 'globe' : 'book'} /> })),
                  ...hs.map((h) => ({ t: h.at_time ?? '99', el: <HabitToggle key={'h' + h.id} habit={h.id} day={today} done={hc.some((c) => c.habit_id === h.id && c.day === today)} title={h.title} sub={h.at_time ? hhmm(h.at_time) : 'Hábito'} color={h.color} icon={h.icon} /> }))]
                  .sort((a, b) => a.t.localeCompare(b.t)).map((x) => x.el)}
              </div>
            ) : <p className="muted">Hoy no tienes bloques ni hábitos.</p>}
            <p className="note">Las clases no se marcan. Toca un bloque o hábito cuando lo cumplas.</p>
          </section>
        );
      })()}

      <section className="panel">
        <div className="panel-head">
          <h2>Google Calendar</h2>
          {conn ? (
            <form action={disconnectGoogle}><button className="pill mini danger" type="submit">Desconectar</button></form>
          ) : (
            <a className="pill solid" href="/api/google/conectar"><span className="pill__dot" />Conectar Google Calendar</a>
          )}
        </div>
        <p className="muted" style={{ fontSize: 13.5 }}>
          {conn ? `Ves los eventos de ${conn.google_email}. Los bloques nuevos pueden crearse también en Google Calendar.` : 'Conecta tu cuenta de Google para ver tus eventos aquí y crear bloques que se repiten cada semana en tu calendario. Cada persona conecta la suya.'}
        </p>
      </section>

      <div className="legend">
        <span><i style={{ background: 'rgba(236,111,134,.5)' }} />Universidad del Valle</span>
        <span><i style={{ background: 'rgba(207,175,110,.5)' }} />Autónoma de Occidente</span>
        <span><i style={{ background: 'rgba(157,78,221,.5)' }} />Estudio</span>
        <span><i style={{ background: 'rgba(76,195,138,.5)' }} />Revisión</span>
        <span><i style={{ background: '#221e2a' }} />Rutina</span>
        <span><i style={{ background: 'rgba(95,168,245,.5)' }} />Trabajo</span>
        {conn && <span><i style={{ background: 'rgba(95,201,192,.5)' }} />Google Calendar</span>}
      </div>

      <div className="cal-wrap">
        <div className="cal">
          <div className="cal-h" />
          {week.map((d, i) => <div key={d} className={'cal-h' + (d === today ? ' today' : '')}><b>{DAYS[i].slice(0, 3)}</b><span className="num">{label(d)}</span>{days[i].allDay.map((t) => <span key={t} className="tag" style={{ display: 'block', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>)}</div>)}
          <div className="cal-axis" style={{ height: H }}>{Array.from({ length: 9 }, (_, n) => 6 + n * 2).map((h) => <i key={h} style={{ top: (h - S) * PX }}>{h}:00</i>)}</div>
          {laid.map((items, i) => (
            <div key={week[i]} className="cal-col" style={{ height: H }}>
              {Array.from({ length: 17 }, (_, n) => 6 + n).map((g) => <div key={g} className="gl" style={{ top: (g - S) * PX }} />)}
              {items.map((it, n) => {
                const w = 100 / it.lanes;
                return (
                  <div key={n} className={'ev ' + it.cls} title={`${it.title} · ${it.time}`} style={{ top: (it.start - S) * PX, height: Math.max((it.end - it.start) * PX - 3, 18), left: `calc(${it.lane * w}% + 2px)`, width: `calc(${w}% - 4px)` }}>
                    <b>{it.title}</b>{(it.end - it.start) * PX > 34 && <span className="num">{it.time}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="cal-list">
        {days.map((d, i) => (
          <section key={d.date} className="panel" style={{ borderColor: d.date === today ? 'var(--violet)' : undefined }}>
            <div className="panel-head"><h2>{DAYS[i]} {label(d.date)}</h2></div>
            {d.allDay.map((t) => <span key={t} className="tag">{t}</span>)}
            {d.items.length ? <div className="timeline">{d.items.map((it, n) => <div className="tl-row" key={n}><div className="tl-time num">{it.time}</div><div className="tl-what"><b>{it.title}</b>{it.google && <span className="tag">Google</span>}</div></div>)}</div> : <p className="muted">Libre.</p>}
          </section>
        ))}
      </div>

      <div className="grid g-2">
        {personal && (
          <details className="panel add">
            <summary className="link" style={{ fontSize: 14 }}>+ Nuevo bloque semanal</summary>
            <form className="form" action={addBlockWithGoogle}>
              <input type="hidden" name="space" value={personal.id} />
              <label className="field">Qué<input name="title" required placeholder="Ej.: Bases de Datos" /></label>
              <fieldset className="field" style={{ border: 0 }}><legend style={{ marginBottom: 6 }}>Días</legend>
                <div className="chips">{DAYS.map((d, i) => <label key={d} className="chip" style={{ cursor: 'pointer' }}><input type="checkbox" name="weekdays" value={i + 1} style={{ accentColor: 'var(--violet)', marginRight: 6 }} />{d.slice(0, 3)}</label>)}</div>
              </fieldset>
              <div className="two"><label className="field">Desde<input type="time" name="start_time" required defaultValue="16:00" /></label><label className="field">Hasta<input type="time" name="end_time" required defaultValue="17:00" /></label></div>
              <div className="two">
                <label className="field">Tipo<select name="kind"><option value="study">Estudio</option><option value="work">Trabajo</option><option value="class">Clase</option><option value="routine">Rutina</option><option value="review">Revisión</option><option value="other">Otro</option></select></label>
                <label className="field">Etiqueta<input name="tag" placeholder="Ej.: UV, UAO, Estudio" /></label>
              </div>
              <label className="field">Termina el (opcional)<input type="date" name="ends_on" /></label>
              {conn && <label className="check"><input type="checkbox" name="google" defaultChecked />Crear también en Google Calendar</label>}
              <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Agregar bloque</button>
            </form>
          </details>
        )}
        <details className="panel add">
          <summary className="link" style={{ fontSize: 14 }}>Quitar un bloque</summary>
          <div className="list">
            {(blocks ?? []).map((b) => (
              <form key={b.id} action={removeBlock} className="row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <input type="hidden" name="id" value={b.id} />
                {b.gcal_event_id && <input type="hidden" name="google" value="on" />}
                <div className="t"><b>{b.title}</b><span>{b.weekdays.map((d: number) => DAYS[d - 1].slice(0, 3)).join(', ')} · {hhmm(b.start_time)} – {hhmm(b.end_time)}</span></div>
                <button className="pill mini danger" type="submit">Quitar</button>
              </form>
            ))}
          </div>
        </details>
      </div>
    </>
  );
}
