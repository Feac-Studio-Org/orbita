import Link from 'next/link';
import { PRIORITY, fmtDate, isLate } from '@/lib/format';

export function ViewHead({ label, title, accent, text, children }: { label: string; title: string; accent?: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="view-head">
      <div>
        <div className="label">{label}</div>
        <h1>{title}{accent && <> <span className="serif violet">{accent}</span></>}</h1>
        {text && <p>{text}</p>}
      </div>
      {children}
    </div>
  );
}

export function IssueRow({ issue, project }: { issue: { key: string; title: string; status: string; priority: string; due_date: string | null }; project?: string }) {
  const late = isLate(issue.due_date, issue.status);
  return (
    <Link href={`/t/${issue.key}`} className="row">
      <span className={'prio ' + issue.priority} title={'Prioridad ' + PRIORITY[issue.priority]} />
      <div className="t"><b>{issue.title}</b><span><span className="key">{issue.key}</span>{project ? ' · ' + project : ''}</span></div>
      {issue.due_date ? <span className={'tag num ' + (late ? 'bad' : issue.status === 'done' ? 'ok' : '')}>{late ? 'Atrasada · ' : ''}{fmtDate(issue.due_date)}</span> : <span />}
    </Link>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="empty"><p>{children}</p>{action}</div>;
}

/** Markdown sencillo y seguro: escapa todo el HTML y solo interpreta títulos, listas, tablas, código, negritas y enlaces. */
export function Markdown({ text }: { text: string }) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
  const lines = (text || '').replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++; out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>'); continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [h, ...b] = rows;
      out.push('<div style="overflow-x:auto"><table><thead><tr>' + h.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + b.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (/^\s*([*-]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items: string[] = [];
      while (i < lines.length && /^\s*([*-]|\d+\.)\s+/.test(lines[i])) items.push('<li>' + inline(lines[i++].replace(/^\s*([*-]|\d+\.)\s+/, '')) + '</li>');
      out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>')); continue;
    }
    const hm = /^(#{1,4})\s+(.*)$/.exec(l);
    if (hm) { out.push(`<h${Math.min(hm[1].length + 2, 4)}>` + inline(hm[2]) + `</h${Math.min(hm[1].length + 2, 4)}>`); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*\||\s*([*-]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    out.push('<p>' + para.map(inline).join('<br>') + '</p>');
  }
  return <div className="md" dangerouslySetInnerHTML={{ __html: out.join('') }} />;
}
