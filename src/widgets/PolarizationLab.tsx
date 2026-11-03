import { useState } from 'react';
import { Readout, Readouts, Segmented, Select, Slider, Widget } from '@/viz/controls';

/**
 * An optical rail with up to three polarization components, computed exactly with Stokes vectors and
 * Mueller matrices: polarizers (Malus), half- and quarter-wave plates, a Faraday rotator, a 50:50
 * splitter and a diffuser, ending in a detector or a polarizing beam splitter (PBS).
 */
type S = [number, number, number, number];
type M = number[][];
type Part = 'none' | 'pol' | 'hwp' | 'qwp' | 'faraday' | 'npbs' | 'diffuser';
type Src = 'unpol' | 'h' | 'd45' | 'rcp';

const PARTS: { value: Part; label: string }[] = [
  { value: 'none', label: '— empty —' },
  { value: 'pol', label: 'Linear polarizer' },
  { value: 'hwp', label: 'Half-wave plate (λ/2)' },
  { value: 'qwp', label: 'Quarter-wave plate (λ/4)' },
  { value: 'faraday', label: 'Faraday rotator' },
  { value: 'npbs', label: '50:50 beam splitter' },
  { value: 'diffuser', label: 'Diffuser' },
];
const SRC: Record<Src, { label: string; s: S }> = {
  unpol: { label: 'LED (unpolarized)', s: [1, 0, 0, 0] },
  h: { label: 'Laser, horizontal', s: [1, 1, 0, 0] },
  d45: { label: 'Laser, 45°', s: [1, 0, 1, 0] },
  rcp: { label: 'Circular', s: [1, 0, 0, 1] },
};

const r = (d: number) => (d * Math.PI) / 180;
function polarizer(th: number): M {
  const c = Math.cos(2 * r(th));
  const s = Math.sin(2 * r(th));
  return [
    [0.5, 0.5 * c, 0.5 * s, 0],
    [0.5 * c, 0.5 * c * c, 0.5 * c * s, 0],
    [0.5 * s, 0.5 * c * s, 0.5 * s * s, 0],
    [0, 0, 0, 0],
  ];
}
function retarder(th: number, delta: number): M {
  const c = Math.cos(2 * r(th));
  const s = Math.sin(2 * r(th));
  const cd = Math.cos(delta);
  const sd = Math.sin(delta);
  return [
    [1, 0, 0, 0],
    [0, c * c + s * s * cd, c * s * (1 - cd), -s * sd],
    [0, c * s * (1 - cd), s * s + c * c * cd, c * sd],
    [0, s * sd, -c * sd, cd],
  ];
}
function rotator(rho: number): M {
  const c = Math.cos(2 * r(rho));
  const s = Math.sin(2 * r(rho));
  return [
    [1, 0, 0, 0],
    [0, c, -s, 0],
    [0, s, c, 0],
    [0, 0, 0, 1],
  ];
}
const scale = (k: number): M => [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? k : 0)));
const depol: M = [
  [0.7, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];
const apply = (m: M, s: S): S => m.map((row) => row.reduce((a, v, j) => a + v * s[j], 0)) as S;

function matrixFor(p: Part, th: number): M | null {
  switch (p) {
    case 'pol': return polarizer(th);
    case 'hwp': return retarder(th, Math.PI);
    case 'qwp': return retarder(th, Math.PI / 2);
    case 'faraday': return rotator(th);
    case 'npbs': return scale(0.5);
    case 'diffuser': return depol;
    default: return null;
  }
}

function describe(s: S) {
  const ip = Math.hypot(s[1], s[2], s[3]);
  const dop = s[0] > 1e-9 ? ip / s[0] : 0;
  const psi = 0.5 * Math.atan2(s[2], s[1]);
  const chi = ip > 1e-9 ? 0.5 * Math.asin(Math.max(-1, Math.min(1, s[3] / ip))) : 0;
  let kind = 'unpolarized';
  if (s[0] < 1e-6) kind = 'no light';
  else if (dop > 0.02) {
    const e = Math.abs(Math.tan(chi));
    kind = e < 0.05 ? `linear ${((((psi * 180) / Math.PI) % 180) + 180) % 180 < 0.5 ? 0 : (((((psi * 180) / Math.PI) % 180) + 180) % 180).toFixed(0)}°` : e > 0.95 ? (s[3] > 0 ? 'circular (R)' : 'circular (L)') : `elliptical (${s[3] > 0 ? 'R' : 'L'})`;
    if (dop < 0.98) kind = `partly ${kind}`;
  }
  return { dop, psi, chi, kind };
}

function Glyph({ s, x, y }: { s: S; x: number; y: number }) {
  const d = describe(s);
  const R = 26 * Math.sqrt(Math.max(0, s[0]));
  if (R < 0.5)
    return (
      <text x={x} y={y + 4} textAnchor="middle" className="pl-l">
        dark
      </text>
    );
  const a = R * Math.cos(d.chi);
  const b = Math.max(0.6, R * Math.abs(Math.sin(d.chi)));
  const rotDeg = (-d.psi * 180) / Math.PI;
  return (
    <g transform={`translate(${x},${y})`}>
      {d.dop < 0.98 && (
        <g opacity={(1 - d.dop) * 0.9}>
          {[0, 30, 60, 90, 120, 150].map((t) => (
            <line key={t} x1={-R} x2={R} y1={0} y2={0} transform={`rotate(${t})`} stroke="var(--text-2)" strokeWidth={1} />
          ))}
        </g>
      )}
      {d.dop > 0.02 && (
        <g transform={`rotate(${rotDeg})`} opacity={0.25 + 0.75 * d.dop}>
          <ellipse rx={a} ry={b} fill="var(--phosphor-soft)" stroke="var(--phosphor)" strokeWidth={2} />
          {Math.abs(d.chi) > 0.05 && <path d={`M${a * 0.2} ${-b} l ${s[3] > 0 ? 7 : -7} 0`} stroke="var(--phosphor)" strokeWidth={2} markerEnd="url(#plArrow)" />}
        </g>
      )}
    </g>
  );
}

const PRESETS: Record<string, { src: Src; parts: [Part, number][]; end: 'det' | 'pbs' }> = {
  malus: { src: 'unpol', parts: [['pol', 0], ['none', 0], ['pol', 60]], end: 'det' },
  paradox: { src: 'unpol', parts: [['pol', 0], ['pol', 45], ['pol', 90]], end: 'det' },
  circ: { src: 'h', parts: [['qwp', 45], ['none', 0], ['none', 0]], end: 'pbs' },
  isolator: { src: 'h', parts: [['pol', 0], ['faraday', 45], ['pol', 45]], end: 'det' },
};

export default function PolarizationLab() {
  const [src, setSrc] = useState<Src>('unpol');
  const [parts, setParts] = useState<[Part, number][]>(PRESETS.paradox.parts);
  const [end, setEnd] = useState<'det' | 'pbs'>('det');
  const states: S[] = [SRC[src].s];
  for (const [p, th] of parts) {
    const m = matrixFor(p, th);
    states.push(m ? apply(m, states[states.length - 1]) : states[states.length - 1]);
  }
  const out = states[states.length - 1];
  const pbsT = apply(polarizer(0), out)[0];
  const pbsR = apply(polarizer(90), out)[0];
  const load = (k: string) => {
    const p = PRESETS[k];
    setSrc(p.src);
    setParts(p.parts.map((x) => [...x] as [Part, number]));
    setEnd(p.end);
  };

  const W = 720;
  const xs = [60, 230, 400, 570];
  const beamW = (s: S) => Math.max(0.6, 10 * s[0]);
  return (
    <Widget
      title="Polarization rail: polarizers, wave plates, splitters"
      eyebrow="Interactive · Mueller calculus"
      controls={
        <>
          <Select label="Source" value={src} options={(Object.keys(SRC) as Src[]).map((k) => ({ value: k, label: SRC[k].label }))} onChange={setSrc} />
          {parts.map(([p, th], i) => (
            <div key={i} className="pl-slot">
              <Select label={`Slot ${i + 1}`} value={p} options={PARTS} onChange={(v) => setParts(parts.map((x, k) => (k === i ? [v, x[1]] : x)))} />
              {p !== 'none' && p !== 'npbs' && p !== 'diffuser' && (
                <Slider label={p === 'faraday' ? 'Rotation' : p === 'pol' ? 'Transmission axis' : 'Fast axis'} value={th} min={p === 'faraday' ? -90 : 0} max={p === 'faraday' ? 90 : 180} step={1} unit="°" onChange={(v) => setParts(parts.map((x, k) => (k === i ? [x[0], v] : x)))} />
              )}
            </div>
          ))}
          <Segmented label="End" value={end} options={[{ value: 'det', label: 'Detector' }, { value: 'pbs', label: 'PBS (H / V)' }]} onChange={setEnd} />
          <Segmented
            label="Try"
            value=""
            options={[
              { value: 'malus', label: 'Malus' },
              { value: 'paradox', label: '3 polarizers' },
              { value: 'circ', label: 'Make circular' },
              { value: 'isolator', label: 'Isolator' },
            ]}
            onChange={load}
          />
        </>
      }
      caption={
        <p>
          Glyphs show the state after each slot: the ellipse is the path the electric field traces, the star is the unpolarized part, size is power. Crossed polarizers (0° and 90°) pass nothing, yet
          slipping a third at 45° between them lets 12.5 % through. A quarter-wave plate at 45° turns linear light circular, which a PBS then splits 50:50. Polarizer, 45° Faraday rotator, polarizer at 45° is an
          optical isolator: light passes forward, and anything reflected back is rotated a further 45° and blocked. Polarization multiplexing, glare filtering and quantum key distribution all build on these
          parts.
        </p>
      }
    >
      <svg viewBox={`0 0 ${W} 210`} className="pl-svg" role="img" aria-label="Polarization rail">
        <defs>
          <marker id="plArrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L10 5 L0 10z" fill="var(--phosphor)" />
          </marker>
        </defs>
        {states.slice(0, -1).map((s, i) => (
          <rect key={i} x={xs[i]} y={100 - beamW(s) / 2} width={xs[i + 1] - xs[i]} height={beamW(s)} fill="var(--phosphor)" opacity={0.25 + 0.4 * s[0]} />
        ))}
        {end === 'det' ? (
          <rect x={xs[3]} y={100 - beamW(out) / 2} width={86} height={beamW(out)} fill="var(--phosphor)" opacity={0.25 + 0.4 * out[0]} />
        ) : (
          <>
            <rect x={xs[3]} y={100 - beamW(out) / 2} width={46} height={beamW(out)} fill="var(--phosphor)" opacity={0.25 + 0.4 * out[0]} />
            <rect x={616} y={100 - Math.max(0.6, 10 * pbsT) / 2} width={50} height={Math.max(0.6, 10 * pbsT)} fill="var(--c1)" opacity={0.7} />
            <rect x={616 - Math.max(0.6, 10 * pbsR) / 2} y={100} width={Math.max(0.6, 10 * pbsR)} height={70} fill="var(--c4)" opacity={0.7} transform="translate(0,0)" />
          </>
        )}
        <g transform="translate(36,100)">
          <circle r={14} fill="var(--phosphor)" opacity={0.25} />
          <circle r={7} fill="var(--phosphor)" />
        </g>
        {parts.map(([p, th], i) => {
          const x = (xs[i] + xs[i + 1]) / 2;
          if (p === 'none') return <line key={i} x1={x} x2={x} y1={70} y2={130} stroke="var(--line)" strokeDasharray="3 4" />;
          const rot = p === 'pol' || p === 'hwp' || p === 'qwp' ? th : 0;
          return (
            <g key={i} transform={`translate(${x},100)`}>
              {p === 'npbs' ? (
                <>
                  <rect x={-18} y={-18} width={36} height={36} fill="rgba(143,211,255,0.12)" stroke="var(--c6)" />
                  <line x1={-18} y1={18} x2={18} y2={-18} stroke="var(--c6)" />
                  <rect x={-2} y={-18 - 50} width={4} height={50} fill="var(--phosphor)" opacity={0.25 + 0.4 * states[i + 1][0]} />
                </>
              ) : p === 'diffuser' ? (
                <rect x={-5} y={-36} width={10} height={72} rx={3} fill="rgba(255,255,255,0.12)" stroke="var(--text-2)" strokeDasharray="2 2" />
              ) : (
                <>
                  {/* drawn face-on, as seen along the beam: the line shows the transmission or fast axis */}
                  <circle r={30} fill={p === 'faraday' ? 'rgba(195,155,255,0.15)' : 'rgba(143,166,255,0.1)'} stroke={p === 'faraday' ? 'var(--c5)' : p === 'pol' ? 'var(--c1)' : 'var(--c2)'} strokeWidth={1.4} />
                  <g transform={`rotate(${-rot})`}>
                    {p === 'pol' ? (
                      [-14, 0, 14].map((o) => <line key={o} x1={-Math.sqrt(900 - o * o) + 3} x2={Math.sqrt(900 - o * o) - 3} y1={o} y2={o} stroke="var(--c1)" strokeWidth={o ? 1.2 : 2.4} />)
                    ) : p !== 'faraday' ? (
                      <>
                        <line x1={-28} x2={28} y1={0} y2={0} stroke="var(--c2)" strokeWidth={3} />
                        <text x={0} y={-6} textAnchor="middle" className="pl-l" style={{ fill: 'var(--c2)' }}>
                          {p === 'hwp' ? 'λ/2' : 'λ/4'}
                        </text>
                      </>
                    ) : (
                      <path d="M -16 -8 A 18 18 0 1 1 -16 8" fill="none" stroke="var(--c5)" strokeWidth={2} markerEnd="url(#plArrow)" />
                    )}
                  </g>
                </>
              )}
              <text y={58} textAnchor="middle" className="pl-l">
                {PARTS.find((q) => q.value === p)?.label.replace(/ \(.*\)/, '')}
                {p !== 'npbs' && p !== 'diffuser' ? ` ${th}°` : ''}
              </text>
            </g>
          );
        })}
        {end === 'pbs' && (
          <g transform="translate(616,100)">
            <rect x={-18} y={-18} width={36} height={36} fill="rgba(143,211,255,0.12)" stroke="var(--c6)" />
            <line x1={-18} y1={-18} x2={18} y2={18} stroke="var(--c6)" />
          </g>
        )}
        {states.map((s, i) => (
          <Glyph key={i} s={s} x={[92, 230, 400, 560][i]} y={34} />
        ))}
        <rect x={680} y={84} width={18} height={32} rx={3} fill="var(--solid)" stroke="var(--good)" />
        {end === 'pbs' && <rect x={600} y={172} width={32} height={18} rx={3} fill="var(--solid)" stroke="var(--good)" />}
      </svg>
      <Readouts>
        <Readout k="State at the end" v={describe(out).kind} />
        <Readout k="Degree of polarization" v={`${(describe(out).dop * 100).toFixed(0)} %`} />
        {end === 'det' ? (
          <Readout k="Power at detector" v={`${(out[0] * 100).toFixed(1)} %`} tone={out[0] > 0.2 ? 'good' : out[0] > 0.01 ? 'warn' : 'bad'} />
        ) : (
          <>
            <Readout k="PBS transmitted (H)" v={`${(pbsT * 100).toFixed(1)} %`} />
            <Readout k="PBS reflected (V)" v={`${(pbsR * 100).toFixed(1)} %`} />
          </>
        )}
      </Readouts>
    </Widget>
  );
}
