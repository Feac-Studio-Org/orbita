import { notFound } from 'next/navigation';
import { getContext } from '@/lib/data';
import { ROLE } from '@/lib/format';
import { ViewHead } from '@/components/bits';
import { createInvite, toggleAccess } from '@/lib/actions';

export const metadata = { title: 'Miembros y roles' };

export default async function Members({ params, searchParams }: { params: Promise<{ space: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { space: id } = await params;
  const sp = await searchParams;
  const { supabase, spaces } = await getContext();
  const space = spaces.find((s) => s.id === id);
  if (!space) notFound();
  const canManage = ['owner', 'partner'].includes(space.role);
  const { data: members } = await supabase.from('space_members').select('user_id, role').eq('space_id', space.id);
  const userIds = (members ?? []).map((m) => m.user_id);
  const [{ data: people }, { data: access }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', userIds),
    supabase.from('project_access').select('project_id, user_id').in('project_id', space.projects.map((p) => p.id)),
  ]);

  return (
    <>
      <ViewHead label={space.name} title="Miembros y roles" text="Dueños y socios ven todo el espacio. Los miembros e invitados ven solo los proyectos que les compartas." />
      {sp.ok && <p className="ok-msg" role="status">{sp.ok}</p>}
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      <div className="table-wrap"><table className="t keep"><thead><tr><th>Persona</th><th>Rol</th>{space.projects.map((p) => <th key={p.id}>{p.key}</th>)}</tr></thead><tbody>
        {(members ?? []).map((m) => (
          <tr key={m.user_id}>
            <td>{people?.find((x) => x.id === m.user_id)?.full_name || 'Sin nombre'}</td>
            <td className="muted">{ROLE[m.role]}</td>
            {space.projects.map((p) => {
              const all = m.role === 'owner' || m.role === 'partner';
              const has = all || access?.some((a) => a.project_id === p.id && a.user_id === m.user_id);
              if (all || !canManage) return <td key={p.id} style={{ color: has ? 'var(--ok)' : 'var(--faint)' }}>{has ? 'Ve' : '—'}</td>;
              return (
                <td key={p.id}>
                  <form action={toggleAccess}><input type="hidden" name="project" value={p.id} /><input type="hidden" name="user" value={m.user_id} /><input type="hidden" name="space" value={space.id} /><input type="hidden" name="on" value={has ? '0' : '1'} />
                    <button type="submit" className="link" style={{ color: has ? 'var(--ok)' : 'var(--faint)' }}>{has ? 'Ve' : '—'}</button></form>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody></table></div>
      {space.role === 'owner' && (
        <form className="panel form" action={createInvite} style={{ maxWidth: 640 }}>
          <div className="panel-head"><h2>Invitar</h2></div>
          <input type="hidden" name="space" value={space.id} />
          <div className="two">
            <label className="field">Correo (opcional: si lo pones, solo esa persona puede usar el código)<input name="email" type="email" /></label>
            <label className="field">Rol<select name="role"><option value="member">Miembro: trabaja en sus proyectos</option><option value="guest">Invitado: solo lectura</option><option value="partner">Socio: ve todo el espacio</option></select></label>
          </div>
          {space.projects.length > 0 && <fieldset style={{ border: 0 }}><legend className="field" style={{ marginBottom: 6 }}>Proyectos que podrá ver</legend><div className="chips">{space.projects.map((p) => <label key={p.id} className="chip"><input type="checkbox" name="projects" value={p.id} style={{ accentColor: 'var(--violet)', marginRight: 6 }} />{p.name}</label>)}</div></fieldset>}
          <button className="pill solid" type="submit" style={{ alignSelf: 'flex-start' }}>Generar código de invitación</button>
          <p className="note">La persona entra a Órbita, va a «Crear un espacio» y escribe el código.</p>
        </form>
      )}
    </>
  );
}
