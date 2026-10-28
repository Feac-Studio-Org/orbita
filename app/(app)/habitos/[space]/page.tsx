import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContext } from '@/lib/data';
import { DAYS, MES, addDays, hhmm, isoWeekday, todayISO } from '@/lib/format';
import { type Check, type Habit, WD, dayPct, freqLabel, isDue, streak } from '@/lib/habits';
import { Avatar } from '@/components/avatar';
import { HabitIcon } from '@/components/habit-icon';
import { HabitToggle } from '@/components/habit-toggle';
import { HabitWizard } from '@/components/habit-wizard';
import { NudgeButton } from '@/components/nudge-button';
import { ArchiveHabit } from '@/components/archive-habit';
import { Lines } from '@/components/charts';

export const metadata = { title: 'Hábitos' };

const ZONES = [['hoy', 'Hoy'], ['calendario', 'Calendario'], ['habitos', 'Hábitos'], ['constancia', 'Constancia']] as const;
const PEOPLE_COLORS = ['#c77dff', '#4cc38a', '#5fa8f5', '#cfaf6e', '#ec6f86', '#5fc9c0', '#e0915a', '#7c6cf0'];
const label = (iso: string) => { const [, m, d] = iso.split('-'); return `${+d} ${MES[+m - 1]}`; };

export default async function HabitsSpace({ params, searchParams }: { params: Promise<{ space: string }>; searchParams: Promise<{ zona?: string; vista?: string; fecha?: string }> }) {
  const { space: id } = await params;
  const sp = await searchParams;
  const { supabase, user, spaces } = await getContext();
  const space = spaces.find((s) => s.id === id);
  if (!space) notFound();
  const zone = ZONES.some(([z]) => z === sp.zona) ? sp.zona! : 'hoy';
  const today = todayISO();
  const from = addDays(today, -7 * 12 - 6);

  const [{ data: sm }, { data: hs }, { data: cs }, { data: gstatus }] = await Promise.all([
    supabase.from('space_members').select('user_id, role, joined_at').eq('space_id', id).order('joined_at'),
    supabase.from('habits').select('*').eq('space_id', id).is('archived_at', null).order('position').order('created_at'),
    supabase.from('habit_checks').select('habit_id, day, user_id, done_at, habits!inner(space_id)').eq('habits.space_id', id).gte('day', from),
    supabase.rpc('google_connection_status'),
  ]);
  const ids = (sm ?? []).map((m) => m.user_id);
  const { data: profs } = ids.length ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids) : { data: [] };
  const people = (sm ?? []).map((m, i) => {
    const p = profs?.find((x) => x.id === m.user_id);
    return { id: m.user_id, name: p?.full_name || 'Sin nombre', avatar: p?.avatar_url ?? null, color: PEOPLE_COLORS[i % PEOPLE_COLORS.length], me: m.user_id === user.id };
  }).sort((a, b) => (a.me ? -1 : b.me ? 1 : 0));
  const habits = (hs ?? []) as Habit[];
  const checks = (cs ?? []) as unknown as Check[];
  const googleOn = !!(gstatus as { connected: boolean }[] | null)?.[0]?.connected;
  const habitsOf = (uid: string) => habits.filter((h) => h.user_id === uid);
  const checksOf = (uid: string) => checks.filter((c) => c.user_id === uid);
  const done = (h: Habit, day: string) => checks.some((c) => c.habit_id === h.id && c.day === day);
  const byTime = (a: Habit, b: Habit) => (a.at_time ?? '99').localeCompare(b.at_time ?? '99');

  // Hábitos del grupo (mismo nombre = mismo hábito) para sugerirlos al crear uno.
  const groups = new Map<string, { title: string; icon: string; color: string; people: Set<string>; weekdays: number[]; at_time: string | null }>();
  for (const h of habits) {
    const g = groups.get(h.group_key) ?? { title: h.title, icon: h.icon, color: h.color, people: new Set(), weekdays: h.weekdays, at_time: h.at_time };
    g.people.add(h.user_id);
    groups.set(h.group_key, g);
  }
  const options = [...groups.values()].sort((a, b) => b.people.size - a.people.size).map((g) => ({ title: g.title, icon: g.icon, color: g.color, people: g.people.size, weekdays: g.weekdays, at_time: g.at_time }));
  const mine = habitsOf(user.id);
  const wizard = <HabitWizard space={id} options={options} google={googleOn} taken={mine.map((h) => h.title)} />;

  let body: React.ReactNode = null;

  if (zone === 'hoy') {
    const myToday = mine.filter((h) => isDue(h, today)).sort(byTime);
    const feed = checks.filter((c) => c.day === today).sort((a, b) => b.done_at.localeCompare(a.done_at)).slice(0, 12);
    body = (
      <>
        <section className="hb-people">
          {people.map((p) => {
            const due = habitsOf(p.id).filter((h) => isDue(h, today)).sort(byTime);
            const d = due.filter((h) => done(h, today)).length;
            const pct = due.length ? Math.round((d / due.length) * 100) : 0;
            return (
              <article key={p.id} className={'hb-person' + (p.me ? ' me' : '') + (due.length && d === due.length ? ' full' : '')} style={{ ['--pc' as string]: p.color }}>
                <div className="hbp-top">
                  <Avatar name={p.name} url={p.avatar} size={40} />
                  <div className="hbp-name"><b>{p.me ? 'Tú' : p.name.split(' ')[0]}</b><span>{due.length ? `${d} de ${due.length} hoy` : 'Nada para hoy'}</span></div>
                  <span className="hbp-pct num">{due.length ? `${pct}%` : '—'}</span>
                </div>
                <div className="hbp-bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="hbp-chips">
                  {due.map((h) => {
                    const ok = done(h, today);
                    const chip = <span className={'hbp-chip' + (ok ? ' ok' : '')} style={{ ['--hc' as string]: h.color }} title={`${h.title}${h.at_time ? ' · ' + hhmm(h.at_time) : ''}${ok ? ' · hecho' : ''}`}><HabitIcon name={ok ? 'check' : h.icon} size={14} />{h.title}</span>;
                    return !ok && !p.me && h.shared ? <span key={h.id} className="hbp-pending">{chip}<NudgeButton to={p.id} habit={h.id} name={p.name} what={h.title} /></span> : <span key={h.id}>{chip}</span>;
                  })}
                </div>
                <span className="hbp-streak"><b className="num">{streak(habitsOf(p.id), checksOf(p.id), today)}</b> días seguidos</span>
              </article>
            );
          })}
        </section>

        <div className="grid g-hb">
          <section className="panel">
            <div className="panel-head"><h2>Tus hábitos de hoy</h2><span className="label">{DAYS[isoWeekday(today) - 1]} {label(today)}</span></div>
            {myToday.length ? (
              <div className="ht-grid">{myToday.map((h) => <HabitToggle key={h.id} habit={h.id} day={today} done={done(h, today)} title={h.title} sub={h.at_time ? `${hhmm(h.at_time)}${h.minutes ? ` · ${h.minutes} min` : ''}` : 'Cuando puedas'} color={h.color} icon={h.icon} />)}</div>
            ) : <p className="muted">{mine.length ? 'Hoy no tienes hábitos programados. Descansa.' : 'Todavía no tienes hábitos aquí. Agrega el primero: puedes unirte a los del grupo con un toque.'}</p>}
            <div>{wizard}</div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>En el grupo</h2><span className="label">Hoy</span></div>
            {feed.length ? (
              <ol className="feed">
                {feed.map((c) => {
                  const h = habits.find((x) => x.id === c.habit_id);
                  const p = people.find((x) => x.id === c.user_id);
                  return (
                    <li key={c.habit_id + c.day}>
                      <span className="feed-dot" style={{ borderColor: p?.color }} />
                      <p><b>{p?.me ? 'Tú' : p?.name.split(' ')[0]}</b> cumpliste{p?.me ? '' : 'ó'} <span style={{ color: h?.color }}>{h?.title}</span></p>
                      <time className="note">{new Date(c.done_at).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })}</time>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="muted">Nadie ha marcado nada todavía hoy. Sé el primero.</p>}
          </section>
        </div>
      </>
    );
  } else if (zone === 'calendario') {
    const view = ['dia', 'semana', 'mes'].includes(sp.vista ?? '') ? sp.vista! : 'semana';
    const base = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : today;
    const step = view === 'dia' ? 1 : view === 'semana' ? 7 : 30;
    const link = (v: string, f: string) => `/habitos/${id}?zona=calendario&vista=${v}&fecha=${f}`;
    let grid: React.ReactNode;
    if (view === 'dia') {
      const items = habits.filter((h) => isDue(h, base)).sort(byTime);
      grid = items.length ? (
        <div className="hb-day">
          {items.map((h) => {
            const p = people.find((x) => x.id === h.user_id)!;
            const ok = done(h, base);
            return (
              <div key={h.id} className={'hbd-row' + (ok ? ' ok' : '')} style={{ ['--hc' as string]: h.color }}>
                <span className="hbd-time num">{h.at_time ? hhmm(h.at_time) : 'Libre'}</span>
                <span className="hbd-ico"><HabitIcon name={ok ? 'check' : h.icon} size={16} /></span>
                <b>{h.title}</b>
                <span className="hbd-who"><Avatar name={p?.name} url={p?.avatar} size={22} />{p?.me ? 'Tú' : p?.name.split(' ')[0]}</span>
                <span className={'tag ' + (ok ? 'ok' : base < today ? 'bad' : '')}>{ok ? 'Hecho' : base < today ? 'No se hizo' : 'Pendiente'}</span>
              </div>
            );
          })}
        </div>
      ) : <p className="muted">Nadie tiene hábitos este día.</p>;
    } else if (view === 'semana') {
      const monday = addDays(base, 1 - isoWeekday(base));
      const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
      grid = (
        <div className="hb-week">
          <div className="hbw-row head"><span />{week.map((d, i) => <span key={d} className={d === today ? 'today' : ''}><b>{WD[i]}</b><small>{label(d)}</small></span>)}</div>
          {people.map((p) => (
            <div key={p.id} className="hbw-row">
              <span className="hbw-who"><Avatar name={p.name} url={p.avatar} size={26} />{p.me ? 'Tú' : p.name.split(' ')[0]}</span>
              {week.map((d) => {
                const hs2 = habitsOf(p.id).filter((h) => isDue(h, d));
                const pct = dayPct(habitsOf(p.id), checksOf(p.id), d);
                return (
                  <Link key={d} href={link('dia', d)} className={'hbw-cell' + (d > today ? ' future' : '')} style={{ ['--pc' as string]: p.color, ['--a' as string]: String((pct ?? 0) / 100) }} title={pct === null ? 'Sin hábitos' : `${pct}%`}>
                    {pct === null ? <small>—</small> : (
                      <>
                        <span className="hbw-dots">{hs2.map((h) => <i key={h.id} className={done(h, d) ? 'ok' : ''} style={{ ['--hc' as string]: h.color }} />)}</span>
                        <small className="num">{d > today ? `${hs2.length}` : `${pct}%`}</small>
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      );
    } else {
      const first = base.slice(0, 8) + '01';
      const start = addDays(first, 1 - isoWeekday(first));
      const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
      grid = (
        <div className="hb-month">
          {WD.map((d) => <span key={d} className="hbm-h">{d}</span>)}
          {cells.map((d) => (
            <Link key={d} href={link('dia', d)} className={'hbm-cell' + (d.slice(0, 7) !== first.slice(0, 7) ? ' out' : '') + (d === today ? ' today' : '')}>
              <span className="num">{+d.slice(8)}</span>
              <span className="hbm-bars">
                {people.map((p) => { const pct = dayPct(habitsOf(p.id), checksOf(p.id), d); return pct === null || d > today ? null : <i key={p.id} title={`${p.name}: ${pct}%`} style={{ background: p.color, opacity: 0.25 + 0.75 * (pct / 100), height: `${Math.max(pct, 8)}%` }} />; })}
              </span>
            </Link>
          ))}
        </div>
      );
    }
    const title = view === 'dia' ? `${DAYS[isoWeekday(base) - 1]} ${label(base)}` : view === 'semana' ? `Semana del ${label(addDays(base, 1 - isoWeekday(base)))}` : `${MES[+base.slice(5, 7) - 1]} ${base.slice(0, 4)}`;
    body = (
      <section className="panel">
        <div className="panel-head">
          <h2 style={{ textTransform: 'capitalize' }}>{title}</h2>
          <div className="inline">
            <nav className="seg">{[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(([v, l]) => <Link key={v} href={link(v, base)} aria-current={view === v ? 'page' : undefined}>{l}</Link>)}</nav>
            <Link className="pill mini" href={link(view, addDays(base, -step))}>Anterior</Link>
            <Link className="pill mini" href={link(view, today)}>Hoy</Link>
            <Link className="pill mini" href={link(view, addDays(base, step))}>Siguiente</Link>
          </div>
        </div>
        {grid}
        <div className="legend">{people.map((p) => <span key={p.id}><i style={{ background: p.color }} />{p.me ? 'Tú' : p.name}</span>)}</div>
      </section>
    );
  } else if (zone === 'habitos') {
    const monday = addDays(today, 1 - isoWeekday(today));
    const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const rows = [...groups.entries()].sort((a, b) => b[1].people.size - a[1].people.size);
    body = (
      <section className="panel">
        <div className="panel-head"><h2>Hábitos del grupo</h2><div className="inline"><span className="label">Esta semana</span>{wizard}</div></div>
        {rows.length ? (
          <div className="hb-table" style={{ ['--cols' as string]: String(people.length) }}>
            <div className="hbt-row head"><span>Hábito</span>{people.map((p) => <span key={p.id} className="hbt-person"><Avatar name={p.name} url={p.avatar} size={24} />{p.me ? 'Tú' : p.name.split(' ')[0]}</span>)}</div>
            {rows.map(([key, g]) => (
              <div key={key} className="hbt-row">
                <span className="hbt-habit" style={{ ['--hc' as string]: g.color }}><span className="hw-badge"><HabitIcon name={g.icon} size={16} /></span><span><b>{g.title}</b><small>{g.people.size === people.length ? 'Todos' : `${g.people.size} de ${people.length}`}</small></span></span>
                {people.map((p) => {
                  const h = habits.find((x) => x.user_id === p.id && x.group_key === key);
                  if (!h) return <span key={p.id} className="hbt-cell none">—</span>;
                  const target = week.filter((d) => isDue(h, d)).length;
                  const got = week.filter((d) => done(h, d)).length;
                  return (
                    <span key={p.id} className="hbt-cell">
                      <span className="hbt-week">{week.map((d) => <i key={d} className={done(h, d) ? 'ok' : isDue(h, d) ? (d < today ? 'miss' : 'due') : ''} style={{ ['--hc' as string]: h.color }} />)}</span>
                      <small className="num">{got}/{target} · {h.at_time ? hhmm(h.at_time) : 'sin hora'}</small>
                      {p.me && <ArchiveHabit id={h.id} title={h.title} />}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        ) : <p className="muted">Todavía no hay hábitos. Agrega el primero y los demás podrán unirse con un toque.</p>}
        <p className="note">Cada punto es un día de esta semana: lleno si se cumplió, con borde si tocaba. Tus hábitos: {mine.map((h) => `${h.title} (${freqLabel(h.weekdays).toLowerCase()})`).join(', ') || 'ninguno todavía'}.</p>
      </section>
    );
  } else {
    // Constancia: % semanal de cada persona en las últimas 8 semanas, rachas y mapa de 12 semanas.
    const monday = addDays(today, 1 - isoWeekday(today));
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(monday, -7 * (7 - i)));
    const weekPct = (uid: string, w: string) => {
      let due = 0, got = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(w, i);
        if (d > today) break;
        for (const h of habitsOf(uid)) if (isDue(h, d)) { due++; if (done(h, d)) got++; }
      }
      return due ? Math.round((got / due) * 100) : 0;
    };
    const days84 = Array.from({ length: 84 }, (_, i) => addDays(monday, -77 + i));
    body = (
      <>
        <div className="stat-row">
          {people.slice(0, 4).map((p) => (
            <div key={p.id} className="stat" style={{ borderTop: `3px solid ${p.color}` }}>
              <span className="label">{p.me ? 'Tu racha' : `Racha de ${p.name.split(' ')[0]}`}</span>
              <b className="num">{streak(habitsOf(p.id), checksOf(p.id), today)} días</b>
              <span>{weekPct(p.id, monday)}% esta semana</span>
            </div>
          ))}
        </div>
        <section className="panel">
          <div className="panel-head"><h2>Constancia por semana</h2><span className="label">Porcentaje cumplido · 8 semanas</span></div>
          <Lines labels={weeks.map((w) => label(w))} series={people.map((p) => ({ name: p.me ? 'Tú' : p.name.split(' ')[0], color: p.color, values: weeks.map((w) => weekPct(p.id, w)) }))} />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Últimas 12 semanas</h2><span className="label">Cada cuadro es un día</span></div>
          <div className="hb-heat-list">
            {people.map((p) => (
              <div key={p.id} className="hb-heat-row">
                <span className="hbw-who"><Avatar name={p.name} url={p.avatar} size={24} />{p.me ? 'Tú' : p.name.split(' ')[0]}</span>
                <div className="hb-heat">{days84.map((d) => { const pct = d > today ? null : dayPct(habitsOf(p.id), checksOf(p.id), d); return <i key={d} title={`${label(d)}: ${pct === null ? 'sin hábitos' : pct + '%'}`} style={{ background: pct === null ? 'var(--ink-3)' : p.color, opacity: pct === null ? 1 : 0.15 + 0.85 * (pct / 100) }} />; })}</div>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="hb-head">
        <div>
          <div className="label">Hábitos en comunidad · {people.length} {people.length === 1 ? 'persona' : 'personas'}</div>
          <h1>{space.name}</h1>
        </div>
        <div className="inline">
          <div className="avatars">{people.slice(0, 6).map((p) => <Avatar key={p.id} name={p.name} url={p.avatar} size={30} />)}</div>
          {['owner', 'partner'].includes(space.role) && <Link className="pill" href={`/miembros/${id}`}>Invitar</Link>}
        </div>
      </div>
      <nav className="tabs">{ZONES.map(([z, l]) => <Link key={z} className="tab" href={`/habitos/${id}?zona=${z}`} aria-current={z === zone ? 'page' : undefined}>{l}</Link>)}</nav>
      {body}
    </>
  );
}
