import Link from 'next/link';
import { getContext } from '@/lib/data';
import { googleConfigured } from '@/lib/google';
import { hasDrive, type Selection } from '@/lib/drive';
import { saveBackup } from '@/lib/actions';
import { ViewHead } from '@/components/bits';

export const metadata = { title: 'Copia en Google Drive' };
export const maxDuration = 300;

const PARTS = [['docs', 'Documentación'], ['tasks', 'Tareas'], ['finance', 'Finanzas']] as const;

export default async function Backup({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase, user, spaces } = await getContext();
  const [{ data: scope }, { data: status }, { data: settings }] = await Promise.all([
    supabase.rpc('google_scope'),
    supabase.rpc('google_connection_status'),
    supabase.from('backup_settings').select('selection, auto_weekly, last_run, last_result').eq('user_id', user.id).maybeSingle(),
  ]);
  const conn = Array.isArray(status) ? status[0] : status;
  const connected = hasDrive(scope as string | null);
  const sel = (settings?.selection ?? {}) as Selection;
  const on = (k: string, part: string) => (sel[k] ?? []).includes(part as never);
  const canMoney = (role: string) => ['owner', 'partner'].includes(role);

  return (
    <>
      <ViewHead label="Ajustes" title="Copia en " accent="Google Drive" text="Guarda una copia de lo que elijas en tu Drive, en carpetas por espacio y proyecto. Órbita solo puede ver y cambiar los archivos que ella misma crea; el resto de tu Drive no lo toca." />
      {ok && <p className="ok-msg" role="status">{ok}</p>}
      {error && <p className="err" role="alert">{error}</p>}

      <section className="panel backup-status">
        <div className="bs-main">
          <span className={'bs-dot' + (connected ? ' on' : '')} />
          <div>
            <b>{connected ? 'Google Drive conectado' : 'Google Drive sin conectar'}</b>
            <p className="muted">{connected ? `Cuenta ${conn?.google_email ?? ''}` : 'Conecta tu cuenta de Google para poder copiar.'}</p>
          </div>
        </div>
        <div className="bs-side">
          {settings?.last_run && <span className="note">Última copia: {new Date(settings.last_run).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })}{settings.last_result ? ` · ${settings.last_result}` : ''}</span>}
          {!googleConfigured() ? <span className="tag warn">Falta configurar Google en el servidor</span>
            : <Link className={'pill' + (connected ? '' : ' solid')} href="/api/google/conectar?servicio=drive">{connected ? 'Volver a conectar' : 'Conectar Google Drive'}</Link>}
        </div>
      </section>

      <form action={saveBackup} className="backup-form">
        <section className="panel">
          <div className="panel-head"><h2>Qué se copia</h2><span className="label">Por espacio y proyecto</span></div>
          <p className="muted" style={{ fontSize: 13.5 }}>En Drive queda: <span className="mono">Órbita / Espacio / Proyecto</span> con la carpeta Documentación (un documento de Google por página), la hoja de Tareas y la hoja de Finanzas.</p>
          <div className="bk-spaces">
            {spaces.map((s) => (
              <div key={s.id} className="bk-space">
                <div className="bk-row bk-head">
                  <b>{s.name}</b>
                  {PARTS.map(([k, l]) => <span key={k} className="label">{l}</span>)}
                </div>
                {s.projects.map((p) => (
                  <div key={p.id} className="bk-row">
                    <span className="bk-name"><i style={{ background: p.color }} />{p.name}<span className="key">{p.key}</span></span>
                    {PARTS.map(([k, l]) => (k === 'finance' && !canMoney(s.role))
                      ? <span key={k} className="note" title="Solo dueños y socios ven las finanzas">—</span>
                      : <label key={k} className="bk-check"><input type="checkbox" name={`sel:${p.id}:${k}`} defaultChecked={on(p.id, k)} /><span className="sr">{l} de {p.name}</span></label>)}
                  </div>
                ))}
                {canMoney(s.role) && (
                  <div className="bk-row bk-extra">
                    <span className="bk-name muted">Finanzas generales del espacio</span>
                    <span /><span />
                    <label className="bk-check"><input type="checkbox" name={`sel:space:${s.id}:finance`} defaultChecked={on('space:' + s.id, 'finance')} /><span className="sr">Finanzas generales de {s.name}</span></label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <label className="bk-auto"><input type="checkbox" name="auto" defaultChecked={settings?.auto_weekly ?? false} /><span><b>Copia semanal automática</b><br /><span className="muted">Si pasó una semana desde la última copia, Órbita la repite sola cuando entras.</span></span></label>
          <div className="inline">
            <button className="pill" type="submit" name="run" value="0">Guardar selección</button>
            <button className="pill solid" type="submit" name="run" value="1" disabled={!connected}>Guardar y copiar ahora</button>
          </div>
          <p className="note">Cada copia actualiza los mismos archivos; no se duplican. Si borras un archivo en Drive, la siguiente copia lo vuelve a crear.</p>
        </section>
      </form>
    </>
  );
}
