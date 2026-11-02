import { useEffect, useMemo, useState } from 'react';
import { Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { SPECTRAL_LOCUS, cskConstellation, cskWeights, locusPoint, wavelengthToHex } from '@/sim/color';

/** Colour-shift keying on the CIE 1931 chromaticity diagram (IEEE 802.15.7 PHY III). */
const W = 420;
const H = 440;
const px = (x: number) => 40 + x * 470;
const py = (y: number) => H - 30 - y * 470;

function xyToRgb(x: number, y: number): string {
  // xyY (Y=1) -> XYZ -> linear sRGB -> gamma, normalised to the max channel
  const Y = 1;
  const X = (x / y) * Y;
  const Z = ((1 - x - y) / y) * Y;
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  const m = Math.max(r, g, b, 1e-6);
  [r, g, b] = [r, g, b].map((c) => Math.max(0, c / m));
  const gam = (c: number) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
  return `rgb(${gam(r)},${gam(g)},${gam(b)})`;
}

export default function CskDiagram() {
  const [M, setM] = useState<4 | 8 | 16>(4);
  const [lb, setLb] = useState(450);
  const [lg, setLg] = useState(530);
  const [lr, setLr] = useState(625);
  const [sym, setSym] = useState(0);
  const tri = useMemo(() => [locusPoint(lb), locusPoint(lg), locusPoint(lr)] as [number, number][], [lb, lg, lr]);
  const pts = useMemo(() => cskConstellation(M, tri), [M, tri]);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = setInterval(() => setSym((s) => (s + 1 + Math.floor(Math.random() * (M - 1))) % M), 900);
    return () => clearInterval(id);
  }, [M]);
  const cur = pts[sym % pts.length];
  const w = cskWeights(cur, tri);
  let dmin = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) dmin = Math.min(dmin, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
  const centroid: [number, number] = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
  const locus = SPECTRAL_LOCUS.map(([, x, y]) => `${px(x)},${py(y)}`).join(' ');

  return (
    <Widget
      title="Colour-shift keying: data in the colour, not the brightness"
      controls={
        <>
          <Segmented label="Constellation" value={M} onChange={setM} options={[{ value: 4, label: '4-CSK' }, { value: 8, label: '8-CSK' }, { value: 16, label: '16-CSK' }]} />
          <Slider label="Blue LED" value={lb} min={440} max={480} step={1} onChange={setLb} format={(v) => `${v} nm`} />
          <Slider label="Green LED" value={lg} min={500} max={560} step={1} onChange={setLg} format={(v) => `${v} nm`} />
          <Slider label="Red LED" value={lr} min={600} max={660} step={1} onChange={setLr} format={(v) => `${v} nm`} />
          <Readouts>
            <Readout k="Bits / symbol" v={Math.log2(M)} />
            <Readout k="Min distance" v={dmin.toFixed(3)} tone={dmin > 0.15 ? 'good' : dmin > 0.08 ? 'warn' : 'bad'} />
          </Readouts>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Current symbol {sym % pts.length}: LED drive mix
            </div>
            {[
              ['Blue', w[0], wavelengthToHex(lb)],
              ['Green', w[1], wavelengthToHex(lg)],
              ['Red', w[2], wavelengthToHex(lr)],
            ].map(([n, v, c]) => (
              <div key={n as string} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 40px', gap: 8, alignItems: 'center', fontSize: '0.8rem' }}>
                <span className="muted">{n}</span>
                <span style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Number(v)) * 100}%`, background: c as string, transition: 'width .3s' }} />
                </span>
                <span className="mono num">{(Number(v) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      }
      caption={
        <p>
          CSK drives a red, green and blue LED with different power ratios so the mixed light lands on a chosen point (x, y) of the CIE 1931 chromaticity diagram. The
          total optical power stays constant, so there is no flicker and no brightness change; the eye sees the time-average colour, the centroid of the constellation.
          Spreading the LED wavelengths makes the triangle larger and the symbols easier to tell apart.
        </p>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: 14, alignItems: 'center' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 460, display: 'block' }} role="img" aria-label="CIE 1931 chromaticity diagram with CSK constellation">
          <rect x={0} y={0} width={W} height={H} fill="var(--bg-2)" rx={10} />
          {[0, 0.2, 0.4, 0.6, 0.8].map((v) => (
            <g key={v}>
              <line x1={px(v)} x2={px(v)} y1={py(0)} y2={py(0.85)} stroke="var(--plot-grid)" />
              <line x1={px(0)} x2={px(0.75)} y1={py(v)} y2={py(v)} stroke="var(--plot-grid)" />
              <text x={px(v)} y={py(0) + 16} fontSize={10} fill="var(--text-3)" textAnchor="middle" fontFamily="var(--font-mono)">
                {v}
              </text>
              <text x={px(0) - 8} y={py(v) + 3} fontSize={10} fill="var(--text-3)" textAnchor="end" fontFamily="var(--font-mono)">
                {v}
              </text>
            </g>
          ))}
          <polygon points={locus} fill="rgba(255,255,255,0.03)" stroke="none" />
          {SPECTRAL_LOCUS.slice(0, -1).map(([nm, x, y], i) => {
            const [, x2, y2] = SPECTRAL_LOCUS[i + 1];
            return <line key={nm} x1={px(x)} y1={py(y)} x2={px(x2)} y2={py(y2)} stroke={wavelengthToHex(nm)} strokeWidth={4} strokeLinecap="round" />;
          })}
          <line x1={px(SPECTRAL_LOCUS[0][1])} y1={py(SPECTRAL_LOCUS[0][2])} x2={px(SPECTRAL_LOCUS[SPECTRAL_LOCUS.length - 1][1])} y2={py(SPECTRAL_LOCUS[SPECTRAL_LOCUS.length - 1][2])} stroke="var(--text-3)" strokeDasharray="4 4" />
          {[460, 480, 500, 520, 560, 600].map((nm) => {
            const [x, y] = locusPoint(nm);
            return (
              <text key={nm} x={px(x) + (x < 0.15 ? -10 : 10)} y={py(y)} fontSize={10} fill="var(--text-3)" textAnchor={x < 0.15 ? 'end' : 'start'} fontFamily="var(--font-mono)">
                {nm}
              </text>
            );
          })}
          <polygon points={tri.map(([x, y]) => `${px(x)},${py(y)}`).join(' ')} fill="none" stroke="var(--text-2)" strokeWidth={1.2} />
          {pts.map(([x, y], i) => (
            <circle key={i} cx={px(x)} cy={py(y)} r={i === sym % pts.length ? 9 : 5.5} fill={xyToRgb(x, y)} stroke={i === sym % pts.length ? 'var(--text)' : 'rgba(0,0,0,.5)'} strokeWidth={i === sym % pts.length ? 2 : 1} style={{ transition: 'r .2s' }} />
          ))}
          <circle cx={px(centroid[0])} cy={py(centroid[1])} r={4} fill="none" stroke="var(--text)" strokeDasharray="2 2" />
          <text x={px(centroid[0]) + 8} y={py(centroid[1]) - 8} fontSize={10} fill="var(--text-2)" fontFamily="var(--font-mono)">
            perceived white
          </text>
          <text x={px(0.02)} y={py(0.85)} fontSize={11} fill="var(--text-3)" fontFamily="var(--font-mono)">
            CIE 1931 (x, y)
          </text>
        </svg>
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: xyToRgb(cur[0], cur[1]), boxShadow: `0 0 40px ${xyToRgb(cur[0], cur[1])}`, transition: 'background .3s, box-shadow .3s' }} />
          <span className="eyebrow">symbol colour</span>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: xyToRgb(centroid[0], centroid[1]) }} />
          <span className="eyebrow" style={{ textAlign: 'center' }}>
            what the eye sees
          </span>
        </div>
      </div>
    </Widget>
  );
}
