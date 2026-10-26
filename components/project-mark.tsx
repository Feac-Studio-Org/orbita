/** Logo del proyecto; si no tiene, sus iniciales sobre su color. */
export function ProjectMark({ p, size = 34, radius }: { p: { key: string; color: string; logo_url?: string | null }; size?: number; radius?: number }) {
  const r = radius ?? Math.round(size * 0.29);
  if (p.logo_url) return <img className="pmark img" src={p.logo_url} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: r }} />;
  return <span className="pmark" style={{ width: size, height: size, borderRadius: r, background: p.color + '22', color: p.color, fontSize: Math.max(9, Math.round(size * 0.3)) }}>{p.key.slice(0, 3)}</span>;
}
