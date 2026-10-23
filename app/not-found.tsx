import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="label">Órbita</div>
        <h1>No encontramos esa <span className="serif violet">página</span></h1>
        <p className="muted">Puede que no exista o que no tengas acceso.</p>
        <Link className="pill" href="/" style={{ alignSelf: 'flex-start' }}>Ir al inicio</Link>
      </div>
    </main>
  );
}
