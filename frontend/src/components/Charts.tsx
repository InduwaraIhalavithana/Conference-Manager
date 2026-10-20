import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { formatNumber } from '../i18n/format';
import './Charts.css';

export interface Series {
  label: string;
  color: string;
  values: number[];
}

function niceMax(n: number): number {
  if (n <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) if (s * p >= n) return s * p;
  return 10 * p;
}

/** Line/area chart over days. `labels` are x-axis captions (already formatted). */
export function AreaChart({ series, labels, height = 240, empty }: { series: Series[]; labels: string[]; height?: number; empty?: ReactNode }) {
  const { lang } = useApp();
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the container's real width, so labels stay the same size on any screen.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const P = { l: 40, r: 14, t: 16, b: 30 };
  const n = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => P.l + (n <= 1 ? 0 : (i * (W - P.l - P.r)) / (n - 1));
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
  const total = series.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(W / 110))));

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg" role="img" onMouseLeave={() => setHover(null)}>
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={P.l} x2={W - P.r} y1={y(tv)} y2={y(tv)} className="chart__grid" />
            <text x={P.l - 8} y={y(tv) + 4} className="chart__tick" textAnchor="end">{formatNumber(tv, lang)}</text>
          </g>
        ))}
        {labels.map((l, i) => ((i % every === 0 && n - 1 - i >= every) || i === n - 1) && (
          <text key={i} x={x(i)} y={H - 8} className="chart__tick" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{l}</text>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`);
          const line = `M${pts.join(' L')}`;
          const area = `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
          return (
            <g key={s.label}>
              <defs>
                <linearGradient id={`ag-${si}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#ag-${si})`} className="chart__area" />
              <path d={line} fill="none" stroke={s.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="chart__line" />
              {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover])} r="5.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />}
            </g>
          );
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} className="chart__cursor" />}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W - P.l - P.r) / Math.max(1, n - 1) / 2}
            y={P.t}
            width={(W - P.l - P.r) / Math.max(1, n - 1)}
            height={H - P.t - P.b}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div className="chart__tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{labels[hover]}</strong>
          {series.map((s) => (
            <span key={s.label}><i style={{ background: s.color }} /> {s.label}: {formatNumber(s.values[hover], lang)}</span>
          ))}
        </div>
      )}
      {total === 0 && empty && <div className="chart__empty">{empty}</div>}
      {series.length > 1 && (
        <div className="chart__legend">
          {series.map((s) => <span key={s.label}><i style={{ background: s.color }} /> {s.label}</span>)}
        </div>
      )}
    </div>
  );
}

/** Vertical columns (weekdays, months). */
export function ColumnChart({ items, height = 220, color = 'var(--accent-strong)', highlight }: {
  items: { label: string; value: number }[]; height?: number; color?: string; highlight?: number;
}) {
  const { lang } = useApp();
  const max = niceMax(Math.max(1, ...items.map((i) => i.value)));
  return (
    <div className="cols" style={{ height }}>
      {items.map((it, i) => (
        <div key={it.label + i} className={`cols__col${i === highlight ? ' cols__col--hl' : ''}`} title={`${it.label}: ${formatNumber(it.value, lang)}`}>
          <span className="cols__val">{formatNumber(it.value, lang)}</span>
          <div className="cols__track">
            <div className="cols__bar" style={{ height: `${(it.value / max) * 100}%`, background: color, animationDelay: `${i * 40}ms` }} />
          </div>
          <span className="cols__label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bars: long labels (Sinhala/Tamil names, titles) stay readable. */
export function BarList({ items }: { items: { label: ReactNode; value: number; color?: string; sub?: ReactNode; key?: string | number }[] }) {
  const { lang } = useApp();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="barlist">
      {items.map((it, i) => (
        <div key={it.key ?? i} className="barlist__row">
          <div className="barlist__head">
            <span className="barlist__label">{it.label}</span>
            <strong>{formatNumber(it.value, lang)}</strong>
          </div>
          <div className="bar"><span style={{ width: `${(it.value / max) * 100}%`, background: it.color }} /></div>
          {it.sub && <div className="small muted">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Donut with legend. */
export function Donut({ items, center, size = 190 }: {
  items: { label: string; value: number; color: string }[]; center?: ReactNode; size?: number;
}) {
  const { lang } = useApp();
  const total = items.reduce((s, i) => s + i.value, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  const arcs = useMemo(() => {
    let offset = 0;
    return items.map((it) => {
      const len = total ? (it.value / total) * C : 0;
      const arc = { ...it, dash: `${len} ${C - len}`, offset: -offset };
      offset += len;
      return arc;
    });
  }, [items, total, C]);
  return (
    <div className="donut">
      <div className="donut__ring" style={{ width: size, height: size }}>
        <svg viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="22" />
          {arcs.map((a) => (
            <circle key={a.label} cx="90" cy="90" r={R} fill="none" stroke={a.color} strokeWidth="22"
              strokeDasharray={a.dash} strokeDashoffset={a.offset} transform="rotate(-90 90 90)" className="donut__arc">
              <title>{`${a.label}: ${a.value}`}</title>
            </circle>
          ))}
        </svg>
        <div className="donut__center">{center ?? <strong>{formatNumber(total, lang)}</strong>}</div>
      </div>
      <ul className="donut__legend">
        {items.map((i) => (
          <li key={i.label}>
            <i style={{ background: i.color }} />
            <span>{i.label}</span>
            <strong>{formatNumber(i.value, lang)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
