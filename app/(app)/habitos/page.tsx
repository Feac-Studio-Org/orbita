import Link from 'next/link';
import { getContext } from '@/lib/data';
import { addDays, hhmm, isoWeekday, todayISO } from '@/lib/format';
import { type Check, type Habit, freqLabel, isDue, streak } from '@/lib/habits';
import { ViewHead } from '@/components/bits';
import { HabitToggle } from '@/components/habit-toggle';
import { HabitWizard } from '@/components/habit-wizard';
import { HabitCell } from '@/components/habit-cell';
import { HabitIcon } from '@/components/habit-icon';
import { ArchiveHabit } from '@/components/archive-habit';
import { createSpace, joinWithCode } from '@/lib/actions';

export const metadata = { title: 'Hábitos' };
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Hábitos de la persona: los suyos (en su espacio personal) y los de sus grupos, en un solo lugar. */
export default async function Habits({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, spaces } = await getContext();
  const today = todayISO();
  const monday = addDays(today, 1 - isoWeekday(today));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const personal = spaces.find((s) => s.kind === 'personal');
  const groups = spaces.filter((s) => s.kind === 'habits');
  const [{ data: hs }, { data: cs }] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', user.id).is('archived_at', null).order('at_time', { nullsFirst: false }),
    supabase.from('habit_checks').select('habit_id, day, user_id, done_at').eq('user_id', user.id).gte('day', addDays(today, -400)),
  ]);
  const habits = (hs ?? []) as Habit[];
  const checks = (cs ?? []) as Check[];
  const done = (h: Habit, d: string) => checks.some((c) => c.habit_id === h.id && c.day === d);
  const todays = habits.filter((h) => isDue(h, today));
  const doneN = todays.filter((h) => done(h, today)).length;
  const pct = todays.length ? Math.round((doneN / todays.length) * 100) : 0;
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name;
  const label = (d: string) => `${+d.slice(8)}/${+d.slice(5, 7)}`;

  return (
    <>
      <ViewHead label="Tus hábitos" title="Hábitos" text="Lo que quieres hacer seguido. Márcalo cada día y mira tu constancia; si quieres, síguelos en grupo.">
        {personal && <HabitWizard space={personal.id} shared={false} label="Nuevo hábito" taken={habits.map((h) => h.title)} />}
      </ViewHead>
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      <div className="stat-row">
        <div className="stat"><span className="label">Hoy</span><b className="num">{doneN}/{todays.length}</b><span>{todays.length ? `${pct}% cumplido` : 'nada para hoy'}</span></div>
        <div className="stat"><span className="label">Racha</span><b className="num">{streak(habits, checks, today)}</b><span>días seguidos con todo</span></div>
        <div className="stat"><span className="label">Hábitos</span><b className="num">{habits.length}</b><span>activos</span></div>
        <div className="stat"><span className="label">Grupos</span><b className="num">{groups.length}</b><span>{groups.map((g) => g.name).join(', ') || 'ninguno'}</span></div>
      </div>

      <section className="panel today-track">
        <div className="panel-head"><h2>Hoy</h2><span className="label">{doneN} de {todays.length}</span></div>
        <div className="hbp-bar big"><i style={{ width: `${pct}%` }} /></div>
        {todays.length ? (
          <div className="ht-grid">{todays.map((h) => <HabitToggle key={h.id} habit={h.id} day={today} done={done(h, today)} title={h.title} sub={[h.at_time ? hhmm(h.at_time) : '', groupName(h.space_id) ?? ''].filter(Boolean).join(' · ') || 'Hábito'} color={h.color} icon={h.icon} />)}</div>
        ) : <p className="muted">{habits.length ? 'Hoy no te toca ningún hábito.' : 'Todavía no tienes hábitos. Crea el primero con "Nuevo hábito".'}</p>}
      </section>

      {habits.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Tu semana</h2><span className="label">Toca un día para marcarlo</span></div>
          <div className="my-week">
            <div className="mw-row head"><span />{week.map((d, i) => <span key={d} className={d === today ? 'today' : ''}><b>{WD[i]}</b><small>{+d.slice(8)}</small></span>)}<span>Semana</span></div>
            {habits.map((h) => (
              <div key={h.id} className="mw-row">
                <span className="mw-habit" style={{ ['--hc' as string]: h.color }}><span className="hw-badge"><HabitIcon name={h.icon} size={15} /></span><span><b>{h.title}</b><small>{freqLabel(h.weekdays)}{h.at_time ? ` · ${hhmm(h.at_time)}` : ''}{groupName(h.space_id) ? ` · ${groupName(h.space_id)}` : ''}</small></span></span>
                {week.map((d) => <HabitCell key={d} habit={h.id} day={d} done={done(h, d)} due={isDue(h, d)} future={d > today} color={h.color} label={`${h.title} · ${label(d)}`} />)}
                <span className="mw-total num">{week.filter((d) => done(h, d)).length}/{week.filter((d) => isDue(h, d)).length}</span>
              </div>
            ))}
          </div>
          <details>
            <summary className="link">Dejar un hábito</summary>
            <div className="list" style={{ marginTop: 8 }}>{habits.map((h) => <div className="row" key={h.id}><span /><div className="t"><b>{h.title}</b></div><ArchiveHabit id={h.id} title={h.title} /></div>)}</div>
          </details>
        </section>
      )}

      <div className="grid g-2">
        <section className="panel">
          <div className="panel-head"><h2>Grupos de hábitos</h2></div>
          {groups.length ? (
            <div className="list">{groups.map((g) => (
              <Link className="row" key={g.id} href={`/habitos/${g.id}`}><span className="tag v">Grupo</span><div className="t"><b>{g.name}</b><span>{g.description || 'Hábitos en comunidad'}</span></div><span className="link">Abrir</span></Link>
            ))}</div>
          ) : <p className="muted" style={{ fontSize: 13.5 }}>Sigue hábitos con amigos: cada quien pone los suyos, se ven el avance del día y se animan.</p>}
          <form className="inline" action={createSpace}>
            <input type="hidden" name="template" value="habits" />
            <input className="inp" name="name" required maxLength={80} placeholder="Nombre del grupo" aria-label="Nombre del grupo" />
            <button className="pill mini" type="submit">Crear grupo</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Unirme a un grupo</h2></div>
          <p className="muted" style={{ fontSize: 13.5 }}>Pide el código a quien creó el grupo.</p>
          <form className="inline" action={joinWithCode}>
            <input className="inp" name="code" required placeholder="Código" style={{ textTransform: 'uppercase' }} aria-label="Código de invitación" />
            <button className="pill mini" type="submit">Unirme</button>
          </form>
        </section>
      </div>
    </>
  );
}
