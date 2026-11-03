import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Select, Slider, Widget } from '@/viz/controls';

/**
 * A reconfigurable surface on the floor redirects an LED's light to a receiver that is NOT at the
 * mirror (specular) position. Compare a plain mirror, a MEMS micro-mirror array, a DMD, a phase-gradient
 * metasurface (generalized Snell's law) and a liquid-crystal steering layer.
 */
type Mode = 'mirror' | 'mems' | 'dmd' | 'meta' | 'lc';
const INFO: Record<Mode, { label: string; speed: string; note: string }> = {
  mirror: { label: 'Plain mirror', speed: 'fixed', note: 'Angle in = angle out. It only helps a receiver that happens to sit at the mirror position.' },
  mems: { label: 'MEMS micro-mirror array', speed: '0.1–10 ms per tilt', note: 'Each micro-mirror tilts on electrostatic hinges, steering its piece of the beam anywhere within ±tilt range. Broadband and polarization-independent; the mirror-array RIS of the VLC literature.' },
  dmd: { label: 'DMD (digital micromirrors)', speed: '≈ 10–50 µs', note: 'Millions of mirrors, each only ±12°: on or off. Very fast and cheap (projectors), but can only steer to two fixed directions.' },
  meta: { label: 'Metasurface (phase gradient)', speed: 'static, or ns–µs if tunable', note: 'Sub-wavelength nano-antennas impose a phase φ(x). A phase gradient bends the reflection: sin θr = sin θi + (λ/2π)·dφ/dx (generalized Snell law). Phase is wrapped at 2π and quantised; fewer levels waste light into other orders.' },
  lc: { label: 'Liquid-crystal layer', speed: '1–30 ms', note: 'A voltage rotates LC molecules and changes the refractive index, forming a tunable prism or lens. Smooth, low-power, but only a few degrees of steering and it acts on one polarization.' },
};

const W = 720;
const LED = { x: 80, y: 50 };
const SY = 290;
const N = 16;
const X0 = 220;
const X1 = 520;
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
/** angle from the surface normal (pointing up), positive to the right */
const ang = (dx: number, dy: number) => Math.atan2(dx, -dy);

interface ElemOut {
  x: number;
  tilt: number;
  outAng: number;
  eff: number;
  phase: number;
  hit: boolean;
}

export default function SmartSurfaceLab() {
  const [mode, setMode] = useState<Mode>('mems');
  const [rx, setRx] = useState(600);
  const [tmax, setTmax] = useState(10);
  const [bits, setBits] = useState(2);
  const [lcMax, setLcMax] = useState(6);
  const xs = Array.from({ length: N }, (_, i) => X0 + ((i + 0.5) * (X1 - X0)) / N);

  const elems: ElemOut[] = useMemo(() => {
    let phaseAcc = 0;
    return xs.map((x) => {
      const inc = Math.atan2(x - LED.x, SY - LED.y); // angle of incidence from normal
      const spec = inc; // specular outgoing angle (to the right)
      const need = ang(rx - x, LED.y - SY); // required outgoing angle
      let out = spec;
      let tilt = 0;
      let eff = 0.95;
      let phase = 0;
      if (mode === 'mems' || mode === 'dmd') {
        const want = (need - spec) / 2; // facet tilt needed
        tilt = mode === 'mems' ? Math.max(-rad(tmax), Math.min(rad(tmax), want)) : want >= 0 ? rad(12) : -rad(12);
        out = spec + 2 * tilt;
        eff = mode === 'mems' ? 0.9 : 0.85;
      } else if (mode === 'meta') {
        const ds = Math.sin(need) - Math.sin(inc);
        out = need;
        const L = 2 ** bits;
        eff = 0.9 * Math.pow(Math.sin(Math.PI / L) / (Math.PI / L), 2);
        phaseAcc += ds * 2 * Math.PI * 1.6; // dφ per element = k·d·Δsin (d = 1.6 λ per drawn cell)
        const wrapped = ((phaseAcc % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        phase = (Math.floor((wrapped / (2 * Math.PI)) * L) / L) * 2 * Math.PI;
      } else if (mode === 'lc') {
        out = spec + Math.max(-rad(lcMax), Math.min(rad(lcMax), need - spec));
        eff = 0.45; // one polarization of unpolarized LED light
      }
      const xHit = x + Math.tan(out) * (SY - LED.y);
      return { x, tilt, outAng: out, eff, phase, hit: Math.abs(xHit - rx) < 24 };
    });
  }, [mode, rx, tmax, bits, lcMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const power = elems.reduce((a, e) => a + (e.hit ? e.eff : 0), 0) / N;
  const mid = elems[N / 2];
  const specAng = Math.atan2(mid.x - LED.x, SY - LED.y);
  const needAng = ang(rx - mid.x, LED.y - SY);

  return (
    <Widget
      title="Smart surfaces: steering light around the room"
      eyebrow="Interactive · RIS"
      controls={
        <>
          <Select label="Surface" value={mode} options={(Object.keys(INFO) as Mode[]).map((k) => ({ value: k, label: INFO[k].label }))} onChange={setMode} />
          <Slider label="Receiver position" value={rx} min={120} max={690} step={2} onChange={setRx} format={(v) => `${((v - 370) / 100).toFixed(1)} m`} />
          {mode === 'mems' && <Slider label="Max mirror tilt" value={tmax} min={2} max={25} step={1} unit="°" onChange={setTmax} />}
          {mode === 'meta' && <Slider label="Phase levels (bits)" value={bits} min={1} max={4} step={1} onChange={setBits} format={(v) => `${v} bit (${2 ** v} levels)`} />}
          {mode === 'lc' && <Slider label="LC steering range" value={lcMax} min={1} max={15} step={0.5} unit="°" onChange={setLcMax} />}
          <Readouts>
            <Readout k="Mirror (specular) angle" v={`${deg(specAng).toFixed(1)}°`} />
            <Readout k="Angle needed" v={`${deg(needAng).toFixed(1)}°`} />
            <Readout k="Extra deflection" v={`${deg(needAng - specAng).toFixed(1)}°`} />
            <Readout k="Light reaching receiver" v={`${(power * 100).toFixed(0)} %`} tone={power > 0.5 ? 'good' : power > 0.15 ? 'warn' : 'bad'} />
            <Readout k="Reconfiguration" v={INFO[mode].speed} />
          </Readouts>
        </>
      }
      caption={<p>{INFO[mode].note} Drag the receiver: the plain mirror only serves one spot, the MEMS array runs out of tilt for large deflections, the DMD can only flip, and the metasurface steers anywhere but pays a quantisation loss.</p>}
    >
      <svg viewBox={`0 0 ${W} 310`} className="ss-svg" role="img" aria-label="Reconfigurable surface steering">
        <defs>
          <linearGradient id="ssPh" x1="0" x2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="0.5" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#facc15" />
          </linearGradient>
        </defs>
        <line x1={0} x2={W} y1={SY + 12} y2={SY + 12} stroke="var(--line-strong)" />
        {elems.map((e, i) => {
          const len = 330;
          const ox = e.x + Math.sin(e.outAng) * len;
          const oy = SY - Math.cos(e.outAng) * len;
          return (
            <g key={i}>
              <line x1={LED.x} y1={LED.y} x2={e.x} y2={SY} stroke="var(--phosphor)" strokeOpacity={0.22} />
              <line x1={e.x} y1={SY} x2={ox} y2={oy} stroke={e.hit ? 'var(--good)' : 'var(--phosphor)'} strokeOpacity={e.hit ? 0.75 : 0.28} strokeWidth={e.hit ? 1.6 : 1} />
              {mode === 'meta' && <line x1={e.x} y1={SY} x2={e.x + Math.sin(Math.atan2(e.x - LED.x, SY - LED.y)) * 160} y2={SY - Math.cos(Math.atan2(e.x - LED.x, SY - LED.y)) * 160} stroke="var(--text-3)" strokeOpacity={1 - e.eff} strokeDasharray="2 3" />}
            </g>
          );
        })}
        {mode === 'mirror' && <rect x={X0} y={SY} width={X1 - X0} height={6} fill="#dfe6f2" />}
        {(mode === 'mems' || mode === 'dmd') &&
          elems.map((e, i) => {
            const hw = (X1 - X0) / N / 2 - 1.5;
            return <line key={i} x1={e.x - hw * Math.cos(e.tilt)} y1={SY + 3 - hw * Math.sin(e.tilt)} x2={e.x + hw * Math.cos(e.tilt)} y2={SY + 3 + hw * Math.sin(e.tilt)} stroke="#dfe6f2" strokeWidth={4} strokeLinecap="round" />;
          })}
        {mode === 'meta' &&
          elems.map((e, i) => (
            <rect key={i} x={e.x - (X1 - X0) / N / 2 + 1} y={SY} width={(X1 - X0) / N - 2} height={8} rx={1.5} fill={`hsl(${(e.phase / (2 * Math.PI)) * 300}, 80%, 62%)`} />
          ))}
        {mode === 'lc' && <rect x={X0} y={SY - 2} width={X1 - X0} height={10} rx={2} fill="url(#ssPh)" opacity={0.6} stroke="var(--c6)" />}
        <g transform={`translate(${LED.x},${LED.y})`}>
          <circle r={16} fill="var(--phosphor)" opacity={0.2} />
          <rect x={-12} y={-8} width={24} height={14} rx={3} fill="var(--solid)" stroke="var(--phosphor)" />
          <text y={-16} textAnchor="middle" className="ss-l">
            LED
          </text>
        </g>
        <g transform={`translate(${rx},${LED.y})`}>
          <rect x={-24} y={-8} width={48} height={12} rx={3} fill={power > 0.15 ? 'rgba(94,224,168,0.25)' : 'var(--solid)'} stroke="var(--good)" />
          <text y={-14} textAnchor="middle" className="ss-l">
            receiver
          </text>
        </g>
        <rect x={340} y={30} width={14} height={120} rx={3} fill="var(--surface-3)" stroke="var(--line-strong)" />
        <text x={347} y={170} textAnchor="middle" className="ss-l">
          wall: no LOS
        </text>
      </svg>
      {mode === 'meta' && (
        <Plot
          height={130}
          title="Phase profile across the metasurface"
          xLabel="element"
          yLabel="φ / 2π"
          x={[0, N]}
          y={[0, 1]}
          series={[{ x: elems.map((_, i) => i + 0.5), y: elems.map((e) => e.phase / (2 * Math.PI)), color: 'var(--c5)', kind: 'step', width: 2 }]}
        />
      )}
    </Widget>
  );
}
