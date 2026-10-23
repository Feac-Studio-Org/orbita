import { headers } from 'next/headers';
import { getContext } from '@/lib/data';
import { ViewHead } from '@/components/bits';
import { TokenForm } from '@/components/token-form';
import { revokeToken, savePermissions } from '@/lib/actions';
import { TOOLS } from '@/lib/mcp-tools';

export const metadata = { title: 'Asistente' };
const CLIENTS = [['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['gemini', 'Gemini'], ['kimi', 'Kimi'], ['cursor', 'Cursor'], ['otro', 'Otra IA con MCP']];

export default async function Assistant({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, spaces } = await getContext();
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const [{ data: settings }, { data: access }, { data: tokens }, { data: log }] = await Promise.all([
    supabase.from('assistant_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('assistant_space_access').select('space_id, allowed').eq('user_id', user.id),
    supabase.from('assistant_tokens').select('id, name, last4, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }),
    supabase.from('activity_log').select('summary, created_at').eq('actor_kind', 'assistant').order('created_at', { ascending: false }).limit(10),
  ]);
  const allowed = (id: string) => access?.find((a) => a.space_id === id)?.allowed ?? true;

  return (
    <>
      <ViewHead label="Módulo opcional · se apaga en Ajustes" title="Asistente" text="Órbita no trae una IA propia. Conectas la que ya usas por MCP y, desde su app, por texto o por voz, le pides que registre avances, cree tareas, consulte tu día o anote gastos." />
      {sp.ok && <p className="ok-msg" role="status">{sp.ok}</p>}
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      <div className="grid g-home">
        <section className="panel">
          <div className="panel-head"><h2>Conectar tu IA</h2><span className="label">Recomendado</span></div>
          <p className="muted" style={{ fontSize: 13.5 }}>Pega esta dirección como conector o servidor MCP en tu IA. Te pedirá entrar a Órbita y permitir el acceso; no hay que copiar tokens.</p>
          <input className="inp mono" readOnly value={`${origin}/api/mcp`} aria-label="Dirección del servidor MCP" />
          <div className="list" style={{ fontSize: 13.5 }}>
            <div className="row" style={{ gridTemplateColumns: '110px minmax(0,1fr)' }}><b>Claude</b><span>claude.ai → Ajustes → Conectores → Agregar conector personalizado. Queda también en la app del celular, con voz.</span></div>
            <div className="row" style={{ gridTemplateColumns: '110px minmax(0,1fr)' }}><b>ChatGPT</b><span>Ajustes → Aplicaciones y conectores → Avanzado → Modo desarrollador → Crear. Autenticación: OAuth.</span></div>
            <div className="row" style={{ gridTemplateColumns: '110px minmax(0,1fr)' }}><b>Claude Code</b><span className="mono" style={{ fontSize: 12 }}>claude mcp add --transport http --scope user orbita {origin}/api/mcp</span></div>
            <div className="row" style={{ gridTemplateColumns: '110px minmax(0,1fr)' }}><b>Otras</b><span>Cualquier cliente MCP con transporte HTTP y OAuth. Si solo acepta una URL fija, usa un token personal.</span></div>
          </div>
          <details className="add">
            <summary className="link">Usar un token personal en lugar de OAuth</summary>
            <TokenForm origin={origin} />
          </details>
        </section>
        <form className="panel form" action={savePermissions}>
          <div className="panel-head"><h2>Qué puede ver y hacer</h2></div>
          <label className="field">IA que usas<select name="client" defaultValue={settings?.client ?? 'claude'}>{CLIENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {spaces.map((s) => (
            <label key={s.id} className="toggle-row"><input type="hidden" name="space" value={s.id} /><div><b>Ver {s.name}</b></div><input type="checkbox" name={`sp:${s.id}`} defaultChecked={allowed(s.id)} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} /></label>
          ))}
          <label className="toggle-row"><div><b>Crear y editar tareas</b><span>Mover estados, comentar y crear tareas.</span></div><input type="checkbox" name="can_write" defaultChecked={settings?.can_write ?? true} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} /></label>
          <label className="toggle-row"><div><b>Anotar gastos</b><span>Solo en espacios donde eres dueño o socio.</span></div><input type="checkbox" name="can_finance" defaultChecked={settings?.can_finance ?? false} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} /></label>
          <p className="note">El asistente nunca borra nada.</p>
          <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar permisos</button>
        </form>
      </div>
      <div className="grid g-2">
        <section className="panel">
          <div className="panel-head"><h2>IAs conectadas</h2><span className="label">Revoca para desconectar</span></div>
          {tokens?.length ? <div className="list">{tokens.map((t) => (
            <div className="row" key={t.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <div className="t"><b>{t.name}</b><span className="mono">orb_…{t.last4} · {t.revoked_at ? 'revocado' : t.last_used_at ? 'usado ' + t.last_used_at.slice(0, 10) : 'sin usar'}</span></div>
              {!t.revoked_at && <form action={revokeToken}><input type="hidden" name="id" value={t.id} /><button className="pill mini danger" type="submit">Revocar</button></form>}
            </div>
          ))}</div> : <p className="muted">Sin tokens todavía.</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Herramientas que expone</h2><span className="label">MCP</span></div>
          <div className="list">{TOOLS.map((t) => <div className="row" key={t.name} style={{ gridTemplateColumns: 'auto minmax(0,1fr)' }}><code className="mono violet" style={{ fontSize: 12 }}>{t.name}</code><span className="muted" style={{ fontSize: 13 }}>{t.description}</span></div>)}</div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Lo que hizo tu IA</h2></div>
        {log?.length ? <div className="list">{log.map((l, n) => <div className="row" key={n} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}><div className="t"><b>{l.summary}</b></div><span className="note num">{new Date(l.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })}</span></div>)}</div> : <p className="muted">Todavía nada.</p>}
      </section>
    </>
  );
}
