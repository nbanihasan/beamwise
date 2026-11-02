import { useEffect, useMemo, useRef, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { cssColor, useTheme } from '@/lib/theme';
import { linspace } from '@/sim/math';

/**
 * Receiver optics, ray-traced in 2D: bare detector, thin lens, Fresnel lens, hemispherical lens and
 * a compound parabolic concentrator (CPC). Rays are traced with Snell refraction and mirror reflection,
 * so the CPC's sharp acceptance edge and the hemisphere's wide FOV appear on their own.
 * The plot shows the standard 3D gain models (Kahn & Barry 1997; Wang et al. 2013).
 */
type Kind = 'bare' | 'thin' | 'fresnel' | 'hemi' | 'cpc';
interface V {
  x: number;
  y: number;
}
interface Seg {
  a: V;
  b: V;
}

const A = 0.5; // detector half-width (scene units)
const sub = (p: V, q: V): V => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p: V, q: V) => p.x * q.x + p.y * q.y;
const norm = (p: V): V => {
  const l = Math.hypot(p.x, p.y);
  return { x: p.x / l, y: p.y / l };
};

function hitSeg(o: V, d: V, s: Seg): number {
  const e = sub(s.b, s.a);
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-12) return Infinity;
  const w = sub(s.a, o);
  const t = (w.x * e.y - w.y * e.x) / den;
  const u = (w.x * d.y - w.y * d.x) / den;
  return t > 1e-6 && u >= 0 && u <= 1 ? t : Infinity;
}

function refract(d: V, n: V, n1: number, n2: number): V | null {
  let nn = n;
  let cosi = -dot(d, nn);
  if (cosi < 0) {
    nn = { x: -n.x, y: -n.y };
    cosi = -cosi;
  }
  const r = n1 / n2;
  const k = 1 - r * r * (1 - cosi * cosi);
  if (k < 0) return null;
  return norm({ x: r * d.x + (r * cosi - Math.sqrt(k)) * nn.x, y: r * d.y + (r * cosi - Math.sqrt(k)) * nn.y });
}

export function cpcWall(thetaDeg: number, a = A): V[] {
  const th = (thetaDeg * Math.PI) / 180;
  const f = a * (1 + Math.sin(th));
  const ap = a / Math.sin(th);
  const L = (a + ap) / Math.tan(th);
  const F = { x: -a, y: 0 };
  const aMax = Math.atan2(L, a + ap);
  const pts: V[] = [];
  for (let i = 0; i <= 60; i++) {
    const al = (aMax * i) / 60;
    const r = (2 * f) / (1 + Math.sin(th - al));
    pts.push({ x: F.x + r * Math.cos(al), y: F.y + r * Math.sin(al) });
  }
  return pts;
}

interface Scene {
  segs: { s: Seg; type: 'mirror' }[];
  entranceY: number;
  entranceHalf: number;
  lens?: { y: number; f: number; half: number };
  hemi?: { R: number; n: number };
}

function buildScene(kind: Kind, p: { f: number; cpcDeg: number; R: number; n: number }): Scene {
  if (kind === 'cpc') {
    const w = cpcWall(p.cpcDeg);
    const segs: Scene['segs'] = [];
    for (let i = 0; i < w.length - 1; i++) {
      segs.push({ s: { a: w[i], b: w[i + 1] }, type: 'mirror' });
      segs.push({ s: { a: { x: -w[i].x, y: w[i].y }, b: { x: -w[i + 1].x, y: w[i + 1].y } }, type: 'mirror' });
    }
    const top = w[w.length - 1];
    return { segs, entranceY: top.y, entranceHalf: top.x };
  }
  if (kind === 'hemi') return { segs: [], entranceY: p.R, entranceHalf: p.R, hemi: { R: p.R, n: p.n } };
  if (kind === 'thin' || kind === 'fresnel') return { segs: [], entranceY: p.f, entranceHalf: 1.4, lens: { y: p.f, f: p.f, half: 1.4 } };
  return { segs: [], entranceY: 0.01, entranceHalf: A };
}

interface Ray {
  pts: V[];
  hit: boolean;
}

function traceRays(sc: Scene, thetaDeg: number, nRays: number): Ray[] {
  const th = (thetaDeg * Math.PI) / 180;
  const d0 = norm({ x: Math.sin(th), y: -Math.cos(th) });
  const rays: Ray[] = [];
  const H = sc.entranceY + 1.6;
  for (let i = 0; i < nRays; i++) {
    const x0 = -sc.entranceHalf + ((i + 0.5) / nRays) * 2 * sc.entranceHalf;
    // start above the entrance so the ray crosses it at x0
    let o: V = { x: x0 - d0.x * ((H - sc.entranceY) / -d0.y), y: H };
    let d = d0;
    const pts: V[] = [o];
    let hit = false;
    let inside = false; // inside hemisphere glass
    for (let k = 0; k < 40; k++) {
      let tBest = Infinity;
      let what: 'seg' | 'det' | 'lens' | 'sphere' | 'floor' | null = null;
      let segN: V | null = null;
      for (const g of sc.segs) {
        const t = hitSeg(o, d, g.s);
        if (t < tBest) {
          tBest = t;
          what = 'seg';
          const e = sub(g.s.b, g.s.a);
          segN = norm({ x: -e.y, y: e.x });
        }
      }
      if (sc.lens && d.y < 0 && o.y > sc.lens.y + 1e-6) {
        const t = (sc.lens.y - o.y) / d.y;
        if (t > 1e-6 && t < tBest && Math.abs(o.x + d.x * t) <= sc.lens.half) {
          tBest = t;
          what = 'lens';
        }
      }
      if (sc.hemi) {
        // circle centred at origin, upper half only
        const b = dot(o, d);
        const c = dot(o, o) - sc.hemi.R * sc.hemi.R;
        const disc = b * b - c;
        if (disc > 0) {
          for (const t of [-b - Math.sqrt(disc), -b + Math.sqrt(disc)]) {
            if (t > 1e-6 && t < tBest && o.y + d.y * t >= 0) {
              tBest = t;
              what = 'sphere';
              break;
            }
          }
        }
      }
      if (d.y < 0) {
        const t = -o.y / d.y;
        if (t > 1e-6 && t < tBest) {
          tBest = t;
          what = 'floor';
        }
      }
      if (!what || !isFinite(tBest)) {
        pts.push({ x: o.x + d.x * 3, y: o.y + d.y * 3 });
        break;
      }
      const p = { x: o.x + d.x * tBest, y: o.y + d.y * tBest };
      pts.push(p);
      if (what === 'floor') {
        hit = Math.abs(p.x) <= A;
        break;
      }
      if (what === 'seg' && segN) {
        const dn = dot(d, segN);
        d = norm({ x: d.x - 2 * dn * segN.x, y: d.y - 2 * dn * segN.y });
      } else if (what === 'lens' && sc.lens) {
        // thin lens: every ray through height h goes towards the focal-plane point of its bundle
        const focal = { x: sc.lens.f * Math.tan(th), y: 0 };
        d = norm(sub(focal, p));
      } else if (what === 'sphere' && sc.hemi) {
        const n = norm(p);
        const nd = inside ? refract(d, n, sc.hemi.n, 1) : refract(d, n, 1, sc.hemi.n);
        if (!nd) {
          const dn = dot(d, n);
          d = norm({ x: d.x - 2 * dn * n.x, y: d.y - 2 * dn * n.y });
        } else {
          d = nd;
          inside = !inside;
        }
      }
      o = p;
      if (o.y > H + 0.5) break;
    }
    rays.push({ pts, hit });
  }
  return rays;
}

/** 3D gain models used in link budgets. */
function gain3d(kind: Kind, thetaDeg: number, p: { f: number; cpcDeg: number; R: number; n: number }): number {
  const th = (thetaDeg * Math.PI) / 180;
  const c = Math.cos(th);
  switch (kind) {
    case 'bare':
      return c;
    case 'thin':
    case 'fresnel': {
      const fov = Math.atan(A / p.f);
      const g = (1.4 / A) ** 2 * (kind === 'fresnel' ? 0.85 : 0.92);
      return th <= fov ? g * c : 0;
    }
    case 'hemi':
      return p.n * p.n * c;
    case 'cpc': {
      const tc = (p.cpcDeg * Math.PI) / 180;
      return th <= tc ? (1 / Math.sin(tc) ** 2) * c : 0;
    }
  }
}

export default function LensSystems() {
  const [kind, setKind] = useState<Kind>('cpc');
  const [theta, setTheta] = useState(12);
  const [f, setF] = useState(2.2);
  const [cpcDeg, setCpcDeg] = useState(25);
  const [R, setR] = useState(1.3);
  const [n, setN] = useState(1.5);
  const { version } = useTheme();
  const cv = useRef<HTMLCanvasElement>(null);
  const p = { f, cpcDeg, R, n };
  const sc = useMemo(() => buildScene(kind, p), [kind, f, cpcDeg, R, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const rays = useMemo(() => traceRays(sc, theta, 28), [sc, theta]);
  const frac = rays.filter((r) => r.hit).length / rays.length;

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      const h = 300;
      c.width = w * dpr;
      c.height = h * dpr;
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const top = Math.max(sc.entranceY + 1.7, 3);
      const s = Math.min((h - 30) / top, w / 7);
      const X = (x: number) => w / 2 + x * s;
      const Y = (y: number) => h - 18 - y * s;
      // detector
      g.fillStyle = cssColor('--c1');
      g.fillRect(X(-A), Y(0), 2 * A * s, 6);
      g.fillStyle = cssColor('--text-3');
      g.font = '11px Geist Mono, monospace';
      g.textAlign = 'center';
      g.fillText('photodiode', X(0), h - 2);
      // optics
      g.strokeStyle = cssColor('--text-2');
      g.lineWidth = 2;
      if (kind === 'cpc') {
        const wpts = cpcWall(cpcDeg);
        for (const sx of [1, -1]) {
          g.beginPath();
          wpts.forEach((q, i) => (i ? g.lineTo(X(sx * q.x), Y(q.y)) : g.moveTo(X(sx * q.x), Y(q.y))));
          g.stroke();
        }
      }
      if (sc.lens) {
        g.fillStyle = 'rgba(143,211,255,0.18)';
        g.strokeStyle = cssColor('--c6');
        g.beginPath();
        if (kind === 'fresnel') {
          const teeth = 7;
          for (let i = 0; i <= teeth * 2; i++) {
            const x = -sc.lens.half + (i / (teeth * 2)) * 2 * sc.lens.half;
            const yy = sc.lens.y + (i % 2 ? 0.12 : 0) * (1 - Math.abs(x) / sc.lens.half / 2);
            if (i) g.lineTo(X(x), Y(yy));
            else g.moveTo(X(x), Y(yy));
          }
          g.lineTo(X(sc.lens.half), Y(sc.lens.y - 0.05));
          g.lineTo(X(-sc.lens.half), Y(sc.lens.y - 0.05));
        } else {
          g.ellipse(X(0), Y(sc.lens.y), sc.lens.half * s, 0.16 * s, 0, 0, Math.PI * 2);
        }
        g.closePath();
        g.fill();
        g.stroke();
      }
      if (sc.hemi) {
        g.fillStyle = 'rgba(143,211,255,0.14)';
        g.strokeStyle = cssColor('--c6');
        g.beginPath();
        g.arc(X(0), Y(0), sc.hemi.R * s, Math.PI, 0);
        g.closePath();
        g.fill();
        g.stroke();
      }
      // rays
      for (const r of rays) {
        g.strokeStyle = r.hit ? cssColor('--c2') : cssColor('--bad');
        g.globalAlpha = r.hit ? 0.9 : 0.35;
        g.lineWidth = 1.2;
        g.beginPath();
        r.pts.forEach((q, i) => (i ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y))));
        g.stroke();
      }
      g.globalAlpha = 1;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [rays, sc, kind, cpcDeg, version]);

  const angles = linspace(0, 89, 90);
  const KINDS: { value: Kind; label: string }[] = [
    { value: 'bare', label: 'Bare PD' },
    { value: 'thin', label: 'Thin lens' },
    { value: 'fresnel', label: 'Fresnel' },
    { value: 'hemi', label: 'Hemisphere' },
    { value: 'cpc', label: 'CPC' },
  ];
  const fovNow = kind === 'cpc' ? cpcDeg : kind === 'thin' || kind === 'fresnel' ? (Math.atan(A / f) * 180) / Math.PI : 90;

  const controls = (
    <>
      <Segmented label="Optic" value={kind} options={KINDS} onChange={setKind} />
      <Slider label="Incidence angle" value={theta} min={0} max={80} step={0.5} unit="°" onChange={setTheta} />
      <GroupTitle>Parameters</GroupTitle>
      {(kind === 'thin' || kind === 'fresnel') && <Slider label="Focal length / detector half-width" value={f} min={0.8} max={4} step={0.05} onChange={setF} format={(v) => (v / A).toFixed(1)} />}
      {kind === 'cpc' && <Slider label="Acceptance angle θc" value={cpcDeg} min={8} max={60} step={1} unit="°" onChange={setCpcDeg} />}
      {kind === 'hemi' && (
        <>
          <Slider label="Lens radius / detector half-width" value={R} min={0.6} max={2} step={0.05} onChange={setR} format={(v) => (v / A).toFixed(1)} />
          <Slider label="Refractive index n" value={n} min={1.3} max={2} step={0.01} onChange={setN} />
        </>
      )}
      <Readouts>
        <Readout k="Rays reaching the PD (2D)" v={`${Math.round(frac * 100)} %`} tone={frac > 0.5 ? 'good' : frac > 0 ? 'warn' : 'bad'} />
        <Readout k="Field of view" v={`${fovNow.toFixed(0)}°`} />
        <Readout k="3D gain at this angle" v={gain3d(kind, theta, p).toFixed(2)} />
      </Readouts>
    </>
  );

  return (
    <Widget
      title="Receiver optics, ray by ray"
      eyebrow="Ray tracing · 2D"
      controls={controls}
      caption={
        <p>
          Yellow rays reach the photodiode; red ones miss. A concentrator trades field of view for gain: the CPC is close to the étendue limit n²/sin²θc but cuts off hard at θc;
          the hemisphere gives a modest gain of about n² over a very wide field of view; a lens images the source, so the spot walks off the detector as the angle grows.
        </p>
      }
    >
      <canvas ref={cv} style={{ width: '100%', height: 300, display: 'block' }} aria-label="Ray-trace diagram" />
      <Plot
        title="Optical gain vs incidence angle (3D models)"
        series={[
          { x: angles, y: angles.map((a) => Math.max(0.01, gain3d(kind, a, p))), color: 'var(--c2)', label: KINDS.find((k) => k.value === kind)!.label },
          { x: angles, y: angles.map((a) => Math.max(0.01, gain3d('bare', a, p))), color: 'var(--text-3)', label: 'bare PD (cos ψ)' },
        ]}
        xLabel="incidence angle (°)"
        logY
        y={[0.01, 30]}
        vlines={[{ x: theta, color: 'var(--c4)' }]}
        height={170}
        legend
      />
    </Widget>
  );
}
