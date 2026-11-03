import { mdToHtml } from './markdown';

/** Las notas nuevas se guardan como HTML; las viejas, en Markdown. */
export const isHtml = (body: string) => /^\s*</.test(body);

/** Contenido de una nota listo para el editor: HTML tal cual o Markdown convertido. */
export const noteHtml = (body: string) => (isHtml(body) ? body : body.trim() ? mdToHtml(body, 1) : '');

/** Texto plano de una nota, para vistas previas y búsqueda. */
export function noteText(body: string) {
  if (!isHtml(body)) return body.replace(/[#*`>\-|]/g, '').replace(/\s+/g, ' ').trim();
  return body
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/blockquote)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

const TAGS = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'HR', 'CODE', 'PRE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'FONT']);
const STYLES = ['color', 'background-color', 'text-align', 'text-decoration-line', 'text-decoration', 'font-weight', 'font-style'];

/** Deja solo el formato que usa el editor (en el navegador). Quita scripts, eventos y estilos raros. */
export function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const clean = (el: Element) => {
    for (const c of [...el.children]) {
      if (!TAGS.has(c.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED'].includes(c.tagName)) { c.remove(); continue; }
        clean(c); // primero su contenido, luego se quita la etiqueta desconocida y queda el texto
        c.replaceWith(...c.childNodes);
        continue;
      }
      for (const a of [...c.attributes]) {
        const n = a.name.toLowerCase();
        if (n === 'style') {
          const st = (c as HTMLElement).style;
          const keep = STYLES.map((p) => [p, st.getPropertyValue(p)]).filter(([, v]) => v && !/url|expression/i.test(v));
          c.removeAttribute('style');
          for (const [p, v] of keep) (c as HTMLElement).style.setProperty(p, v);
          if (!(c as HTMLElement).getAttribute('style')) c.removeAttribute('style');
        } else if (n === 'href' && c.tagName === 'A') {
          if (!/^(https?:|mailto:)/i.test(a.value.trim())) c.removeAttribute('href');
        } else if (n === 'class' && c.tagName === 'UL' && a.value === 'check') {
          // lista de chequeo
        } else if (n === 'data-done' && c.tagName === 'LI') {
          // casilla marcada
        } else if (n === 'color' && c.tagName === 'FONT') {
          // se convierte abajo
        } else c.removeAttribute(a.name);
      }
      if (c.tagName === 'A') { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noreferrer'); }
      if (c.tagName === 'FONT') {
        const span = doc.createElement('span');
        const color = c.getAttribute('color');
        if (color) span.style.color = color;
        span.append(...c.childNodes);
        c.replaceWith(span);
        clean(span);
        continue;
      }
      clean(c);
    }
  };
  const root = doc.body.firstElementChild!;
  clean(root);
  return root.innerHTML;
}
