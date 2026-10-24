import Link from 'next/link';
import { PRIORITY, fmtDate, isLate } from '@/lib/format';
import { mdToHtml } from '@/lib/markdown';

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

/** Markdown sencillo y seguro (ver lib/markdown.ts). */
export function Markdown({ text }: { text: string }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />;
}
