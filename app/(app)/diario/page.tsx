import Link from 'next/link';
import { getContext } from '@/lib/data';
import { DAYS, MES, addDays, isoWeekday, todayISO } from '@/lib/format';
import { saveJournal } from '@/lib/personal-actions';
import { ViewHead } from '@/components/bits';
import { MOODS } from '@/lib/personal';

export const metadata = { title: 'Diario' };

type Entry = { day: string; mood: number | null; body: string; learned: string; grateful: string };

export default async function Journal({ searchParams }: { searchParams: Promise<{ dia?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await getContext();
  const today = todayISO();
  const day = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) && sp.dia <= today ? sp.dia : today;
  const { data } = await supabase.from('journal').select('day, mood, body, learned, grateful').eq('user_id', user.id).gte('day', addDays(today, -120)).order('day', { ascending: false });
  const entries = (data ?? []) as Entry[];
  const cur = entries.find((e) => e.day === day);
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const label = (d: string) => `${DAYS[isoWeekday(d) - 1]} ${+d.slice(8)} de ${MES[+d.slice(5, 7) - 1]}`;
  const withMood = entries.filter((e) => e.mood && e.day >= last30[0]);
  const avg = withMood.length ? withMood.reduce((a, e) => a + (e.mood ?? 0), 0) / withMood.length : null;
  let streak = 0;
  for (let d = entries.some((e) => e.day === today) ? today : addDays(today, -1); entries.some((e) => e.day === d); d = addDays(d, -1)) streak++;

  return (
    <>
      <ViewHead label="Privado · solo tú lo ves" title="Diario" text="Unas líneas al día: cómo te fue, qué aprendiste y por qué estás agradecido.">
        <div className="inline">
          <Link className="pill mini" href={`/diario?dia=${addDays(day, -1)}`}>Día anterior</Link>
          {day !== today && <Link className="pill mini" href="/diario">Hoy</Link>}
          {day < today && <Link className="pill mini" href={`/diario?dia=${addDays(day, 1)}`}>Día siguiente</Link>}
        </div>
      </ViewHead>
      {sp.ok && <p className="ok-msg" role="status">{sp.ok}</p>}
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      <div className="stat-row auto">
        <div className="stat"><span className="label">Racha</span><b className="num">{streak}</b><span>días seguidos escribiendo</span></div>
        <div className="stat"><span className="label">Ánimo · 30 días</span><b className="num">{avg ? MOODS[Math.round(avg) - 1][1] : '—'}</b><span>{withMood.length} días con ánimo</span></div>
        <div className="stat"><span className="label">Entradas</span><b className="num">{entries.filter((e) => e.day >= last30[0]).length}</b><span>en los últimos 30 días</span></div>
      </div>
      <div className="grid g-home">
        <section className="panel">
          <div className="panel-head"><h2>{day === today ? 'Hoy' : label(day)}</h2>{cur && <span className="note">Guardado</span>}</div>
          <form className="form" action={saveJournal} key={day}>
            <input type="hidden" name="day" value={day} />
            <fieldset className="jr-mood" style={{ border: 0 }}>
              <legend className="label" style={{ marginBottom: 8 }}>Cómo te sentiste</legend>
              {MOODS.map(([v, l, c]) => <label key={v} style={{ ['--mc' as string]: c }}><input type="radio" name="mood" value={v} defaultChecked={cur?.mood === v} /><span>{l}</span></label>)}
            </fieldset>
            <label className="field">Cómo te fue<textarea name="body" rows={6} defaultValue={cur?.body} placeholder="Qué pasó hoy, qué salió bien y qué no." /></label>
            <div className="two">
              <label className="field">Qué aprendiste<textarea name="learned" rows={3} defaultValue={cur?.learned} /></label>
              <label className="field">Por qué estás agradecido<textarea name="grateful" rows={3} defaultValue={cur?.grateful} /></label>
            </div>
            <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Últimos 30 días</h2></div>
          <div className="jr-chart" role="img" aria-label="Ánimo de los últimos 30 días">
            {last30.map((d) => { const e = entries.find((x) => x.day === d); const m = e?.mood ?? 0; return (
              <Link key={d} href={`/diario?dia=${d}`} title={`${label(d)}${m ? ' · ' + MOODS[m - 1][1] : e ? ' · sin ánimo' : ' · sin escribir'}`} className={d === day ? 'on' : ''}>
                <i style={{ height: m ? `${m * 20}%` : e ? '8%' : '3%', background: m ? MOODS[m - 1][2] : 'var(--ink-4)' }} />
              </Link>
            ); })}
          </div>
          <div className="list">
            {entries.slice(0, 8).map((e) => (
              <Link className="row" key={e.day} href={`/diario?dia=${e.day}`}>
                <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: e.mood ? MOODS[e.mood - 1][2] : 'var(--ink-4)' }} />
                <div className="t"><b>{label(e.day)}</b><span>{(e.body || e.learned || e.grateful).slice(0, 90) || 'Solo el ánimo'}</span></div>
                <span />
              </Link>
            ))}
            {!entries.length && <p className="muted">Todavía no has escrito. Empieza hoy.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
