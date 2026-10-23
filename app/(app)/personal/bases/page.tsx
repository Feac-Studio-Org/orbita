import Link from 'next/link';
import { getContext } from '@/lib/data';
import { Empty, ViewHead } from '@/components/bits';
import { addProperty, addRow, createDatabase, deleteRow, updateRow } from '@/lib/actions';

export const metadata = { title: 'Mis bases de datos' };

type Prop = { key: string; name: string; type: string; options?: string[] };
const TYPES = [['text', 'Texto'], ['number', 'Número'], ['select', 'Selección'], ['date', 'Fecha'], ['checkbox', 'Casilla'], ['url', 'Enlace']];

function Input({ p, value, form }: { p: Prop; value?: string; form?: string }) {
  const name = 'v:' + p.key;
  if (p.type === 'select' && p.options?.length) return <select className="inp sm" name={name} defaultValue={value ?? ''} form={form} aria-label={p.name}><option value="" />{p.options.map((o) => <option key={o}>{o}</option>)}</select>;
  return <input className="inp sm" name={name} defaultValue={value ?? ''} form={form} aria-label={p.name} type={p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : 'text'} step="any" style={{ width: '100%' }} />;
}

export default async function Bases({ searchParams }: { searchParams: Promise<{ db?: string; editar?: string }> }) {
  const sp = await searchParams;
  const { supabase, spaces } = await getContext();
  const personal = spaces.find((s) => s.kind === 'personal');
  const { data: dbs } = await supabase.from('user_databases').select('*').eq('space_id', personal?.id ?? '').order('position');
  const db = dbs?.find((d) => d.id === sp.db) ?? dbs?.[0];
  const props: Prop[] = (db?.properties as Prop[]) ?? [];
  const { data: rows } = db ? await supabase.from('user_db_rows').select('id, values').eq('database_id', db.id).order('position') : { data: [] };

  return (
    <>
      <ViewHead label="Espacio personal" title="Mis bases de" accent="datos" text="Tablas a tu medida, como en Notion: tú decides las columnas." />
      <div className="docs">
        <nav className="tree">
          {dbs?.map((d) => <Link key={d.id} href={`/personal/bases?db=${d.id}`} aria-current={d.id === db?.id ? 'page' : undefined}>{d.name}</Link>)}
          <details className="add" style={{ padding: '6px 10px' }}>
            <summary className="link">+ Nueva base</summary>
            <form className="form" action={createDatabase}><input type="hidden" name="space" value={personal?.id} /><input className="inp" name="name" placeholder="Nombre" required /><button className="pill mini" type="submit">Crear</button></form>
          </details>
        </nav>
        {db ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div className="panel-head"><h2 style={{ fontSize: 20, fontWeight: 500 }}>{db.name}</h2><span className="note">{rows?.length ?? 0} filas</span></div>
            {rows?.length ? (
              <div className="table-wrap"><table className="t keep"><thead><tr>{props.map((p) => <th key={p.key}>{p.name}</th>)}<th /></tr></thead><tbody>
                {rows.map((r: any) => sp.editar === r.id ? (
                  <tr key={r.id}>
                    {props.map((p) => <td key={p.key}><Input p={p} value={r.values[p.key]} form={'f' + r.id} /></td>)}
                    <td style={{ whiteSpace: 'nowrap' }}><form id={'f' + r.id} action={updateRow}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="db" value={db.id} /><button className="pill mini" type="submit">Guardar</button></form></td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    {props.map((p, n) => <td key={p.key} className={n ? 'muted' : ''}>{p.type === 'select' && r.values[p.key] ? <span className="tag v">{r.values[p.key]}</span> : r.values[p.key]}</td>)}
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <Link className="link" href={`/personal/bases?db=${db.id}&editar=${r.id}`}>Editar</Link>{' '}
                      <form action={deleteRow} style={{ display: 'inline' }}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="db" value={db.id} /><button className="link" type="submit" style={{ color: 'var(--bad)' }}>Quitar</button></form>
                    </td>
                  </tr>
                ))}
              </tbody></table></div>
            ) : <Empty>Sin filas todavía.</Empty>}
            <div className="grid g-2">
              <details className="panel add">
                <summary className="link" style={{ fontSize: 14 }}>+ Nueva fila</summary>
                <form className="form" action={addRow}>
                  <input type="hidden" name="db" value={db.id} />
                  {props.map((p) => <label key={p.key} className="field">{p.name}<Input p={p} /></label>)}
                  <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Agregar</button>
                </form>
              </details>
              <details className="panel add">
                <summary className="link" style={{ fontSize: 14 }}>+ Nueva propiedad</summary>
                <form className="form" action={addProperty}>
                  <input type="hidden" name="db" value={db.id} />
                  <label className="field">Nombre<input name="name" required /></label>
                  <label className="field">Tipo<select name="type">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                  <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Agregar</button>
                </form>
              </details>
            </div>
          </div>
        ) : <Empty>Crea tu primera base de datos.</Empty>}
      </div>
    </>
  );
}
