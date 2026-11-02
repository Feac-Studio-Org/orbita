'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveNote } from '@/lib/personal-actions';
import { mdToHtml } from '@/lib/markdown';

/** Editor de una nota: se guarda solo mientras escribes. "Ver" muestra el texto con formato. */
export function NoteEditor({ id, title, body, folder, folders }: { id: string; title: string; body: string; folder: string | null; folders: string[] }) {
  const router = useRouter();
  const [v, setV] = useState({ title, body, folder: folder ?? '' });
  const [state, setState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [view, setView] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setState('saving');
      const r = await saveNote(id, { title: v.title, body: v.body, folder: v.folder || null });
      setState('error' in r ? 'error' : 'saved');
      router.refresh();
    }, 900);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [v, id, router]);

  return (
    <div className="nt-editor">
      <div className="nt-bar">
        <input className="nt-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Título" aria-label="Título de la nota" maxLength={200} />
        <span className={'note nt-state ' + state}>{state === 'saved' ? 'Guardado' : state === 'saving' ? 'Guardando…' : state === 'error' ? 'No se pudo guardar' : 'Sin guardar'}</span>
      </div>
      <div className="nt-meta">
        <input className="inp sm" list="nt-folders" value={v.folder} onChange={(e) => setV({ ...v, folder: e.target.value })} placeholder="Carpeta (opcional)" aria-label="Carpeta" maxLength={60} />
        <datalist id="nt-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        <nav className="seg" aria-label="Modo">
          <a href="#" aria-current={!view ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setView(false); }}>Escribir</a>
          <a href="#" aria-current={view ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setView(true); }}>Ver</a>
        </nav>
      </div>
      {view
        ? <div className="md nt-view" dangerouslySetInnerHTML={{ __html: mdToHtml(v.body || '_Nota vacía._') }} />
        : <textarea className="nt-body" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder={'Escribe aquí.\n\n# Título\n- lista\n**negrita**'} aria-label="Contenido" />}
    </div>
  );
}
