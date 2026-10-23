import Link from 'next/link';
import { entrar, registrarse } from './actions';

export const metadata = { title: 'Entrar' };

export default async function Login({ searchParams }: { searchParams: Promise<{ modo?: string; error?: string; ok?: string; next?: string }> }) {
  const { modo, error, ok, next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '';
  const registro = modo === 'registro';
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand" style={{ padding: 0 }}><img src="/logo.png" alt="" style={{ width: 40, height: 40 }} /><b style={{ fontSize: 22 }}>Órbita</b></div>
        <div>
          <div className="label">FEAC Estudio</div>
          <h1 style={{ marginTop: 8 }}>{registro ? <>Crea tu <span className="serif violet">cuenta</span></> : <>Hola de <span className="serif violet">nuevo</span></>}</h1>
          <p className="muted" style={{ marginTop: 8 }}>{registro ? 'Proyectos, documentos, calendario y finanzas en un solo lugar.' : 'Entra con tu correo y tu contraseña.'}</p>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        {ok && <p className="ok-msg" role="status">{ok}</p>}
        <form className="form panel" action={registro ? registrarse : entrar}>
          <input type="hidden" name="next" value={safeNext} />
          {registro && <label className="field">Nombre<input name="nombre" required autoComplete="name" /></label>}
          <label className="field">Correo<input name="correo" type="email" required autoComplete="email" /></label>
          <label className="field">Contraseña<input name="clave" type="password" required minLength={8} autoComplete={registro ? 'new-password' : 'current-password'} /></label>
          <button className="pill solid" type="submit" style={{ justifyContent: 'center' }}>{registro ? 'Crear cuenta' : 'Entrar'}</button>
        </form>
        <p className="muted" style={{ fontSize: 13.5 }}>
          {registro ? <>¿Ya tienes cuenta? <Link className="link" href={'/login' + (safeNext ? '?next=' + encodeURIComponent(safeNext) : '')}>Entrar</Link></> : <>¿No tienes cuenta? <Link className="link" href={'/login?modo=registro' + (safeNext ? '&next=' + encodeURIComponent(safeNext) : '')}>Crear una</Link></>}
        </p>
      </div>
    </main>
  );
}
