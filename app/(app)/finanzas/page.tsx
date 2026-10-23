import Link from 'next/link';
import { getContext } from '@/lib/data';
import { FIN_STATUS, PERIOD, fmtDate, money } from '@/lib/format';
import { Empty, ViewHead } from '@/components/bits';
import { createExpense, deleteExpense, setExpenseStatus } from '@/lib/actions';

export const metadata = { title: 'Finanzas' };

function sums(rows: { amount: number; currency: string }[]) {
  const t: Record<string, number> = {};
  rows.forEach((r) => { if (Number(r.amount)) t[r.currency] = (t[r.currency] ?? 0) + Number(r.amount); });
  const k = Object.keys(t);
  return k.length ? k.map((c) => money(t[c], c)).join(' · ') : '0';
}

export default async function Finance({ searchParams }: { searchParams: Promise<{ espacio?: string; proyecto?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, spaces } = await getContext();
  const allowed = spaces.filter((s) => s.modules.finance !== false && ['owner', 'partner'].includes(s.role));
  if (!allowed.length) return <><ViewHead label="Finanzas" title="Finanzas" /><Empty action={<Link className="pill" href="/ajustes">Ir a Ajustes</Link>}>Ningún espacio tiene finanzas activas.</Empty></>;
  const space = allowed.find((s) => s.id === sp.espacio) ?? allowed[0];
  const proj = space.projects.find((p) => p.key === sp.proyecto);
  let q = supabase.from('finance_entries').select('*').eq('space_id', space.id).order('created_at');
  if (proj) q = q.eq('project_id', proj.id);
  const { data } = await q;
  const rows = data ?? [];
  const ret = `/finanzas?espacio=${space.id}${proj ? '&proyecto=' + proj.key : ''}`;

  return (
    <>
      <ViewHead label="Separadas por espacio" title="Finanzas" text="Cada espacio lleva sus cuentas aparte: tus gastos personales no se mezclan con los del estudio ni con los de un espacio donde eres socio." />
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      <nav className="tabs">{allowed.map((s) => <Link key={s.id} className="tab" href={`/finanzas?espacio=${s.id}`} aria-current={s.id === space.id ? 'page' : undefined}>{s.name}{s.role === 'partner' ? ' · socio' : ''}</Link>)}</nav>
      {space.role === 'partner' && <div className="callout">Eres socio de {space.name}, no dueño. Estos costos son del espacio compartido y no se suman a tus gastos personales.</div>}
      {space.kind === 'personal' && <p className="note">Solo tú ves esta pestaña.</p>}
      {space.projects.length > 1 && (
        <div className="chips">
          <Link className="chip" href={`/finanzas?espacio=${space.id}`} aria-current={!proj ? 'page' : undefined}>Todo el espacio</Link>
          {space.projects.map((p) => <Link key={p.key} className="chip" href={`/finanzas?espacio=${space.id}&proyecto=${p.key}`} aria-current={proj?.key === p.key ? 'page' : undefined}>{p.name}</Link>)}
        </div>
      )}
      {rows.length > 0 && (
        <div className="stat-row">
          <div className="stat"><span className="label">Fijo mensual</span><b className="num">{sums(rows.filter((r) => r.period === 'monthly' && r.status === 'active'))}</b><span>suscripciones activas</span></div>
          <div className="stat"><span className="label">Fijo anual</span><b className="num">{sums(rows.filter((r) => r.period === 'yearly' && r.status === 'active'))}</b><span>renovaciones</span></div>
          <div className="stat"><span className="label">Por pagar</span><b className="num">{sums(rows.filter((r) => r.status === 'pending'))}</b><span>pendiente</span></div>
          <div className="stat"><span className="label">Registros</span><b className="num">{rows.length}</b><span>{proj ? proj.name : space.name}</span></div>
        </div>
      )}
      {rows.length ? (
        <div className="table-wrap"><table className="t"><thead><tr><th>Concepto</th><th>Valor</th><th>Estado</th><th>Tipo</th><th>Proyecto</th><th></th></tr></thead><tbody>
          {rows.map((f) => (
            <tr key={f.id}>
              <td><b style={{ fontWeight: 500 }}>{f.concept}</b>{f.note && <div className="note">{f.note}</div>}{(f.charge_day || f.next_charge || f.occurred_on) && <div className="note">{f.charge_day ? `Cobra el día ${f.charge_day}` : f.next_charge ? `Renueva el ${fmtDate(f.next_charge)}` : fmtDate(f.occurred_on)}</div>}</td>
              <td className="num">{Number(f.amount) ? money(f.amount, f.currency) : 'Gratis'}</td>
              <td><span className={'tag ' + (f.status === 'pending' ? 'warn' : f.status === 'paid' ? 'ok' : f.status === 'cancelled' ? '' : 'v')}>{FIN_STATUS[f.status]}</span></td>
              <td className="muted">{PERIOD[f.period]}</td>
              <td className="muted">{space.projects.find((p) => p.id === f.project_id)?.name ?? 'Todo el espacio'}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                {f.status === 'pending' && <form action={setExpenseStatus} style={{ display: 'inline' }}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="status" value="paid" /><input type="hidden" name="return" value={ret} /><button className="link" type="submit">Pagado</button></form>}
                {f.status === 'active' && f.period !== 'once' && <form action={setExpenseStatus} style={{ display: 'inline' }}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="status" value="cancelled" /><input type="hidden" name="return" value={ret} /><button className="link" type="submit">Cancelar</button></form>}
                {' '}<form action={deleteExpense} style={{ display: 'inline' }}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="return" value={ret} /><button className="link" type="submit" style={{ color: 'var(--bad)' }}>Quitar</button></form>
              </td>
            </tr>
          ))}
        </tbody></table></div>
      ) : <Empty>{space.kind === 'personal' ? 'Todavía no has anotado gastos personales.' : 'No hay gastos anotados aquí.'}</Empty>}

      <details className="panel add" open={!rows.length}>
        <summary className="link" style={{ fontSize: 14 }}>+ Anotar gasto en {space.name}</summary>
        <form className="form" action={createExpense}>
          <input type="hidden" name="space" value={space.id} /><input type="hidden" name="return" value={ret} />
          <div className="two"><label className="field">Concepto<input name="concept" required placeholder="Ej.: Dominio, almuerzo, licencia" /></label><label className="field">Valor<input name="amount" required inputMode="decimal" placeholder="0" /></label></div>
          <div className="two">
            <label className="field">Moneda<select name="currency"><option value="COP">Pesos (COP)</option><option value="USD">Dólares (USD)</option></select></label>
            <label className="field">Tipo<select name="period"><option value="once">Gasto único</option><option value="monthly">Suscripción mensual</option><option value="yearly">Suscripción anual</option></select></label>
          </div>
          <div className="two">
            {space.projects.length > 0 ? <label className="field">Proyecto<select name="project" defaultValue={proj?.id ?? ''}><option value="">Todo el espacio</option>{space.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : <span />}
            <label className="field">Estado<select name="status"><option value="">Automático</option><option value="paid">Pagado</option><option value="pending">Por pagar</option><option value="active">Suscripción activa</option></select></label>
          </div>
          <div className="two"><label className="field">Fecha<input type="date" name="occurred_on" /></label><label className="field">Día de cobro (suscripciones)<input name="charge_day" type="number" min={1} max={31} /></label></div>
          <label className="field">Nota<input name="note" /></label>
          <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar gasto</button>
        </form>
      </details>
    </>
  );
}
