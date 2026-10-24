/* Gráficas en SVG, sin librerías: se renderizan en el servidor y heredan los colores de la plataforma. */

export const STATUS_COLOR: Record<string, string> = { done: '#4cc38a', review: '#cfaf6e', progress: '#c77dff', todo: '#4a4453' };

type Slice = { label: string; value: number; color: string };

/** Anillo con el total al centro y la leyenda al lado. */
export function Donut({ data, center, sub, size = 148 }: { data: Slice[]; center: string; sub?: string; size?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = 42, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--ink-4)" strokeWidth="11" />
        {total > 0 && data.filter((d) => d.value).map((d) => {
          const len = (d.value / total) * c;
          const el = <circle key={d.label} cx="50" cy="50" r={r} fill="none" stroke={d.color} strokeWidth="11" strokeDasharray={`${Math.max(len - 1.2, 0.5)} ${c}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />;
          acc += len;
          return el;
        })}
        <text x="50" y={sub ? 49 : 54} textAnchor="middle" className="donut-n">{center}</text>
        {sub && <text x="50" y="63" textAnchor="middle" className="donut-s">{sub}</text>}
      </svg>
      <ul className="legend-list">
        {data.map((d) => (
          <li key={d.label}><i style={{ background: d.color }} /><span>{d.label}</span><b className="num">{d.value}</b><em className="num">{total ? Math.round((d.value / total) * 100) : 0}%</em></li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontales apiladas por estado, una fila por elemento. */
export function StackBars({ rows, max }: { rows: { label: React.ReactNode; parts: Slice[]; right?: React.ReactNode }[]; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0)));
  return (
    <div className="hbars">
      {rows.map((r, i) => (
        <div className="hbar" key={i}>
          <div className="hbar-label">{r.label}</div>
          <div className="hbar-track">
            {r.parts.filter((p) => p.value).map((p) => <i key={p.label} title={`${p.label}: ${p.value}`} style={{ width: (p.value / m) * 100 + '%', background: p.color }} />)}
          </div>
          <div className="hbar-right num">{r.right}</div>
        </div>
      ))}
    </div>
  );
}

/** Línea con área para series semanales o mensuales. */
export function AreaLine({ points, height = 170, format = (n: number) => String(n) }: { points: { label: string; value: number }[]; height?: number; format?: (n: number) => string }) {
  const W = 600, H = height, P = { l: 8, r: 8, t: 18, b: 26 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? (W - P.l - P.r) / (points.length - 1) : 0;
  const xy = points.map((p, i) => [P.l + i * step, P.t + (1 - p.value / max) * (H - P.t - P.b)] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy.at(-1)?.[0] ?? 0},${H - P.b} L${P.l},${H - P.b} Z`;
  const grid = [0.25, 0.5, 0.75, 1].map((g) => P.t + (1 - g) * (H - P.t - P.b));
  return (
    <svg className="area" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={points.map((p) => `${p.label}: ${format(p.value)}`).join(', ')}>
      <defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c77dff" stopOpacity=".35" /><stop offset="1" stopColor="#c77dff" stopOpacity="0" /></linearGradient></defs>
      {grid.map((y) => <line key={y} x1={P.l} x2={W - P.r} y1={y} y2={y} className="grid-line" />)}
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke="#c77dff" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {xy.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="3.2" fill="var(--ink)" stroke="#c77dff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          {points[i].value > 0 && <text x={x} y={y - 8} textAnchor="middle" className="pt-val">{format(points[i].value)}</text>}
          <text x={x} y={H - 8} textAnchor="middle" className="pt-lab">{points[i].label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Columnas verticales simples (por ejemplo, gasto por mes). */
export function Columns({ points, format = (n: number) => String(n), height = 170 }: { points: { label: string; value: number; color?: string }[]; format?: (n: number) => string; height?: number }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="cols" style={{ height }}>
      {points.map((p) => (
        <div className="cols-item" key={p.label} title={`${p.label}: ${format(p.value)}`}>
          <span className="cols-val num">{p.value ? format(p.value) : ''}</span>
          <div className="cols-bar"><i style={{ height: Math.max((p.value / max) * 100, p.value ? 3 : 0) + '%', background: p.color }} /></div>
          <span className="cols-lab">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
