import Link from 'next/link';
import { getContext } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { createNote, deleteNote, pinNote } from '@/lib/personal-actions';
import { NoteEditor } from '@/components/note-editor';
import { ViewHead } from '@/components/bits';
import { DeleteButton } from '@/components/delete-button';
import { noteText } from '@/lib/rich';

export const metadata = { title: 'Notas' };

type Note = { id: string; title: string; body: string; folder: string | null; pinned: boolean; updated_at: string };

export default async function Notes({ searchParams }: { searchParams: Promise<{ n?: string; carpeta?: string; q?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await getContext();
  const { data } = await supabase.from('notes').select('id, title, body, folder, pinned, updated_at').eq('user_id', user.id).order('pinned', { ascending: false }).order('updated_at', { ascending: false });
  const all = (data ?? []) as Note[];
  const folders = [...new Set(all.map((n) => n.folder).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'es'));
  const q = (sp.q ?? '').toLowerCase();
  const shown = all.filter((n) => (!sp.carpeta || n.folder === sp.carpeta) && (!q || n.title.toLowerCase().includes(q) || noteText(n.body).toLowerCase().includes(q)));
  const sel = all.find((n) => n.id === sp.n);
  const qs = (extra: Record<string, string | undefined>) => '/notas?' + new URLSearchParams(Object.entries({ carpeta: sp.carpeta, q: sp.q, ...extra }).filter(([, v]) => v) as [string, string][]).toString();
  const preview = (b: string) => noteText(b).slice(0, 90);

  return (
    <>
      <ViewHead label="Solo tú las ves" title="Notas" text="Apuntes, ideas y listas con formato: negritas, colores, títulos y más. Se guardan solas mientras escribes.">
        <form action={createNote}><input type="hidden" name="folder" value={sp.carpeta ?? ''} /><button className="pill solid" type="submit"><span className="pill__dot" />Nueva nota</button></form>
      </ViewHead>
      {sp.ok && <p className="ok-msg" role="status">{sp.ok}</p>}
      {sp.error && <p className="err" role="alert">{sp.error}</p>}
      <div className="nt-layout">
        <aside className="nt-side">
          <form action="/notas" className="nt-search">
            {sp.carpeta && <input type="hidden" name="carpeta" value={sp.carpeta} />}
            <input className="inp" name="q" defaultValue={sp.q} placeholder="Buscar en tus notas" aria-label="Buscar en tus notas" />
          </form>
          <div className="chips">
            <Link className="chip" href={qs({ carpeta: undefined })} aria-current={!sp.carpeta ? 'page' : undefined}>Todas · {all.length}</Link>
            {folders.map((f) => <Link key={f} className="chip" href={qs({ carpeta: f })} aria-current={sp.carpeta === f ? 'page' : undefined}>{f} · {all.filter((n) => n.folder === f).length}</Link>)}
          </div>
          <div className="nt-list">
            {shown.length ? shown.map((n) => (
              <Link key={n.id} href={qs({ n: n.id })} className={'nt-item' + (n.id === sel?.id ? ' on' : '')}>
                <b>{n.pinned && <span className="tag v">Fijada</span>}{n.title || 'Sin título'}</b>
                <span>{preview(n.body) || 'Vacía'}</span>
                <small className="note">{n.folder ? `${n.folder} · ` : ''}{fmtDate(n.updated_at)}</small>
              </Link>
            )) : <p className="muted" style={{ padding: 12 }}>{all.length ? 'Nada coincide.' : 'Todavía no tienes notas.'}</p>}
          </div>
        </aside>
        <section className="panel nt-main">
          {sel ? (
            <>
              <NoteEditor key={sel.id} id={sel.id} title={sel.title} body={sel.body} folder={sel.folder} folders={folders} />
              <div className="inline">
                <form action={pinNote}><input type="hidden" name="id" value={sel.id} /><input type="hidden" name="pinned" value={sel.pinned ? '0' : '1'} /><button className="pill mini" type="submit">{sel.pinned ? 'Quitar de arriba' : 'Fijar arriba'}</button></form>
                <DeleteButton action={deleteNote} fields={{ id: sel.id }} what={sel.title ? `la nota «${sel.title}»` : 'esta nota'} label="Eliminar" />
              </div>
            </>
          ) : <p className="muted">Elige una nota o crea una nueva.</p>}
        </section>
      </div>
    </>
  );
}
