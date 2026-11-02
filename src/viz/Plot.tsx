import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cssColor, useTheme } from '@/lib/theme';

/**
 * Lightweight, theme-aware canvas plotter tuned for signals: lines, steps, stems, scatter,
 * eye-diagram trace bundles, log axes, reference lines and shaded bands.
 */
export interface Series {
  x?: ArrayLike<number>;
  y: ArrayLike<number>;
  color?: string;
  kind?: 'line' | 'step' | 'scatter' | 'stem' | 'area';
  width?: number;
  alpha?: number;
  dash?: number[];
  size?: number;
  label?: string;
}

export interface PlotProps {
  series?: Series[];
  /** bundle of traces drawn with low alpha (eye diagrams); x is the sample index unless traceX is given */
  traces?: number[][];
  traceX?: number[];
  traceColor?: string;
  x?: [number, number];
  y?: [number, number];
  logX?: boolean;
  logY?: boolean;
  xLabel?: string;
  yLabel?: string;
  height?: number;
  aspect?: number;
  title?: ReactNode;
  titleRight?: ReactNode;
  legend?: boolean;
  hlines?: { y: number; color?: string; label?: string; dash?: number[] }[];
  vlines?: { x: number; color?: string; label?: string; dash?: number[] }[];
  bands?: { x0?: number; x1?: number; y0?: number; y1?: number; color?: string; label?: string }[];
  points?: { x: number; y: number; color?: string; r?: number; label?: string; ring?: boolean }[];
  equalAspect?: boolean;
  xTicks?: number[];
  hideYTicks?: boolean;
  ariaLabel?: string;
}

function niceTicks(a: number, b: number, n = 5): number[] {
  if (!(b > a)) return [a];
  const span = b - a;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1e4 || a < 1e-3) {
    const m = v / Math.pow(10, Math.floor(Math.log10(a)));
    return v.toExponential(Math.abs(m - Math.round(m)) < 1e-6 ? 0 : 1).replace('e+', 'e');
  }
  return Number(v.toPrecision(4)).toString();
}

function extent(series: Series[], traces: number[][] | undefined, axis: 'x' | 'y', log: boolean): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const take = (v: number) => {
    if (!isFinite(v) || (log && v <= 0)) return;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  };
  for (const s of series) {
    const arr = axis === 'x' ? s.x : s.y;
    if (arr) for (let i = 0; i < arr.length; i++) take(arr[i]);
    else if (axis === 'x') {
      take(0);
      take(s.y.length - 1);
    }
  }
  if (traces?.length) {
    if (axis === 'y') for (const t of traces) for (const v of t) take(v);
    else {
      take(0);
      take(traces[0].length - 1);
    }
  }
  if (!isFinite(lo)) return [0, 1];
  if (lo === hi) return log ? [lo / 10, hi * 10] : [lo - 1, hi + 1];
  if (axis === 'y' && !log) {
    const pad = (hi - lo) * 0.06;
    return [lo - pad, hi + pad];
  }
  return [lo, hi];
}

export function Plot(props: PlotProps) {
  const { version } = useTheme();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(Math.max(160, Math.floor(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = props.height ?? (props.aspect ? Math.round(w / props.aspect) : 220);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(height * dpr);
    c.style.height = `${height}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);

    const series = props.series ?? [];
    const logX = !!props.logX;
    const logY = !!props.logY;
    let [x0, x1] = props.x ?? extent(series, props.traces, 'x', logX);
    let [y0, y1] = props.y ?? extent(series, props.traces, 'y', logY);
    const ml = props.hideYTicks ? 14 : 50;
    const mr = 12;
    const mt = 10;
    const mb = props.xLabel ? 38 : 26;
    const pw = Math.max(10, w - ml - mr);
    const ph = Math.max(10, height - mt - mb);
    if (props.equalAspect) {
      const sx = (x1 - x0) / pw;
      const sy = (y1 - y0) / ph;
      if (sx > sy) {
        const c0 = (y0 + y1) / 2;
        const half = (sx * ph) / 2;
        y0 = c0 - half;
        y1 = c0 + half;
      } else {
        const c0 = (x0 + x1) / 2;
        const half = (sy * pw) / 2;
        x0 = c0 - half;
        x1 = c0 + half;
      }
    }
    const tx = (v: number) => {
      const t = logX ? (Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) : (v - x0) / (x1 - x0);
      return ml + t * pw;
    };
    const ty = (v: number) => {
      const t = logY ? (Math.log10(Math.max(v, 1e-300)) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0)) : (v - y0) / (y1 - y0);
      return mt + ph - t * ph;
    };

    const grid = cssColor('var(--plot-grid)');
    const axis = cssColor('var(--plot-axis)');
    const text = cssColor('var(--text-3)');
    const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace';
    ctx.font = `10.5px ${mono}`;
    ctx.lineWidth = 1;

    // bands
    for (const b of props.bands ?? []) {
      ctx.fillStyle = cssColor(b.color ?? 'var(--pump-soft)');
      const bx0 = b.x0 !== undefined ? tx(b.x0) : ml;
      const bx1 = b.x1 !== undefined ? tx(b.x1) : ml + pw;
      const by0 = b.y1 !== undefined ? ty(b.y1) : mt;
      const by1 = b.y0 !== undefined ? ty(b.y0) : mt + ph;
      ctx.fillRect(Math.max(ml, bx0), Math.max(mt, by0), Math.min(ml + pw, bx1) - Math.max(ml, bx0), Math.min(mt + ph, by1) - Math.max(mt, by0));
      if (b.label) {
        ctx.fillStyle = text;
        ctx.fillText(b.label, Math.max(ml, bx0) + 4, Math.max(mt, by0) + 12);
      }
    }

    // grid + ticks
    const xt = props.xTicks ?? (logX ? decades(x0, x1) : niceTicks(x0, x1, Math.max(3, Math.floor(pw / 80))));
    const yt = logY ? decades(y0, y1) : niceTicks(y0, y1, Math.max(3, Math.floor(ph / 45)));
    ctx.strokeStyle = grid;
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const v of xt) {
      const px = tx(v);
      if (px < ml - 0.5 || px > ml + pw + 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(px, mt);
      ctx.lineTo(px, mt + ph);
      ctx.stroke();
      ctx.fillText(logX ? `1e${Math.round(Math.log10(v))}` : fmt(v), px, mt + ph + 6);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of yt) {
      const py = ty(v);
      if (py < mt - 0.5 || py > mt + ph + 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(ml, py);
      ctx.lineTo(ml + pw, py);
      ctx.stroke();
      if (!props.hideYTicks) ctx.fillText(logY ? `1e${Math.round(Math.log10(v))}` : fmt(v), ml - 6, py);
    }
    ctx.strokeStyle = axis;
    ctx.strokeRect(ml + 0.5, mt + 0.5, pw - 1, ph - 1);
    if (props.xLabel) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(props.xLabel, ml + pw / 2, height - 2);
    }
    if (props.yLabel && !props.hideYTicks) {
      ctx.save();
      ctx.translate(11, mt + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(props.yLabel, 0, 0);
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(ml, mt, pw, ph);
    ctx.clip();

    // eye-diagram traces
    if (props.traces?.length) {
      ctx.strokeStyle = cssColor(props.traceColor ?? 'var(--c2)');
      ctx.globalAlpha = Math.max(0.05, Math.min(0.35, 18 / props.traces.length));
      ctx.lineWidth = 1.1;
      for (const t of props.traces) {
        ctx.beginPath();
        t.forEach((v, i) => {
          const px = tx(props.traceX ? props.traceX[i] : i);
          const py = ty(v);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    for (const s of series) {
      const col = cssColor(s.color ?? 'var(--c1)');
      const n = s.y.length;
      const X = (i: number) => (s.x ? s.x[i] : i);
      ctx.globalAlpha = s.alpha ?? 1;
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = s.width ?? 1.6;
      ctx.setLineDash(s.dash ?? []);
      const kind = s.kind ?? 'line';
      if (kind === 'scatter') {
        const r = s.size ?? 1.8;
        for (let i = 0; i < n; i++) {
          if (!isFinite(s.y[i])) continue;
          ctx.beginPath();
          ctx.arc(tx(X(i)), ty(s.y[i]), r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (kind === 'stem') {
        const base = ty(logY ? y0 : Math.max(y0, Math.min(y1, 0)));
        for (let i = 0; i < n; i++) {
          const px = tx(X(i));
          ctx.beginPath();
          ctx.moveTo(px, base);
          ctx.lineTo(px, ty(s.y[i]));
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px, ty(s.y[i]), s.size ?? 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < n; i++) {
          const v = s.y[i];
          if (!isFinite(v) || (logY && v <= 0)) {
            started = false;
            continue;
          }
          const px = tx(X(i));
          const py = ty(v);
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else if (kind === 'step') {
            ctx.lineTo(px, ty(s.y[i - 1]));
            ctx.lineTo(px, py);
          } else ctx.lineTo(px, py);
        }
        ctx.stroke();
        if (kind === 'area' && n > 1) {
          ctx.lineTo(tx(X(n - 1)), mt + ph);
          ctx.lineTo(tx(X(0)), mt + ph);
          ctx.closePath();
          ctx.globalAlpha = (s.alpha ?? 1) * 0.16;
          ctx.fill();
        }
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    for (const h of props.hlines ?? []) {
      ctx.strokeStyle = cssColor(h.color ?? 'var(--text-3)');
      ctx.setLineDash(h.dash ?? [4, 4]);
      ctx.beginPath();
      ctx.moveTo(ml, ty(h.y));
      ctx.lineTo(ml + pw, ty(h.y));
      ctx.stroke();
      if (h.label) {
        ctx.fillStyle = cssColor(h.color ?? 'var(--text-3)');
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(h.label, ml + pw - 4, ty(h.y) - 3);
      }
    }
    for (const v of props.vlines ?? []) {
      ctx.strokeStyle = cssColor(v.color ?? 'var(--text-3)');
      ctx.setLineDash(v.dash ?? [4, 4]);
      ctx.beginPath();
      ctx.moveTo(tx(v.x), mt);
      ctx.lineTo(tx(v.x), mt + ph);
      ctx.stroke();
      if (v.label) {
        ctx.fillStyle = cssColor(v.color ?? 'var(--text-3)');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(v.label, tx(v.x) + 4, mt + 4);
      }
    }
    ctx.setLineDash([]);
    for (const p of props.points ?? []) {
      const col = cssColor(p.color ?? 'var(--phosphor)');
      ctx.beginPath();
      ctx.arc(tx(p.x), ty(p.y), p.r ?? 4, 0, Math.PI * 2);
      if (p.ring) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.fill();
      }
      if (p.label) {
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(p.label, tx(p.x) + 6, ty(p.y) - 4);
      }
    }
    ctx.restore();
  }, [props, w, height, version]);

  const labeled = (props.series ?? []).filter((s) => s.label);
  return (
    <div className="plot" ref={wrap}>
      {(props.title || props.titleRight) && (
        <div className="plot-title">
          <span>{props.title}</span>
          <span>{props.titleRight}</span>
        </div>
      )}
      <canvas ref={canvas} role="img" aria-label={props.ariaLabel ?? (typeof props.title === 'string' ? props.title : 'plot')} />
      {props.legend && labeled.length > 0 && (
        <div className="plot-legend">
          {labeled.map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color?.startsWith('var(') ? s.color : s.color ?? 'var(--c1)' }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function decades(a: number, b: number): number[] {
  const out: number[] = [];
  const lo = Math.floor(Math.log10(Math.max(a, 1e-300)));
  const hi = Math.ceil(Math.log10(Math.max(b, 1e-300)));
  const stride = Math.max(1, Math.ceil((hi - lo) / 8));
  for (let e = lo; e <= hi; e += stride) out.push(Math.pow(10, e));
  return out;
}
