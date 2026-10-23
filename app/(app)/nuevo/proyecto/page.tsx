import { notFound } from 'next/navigation';
import { getContext } from '@/lib/data';
import { ViewHead } from '@/components/bits';
import { createProject } from '@/lib/actions';

export const metadata = { title: 'Nuevo proyecto' };

export default async function NewProject({ searchParams }: { searchParams: Promise<{ espacio?: string; error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const { spaces } = await getContext();
  const space = spaces.find((s) => s.id === sp.espacio) ?? spaces.find((s) => s.role === 'owner' && s.kind === 'team');
  if (!space) notFound();
  return (
    <>
      <ViewHead label={space.name} title="Nuevo" accent="proyecto" text="Cada proyecto tiene su tablero, backlog, épicas, documentos y, si lo activas, sus finanzas." />
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      {sp.ok && <p className="ok-msg" role="status">{sp.ok}</p>}
      <form className="panel form" action={createProject} style={{ maxWidth: 640 }}>
        <input type="hidden" name="space" value={space.id} />
        <label className="field">Nombre<input name="name" required autoFocus placeholder="Ej.: Ciclozen" /></label>
        <div className="two">
          <label className="field">Clave (2 a 6 letras)<input name="key" maxLength={6} placeholder="Ej.: CZ" style={{ textTransform: 'uppercase' }} /></label>
          <label className="field">De qué se trata<input name="description" placeholder="Una línea" /></label>
        </div>
        <p className="note">Las tareas se numeran con la clave: CZ-1, CZ-2… Si la dejas vacía, se toma de las primeras letras del nombre.</p>
        <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Crear proyecto</button>
      </form>
    </>
  );
}
