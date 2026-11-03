'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveNote } from '@/lib/personal-actions';
import { noteHtml, sanitize } from '@/lib/rich';

const TEXT_COLORS: [string, string][] = [['Normal', ''], ['Violeta', '#c77dff'], ['Rojo', '#ec6f86'], ['Naranja', '#f0a35e'], ['Amarillo', '#e6c86e'], ['Verde', '#4cc38a'], ['Azul', '#6ea8fe'], ['Gris', '#9a95a3']];
const MARKS: [string, string][] = [['Sin resaltar', ''], ['Violeta', 'rgba(157, 78, 221, .35)'], ['Rojo', 'rgba(236, 111, 134, .3)'], ['Amarillo', 'rgba(230, 200, 110, .3)'], ['Verde', 'rgba(76, 195, 138, .3)'], ['Azul', 'rgba(110, 168, 254, .3)']];

const I = {
  undo: <path d="M5.5 4 2.5 7l3 3M2.5 7h7a4 4 0 0 1 0 8h-2" />,
  redo: <path d="m10.5 4 3 3-3 3M13.5 7h-7a4 4 0 0 0 0 8h2" />,
  b: <path d="M4.5 2.5h4.25a2.75 2.75 0 0 1 0 5.5H4.5zM4.5 8h5a3 3 0 0 1 0 6h-5z" />,
  i: <path d="M10 2.5H6.5M9.5 13.5H6M9 2.5 7 13.5" />,
  u: <path d="M4.5 2.5V7a3.5 3.5 0 0 0 7 0V2.5M3.5 14h9" />,
  s: <path d="M3 8h10M10.8 4.5C10.3 3.3 9.2 2.5 8 2.5c-1.7 0-3 1-3 2.5 0 .9.5 1.6 1.4 2M5 11.5c.5 1.2 1.6 2 3 2 1.8 0 3.2-1 3.2-2.6 0-.6-.2-1.1-.6-1.5" />,
  left: <path d="M2.5 3.5h11M2.5 6.5h7M2.5 9.5h11M2.5 12.5h7" />,
  center: <path d="M2.5 3.5h11M4.5 6.5h7M2.5 9.5h11M4.5 12.5h7" />,
  right: <path d="M2.5 3.5h11M6.5 6.5h7M2.5 9.5h11M6.5 12.5h7" />,
  justify: <path d="M2.5 3.5h11M2.5 6.5h11M2.5 9.5h11M2.5 12.5h11" />,
  ul: <path d="M6 4h7.5M6 8h7.5M6 12h7.5M2.75 4h.01M2.75 8h.01M2.75 12h.01" />,
  ol: <path d="M6.5 4h7M6.5 8h7M6.5 12h7M2.5 3l1-.5V6M2.5 9.5c0-.6.5-1 1-1s1 .4 1 1c0 .8-2 1.5-2 2.5h2" />,
  check: <path d="M2 3.5h3v3H2zM2 9.5h3v3H2zM7.5 5h6M7.5 11h6" />,
  quote: <path d="M3 4.5h3.5v3.5H4.5c0 1.5.5 2.5 2 3M9.5 4.5H13v3.5h-2c0 1.5.5 2.5 2 3" />,
  link: <path d="M6.5 9.5 9.5 6.5M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" />,
  hr: <path d="M2 8h12M5 4.5h6M5 11.5h6" />,
  clear: <path d="M6 2.5h6.5M9.2 2.5 7.6 10M3 11l4 4M7 11l-4 4" />,
  color: <path d="M4 12 7.2 3.5h1.6L12 12M5.3 9h5.4" />,
  more: <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" strokeWidth="2.6" />,
};
const Ico = ({ d }: { d: React.ReactNode }) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const keep = (e: React.PointerEvent) => e.preventDefault(); // los botones no le quitan el foco al texto (clave en el celular)

function Btn({ label, icon, act, active, text }: { label: string; icon?: React.ReactNode; act: () => void; active?: boolean; text?: string }) {
  return (
    <button type="button" className={'rt-btn' + (text ? ' rt-txt' : '') + (active ? ' on' : '')} aria-label={label} title={label} aria-pressed={active} onPointerDown={keep} onClick={act}>
      {text ?? <Ico d={icon} />}
    </button>
  );
}

/** Nota con formato, como en un procesador de texto. Abre en "Ver" (una vacía, en "Escribir"); se guarda sola mientras escribes. */
export function NoteEditor({ id, title, body, folder, folders }: { id: string; title: string; body: string; folder: string | null; folders: string[] }) {
  const router = useRouter();
  const ed = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const [meta, setMeta] = useState({ title, folder: folder ?? '' });
  const [state, setState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [pop, setPop] = useState<'' | 'color' | 'align' | 'more'>('');
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState('p');
  const [view, setView] = useState(!!body.trim());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title, folder: folder ?? '', body });

  useEffect(() => {
    if (!ed.current) return;
    ed.current.innerHTML = sanitize(noteHtml(body));
    latest.current.body = ed.current.innerHTML;
    document.execCommand('defaultParagraphSeparator', false, 'p');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    setState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setState('saving');
      const v = latest.current;
      const r = await saveNote(id, { title: v.title, body: v.body, folder: v.folder || null });
      setState('error' in r ? 'error' : 'saved');
      router.refresh();
    }, 900);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const changed = () => { if (ed.current) { latest.current.body = ed.current.innerHTML; save(); } };
  const setField = (k: 'title' | 'folder', v: string) => { setMeta((m) => ({ ...m, [k]: v })); latest.current[k] = v; save(); };

  // Recordar dónde está el cursor y qué formato tiene, para que los botones actúen ahí y se vean activos.
  useEffect(() => {
    const remember = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || !ed.current?.contains(sel.anchorNode)) return;
      range.current = sel.getRangeAt(0);
      const q = (c: string) => { try { return document.queryCommandState(c); } catch { return false; } };
      setOn({ bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'), ul: q('insertUnorderedList'), ol: q('insertOrderedList') });
      let n: Node | null = sel.anchorNode, b = 'p';
      while (n && n !== ed.current) { if (n instanceof HTMLElement && /^(H2|H3|BLOCKQUOTE)$/.test(n.tagName)) { b = n.tagName.toLowerCase(); break; } n = n.parentNode; }
      setBlock(b);
    };
    document.addEventListener('selectionchange', remember);
    return () => document.removeEventListener('selectionchange', remember);
  }, []);

  const restore = () => {
    ed.current?.focus();
    const sel = window.getSelection();
    if (range.current && sel) { sel.removeAllRanges(); sel.addRange(range.current); }
  };
  const run = (cmd: string, val?: string) => {
    restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, val);
    setPop('');
    changed();
  };
  const toggleBlock = (tag: string) => run('formatBlock', block === tag ? 'p' : tag);
  const checklist = () => {
    restore();
    const esc = (window.getSelection()?.toString() || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    document.execCommand('insertHTML', false, `<ul class="check"><li>${esc || '<br>'}</li></ul>`);
    changed();
  };
  const link = () => {
    const url = window.prompt('Dirección del enlace (https://…)', 'https://')?.trim();
    if (!url || !/^https?:\/\/\S+\.\S+$/i.test(url)) return;
    restore();
    if (window.getSelection()?.toString()) run('createLink', url);
    else run('insertHTML', `<a href="${url.replace(/"/g, '%22')}">${url.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a>&nbsp;`);
  };
  const clearAll = () => { restore(); document.execCommand('removeFormat'); document.execCommand('unlink'); document.execCommand('formatBlock', false, 'p'); changed(); };

  // Tocar la casilla de una lista de chequeo la marca o desmarca. Ctrl/Cmd + clic abre un enlace.
  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const li = t.closest('ul.check > li') as HTMLElement | null;
    if (li && e.clientX - li.getBoundingClientRect().left < 28) { e.preventDefault(); li.toggleAttribute('data-done'); changed(); }
    const a = t.closest('a');
    if (a && (view || e.ctrlKey || e.metaKey)) { e.preventDefault(); window.open(a.href, '_blank', 'noreferrer'); }
  };
  // Al pegar se conserva el formato básico y se limpia lo demás.
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, html ? sanitize(html) : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'));
    changed();
  };

  return (
    <div className="nt-editor">
      <div className="nt-bar">
        <input className="nt-title" value={meta.title} onChange={(e) => setField('title', e.target.value)} placeholder="Título" aria-label="Título de la nota" maxLength={200} />
        <span className={'note nt-state ' + state}>{state === 'saved' ? 'Guardado' : state === 'saving' ? 'Guardando…' : state === 'error' ? 'No se pudo guardar' : 'Sin guardar'}</span>
      </div>
      <div className="nt-meta">
        <input className="inp sm" list="nt-folders" value={meta.folder} onChange={(e) => setField('folder', e.target.value)} placeholder="Carpeta (opcional)" aria-label="Carpeta" maxLength={60} />
        <datalist id="nt-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        <nav className="seg" aria-label="Modo">
          <a href="#" aria-current={view ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setView(true); setPop(''); }}>Ver</a>
          <a href="#" aria-current={!view ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setView(false); setTimeout(() => ed.current?.focus(), 0); }}>Escribir</a>
        </nav>
      </div>

      {!view && <div className="rt-bar" role="toolbar" aria-label="Formato del texto">
        <div className="rt-group">
          <Btn label="Deshacer (Ctrl+Z)" icon={I.undo} act={() => run('undo')} />
          <Btn label="Rehacer (Ctrl+Y)" icon={I.redo} act={() => run('redo')} />
        </div>
        <div className="rt-group">
          <Btn label="Título" text="T1" act={() => toggleBlock('h2')} active={block === 'h2'} />
          <Btn label="Subtítulo" text="T2" act={() => toggleBlock('h3')} active={block === 'h3'} />
        </div>
        <div className="rt-group">
          <Btn label="Negrita (Ctrl+B)" icon={I.b} act={() => run('bold')} active={on.bold} />
          <Btn label="Cursiva (Ctrl+I)" icon={I.i} act={() => run('italic')} active={on.italic} />
          <Btn label="Subrayado (Ctrl+U)" icon={I.u} act={() => run('underline')} active={on.underline} />
          <Btn label="Tachado" icon={I.s} act={() => run('strikeThrough')} active={on.strike} />
        </div>
        <div className="rt-group rt-rel">
          <Btn label="Color y resaltado" icon={I.color} act={() => setPop(pop === 'color' ? '' : 'color')} active={pop === 'color'} />
          <Btn label="Alinear" icon={I.center} act={() => setPop(pop === 'align' ? '' : 'align')} active={pop === 'align'} />
          {pop === 'color' && (
            <div className="rt-pop" role="dialog" aria-label="Color y resaltado">
              <span className="rt-pop-l">Color de letra</span>
              <div className="rt-swatches">{TEXT_COLORS.map(([n, c]) => <button key={n} type="button" className="rt-sw" title={n} aria-label={n} style={{ background: c || 'var(--paper)' }} onPointerDown={keep} onClick={() => run('foreColor', c || '#f4f2f7')} />)}</div>
              <span className="rt-pop-l">Resaltado</span>
              <div className="rt-swatches">{MARKS.map(([n, c]) => <button key={n} type="button" className={'rt-sw' + (c ? '' : ' none')} title={n} aria-label={n} style={{ background: c || 'transparent' }} onPointerDown={keep} onClick={() => run('hiliteColor', c || 'transparent')} />)}</div>
            </div>
          )}
          {pop === 'align' && (
            <div className="rt-pop rt-pop-row" role="dialog" aria-label="Alinear">
              <Btn label="A la izquierda" icon={I.left} act={() => run('justifyLeft')} />
              <Btn label="Al centro" icon={I.center} act={() => run('justifyCenter')} />
              <Btn label="A la derecha" icon={I.right} act={() => run('justifyRight')} />
              <Btn label="Justificado" icon={I.justify} act={() => run('justifyFull')} />
            </div>
          )}
        </div>
        <div className="rt-group">
          <Btn label="Lista con viñetas" icon={I.ul} act={() => run('insertUnorderedList')} active={on.ul} />
          <Btn label="Lista numerada" icon={I.ol} act={() => run('insertOrderedList')} active={on.ol} />
          <Btn label="Lista de chequeo" icon={I.check} act={checklist} />
        </div>
        {/* En el computador se ven siempre; en el celular quedan dentro de "Más" para que la barra quepa en dos filas. */}
        <div className="rt-group rt-extra">
          <Btn label="Cita" icon={I.quote} act={() => toggleBlock('blockquote')} active={block === 'blockquote'} />
          <Btn label="Enlace" icon={I.link} act={link} />
          <Btn label="Línea divisoria" icon={I.hr} act={() => run('insertHorizontalRule')} />
          <Btn label="Quitar formato" icon={I.clear} act={clearAll} />
        </div>
        <div className="rt-group rt-more">
          <Btn label="Más opciones" icon={I.more} act={() => setPop(pop === 'more' ? '' : 'more')} active={pop === 'more'} />
        </div>
        {pop === 'more' && (
          <div className="rt-pop rt-pop-row rt-pop-more" role="dialog" aria-label="Más opciones">
            <Btn label="Cita" icon={I.quote} act={() => toggleBlock('blockquote')} active={block === 'blockquote'} />
            <Btn label="Enlace" icon={I.link} act={() => { setPop(''); link(); }} />
            <Btn label="Línea divisoria" icon={I.hr} act={() => run('insertHorizontalRule')} />
            <Btn label="Quitar formato" icon={I.clear} act={() => { setPop(''); clearAll(); }} />
          </div>
        )}
      </div>}

      <div
        ref={ed}
        className={'md nt-rich' + (view ? ' viewing' : '')}
        contentEditable={!view}
        suppressContentEditableWarning
        title={view ? 'Doble clic para escribir' : undefined}
        onDoubleClick={() => { if (view) { setView(false); setTimeout(() => ed.current?.focus(), 0); } }}
        role="textbox"
        aria-multiline="true"
        aria-label="Contenido de la nota"
        data-placeholder={view ? 'Nota vacía. Toca Escribir.' : 'Escribe aquí…'}
        onInput={changed}
        onClick={onClick}
        onPaste={onPaste}
        onFocus={() => setPop('')}
      />
    </div>
  );
}
