import Link from 'next/link';
import { getContext } from '@/lib/data';
import { ROLE, initial } from '@/lib/format';
import { ViewHead } from '@/components/bits';
import { saveProfile } from '@/lib/actions';

export const metadata = { title: 'Perfil' };

export default async function Profile({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const { user, profile, spaces } = await getContext();
  return (
    <>
      <ViewHead label="Perfil" title={profile?.full_name || 'Tu perfil'} text={`${user.email} · ${profile?.timezone ?? 'America/Bogota'}`}>
        <span className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{initial(profile?.full_name)}</span>
      </ViewHead>
      {ok && <p className="ok-msg" role="status">{ok}</p>}
      <div className="grid g-home">
        <section className="panel">
          <div className="panel-head"><h2>Mis espacios</h2><Link className="link" href="/nuevo/espacio">Crear o unirse</Link></div>
          <div className="list">{spaces.map((s) => (
            <div className="row" key={s.id}><span className="tag v">{s.kind === 'personal' ? 'Solo tú' : ROLE[s.role]}</span><div className="t"><b>{s.name}</b><span>{s.projects.map((p) => p.name).join(', ') || 'Sin proyectos'}</span></div><span /></div>
          ))}</div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>App para el celular</h2><span className="label">Android</span></div>
          <p className="muted" style={{ fontSize: 13.5 }}>Hoy, proyectos, tareas y captura rápida. Funciona sin conexión con lo último que viste.</p>
          <a className="pill solid" href="/descargas/orbita.apk" download style={{ alignSelf: 'flex-start' }}><span className="pill__dot" />Descargar Órbita para Android</a>
          <p className="note">Al abrir el archivo, Android pide permitir la instalación desde el navegador.</p>
        </section>
        <form className="panel form" action={saveProfile}>
          <div className="panel-head"><h2>Datos</h2></div>
          <label className="field">Nombre<input name="full_name" defaultValue={profile?.full_name ?? ''} required /></label>
          <label className="field">Correo<input value={user.email ?? ''} readOnly disabled /></label>
          <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar</button>
        </form>
      </div>
    </>
  );
}
