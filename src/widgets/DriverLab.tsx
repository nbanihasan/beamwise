import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Slider, Widget } from '@/viz/controls';
import { onePole } from '@/sim/dsp';
import { prbs, upsampleHold } from '@/sim/modulation';

/**
 * The bias-tee driver and analogue pre-emphasis. A pre-emphasis network boosts the edges of the drive
 * signal so the slow LED's light output settles within one symbol.
 */
export default function DriverLab() {
  const [ratio, setRatio] = useState(3); // symbol rate / LED bandwidth
  const [emph, setEmph] = useState(0.6);
  const sps = 32;
  const d = useMemo(() => {
    const bits = prbs(24, 3);
    const x = upsampleHold(Array.from(bits, (b) => (b ? 1 : -1)), sps);
    const fs = sps; // symbol rate = 1
    const fc = 1 / ratio;
    // pre-emphasis: x + k·(x - lowpass(x)) boosts high frequencies; k = emph·(ratio) approximates the inverse pole
    const lp = onePole(x, fc, fs, -1);
    const k = emph * Math.max(0, ratio * 1.2 - 0.2);
    const pre = Float64Array.from(x, (v, i) => v + k * (v - lp[i]));
    const peak = Math.max(...Array.from(pre, Math.abs));
    const preN = Float64Array.from(pre, (v) => v / peak); // keep within the LED swing
    const outPlain = onePole(x, fc, fs, -1);
    const outPre = onePole(preN, fc, fs, -1);
    // eye opening at symbol centres
    const open = (y: Float64Array, ref: Float64Array) => {
      let lo1 = Infinity;
      let hi0 = -Infinity;
      for (let s = 2; s < 24; s++) {
        const v = y[s * sps + sps - 2];
        if (ref[s * sps] > 0) lo1 = Math.min(lo1, v);
        else hi0 = Math.max(hi0, v);
      }
      return Math.max(0, lo1 - hi0) / 2;
    };
    return { t: Array.from(x, (_, i) => i / sps), x, preN, outPlain, outPre, openPlain: open(outPlain, x), openPre: open(outPre, x), scale: 1 / peak };
  }, [ratio, emph]);

  return (
    <Widget
      title="Driver electronics: bias-tee and pre-emphasis"
      controls={
        <>
          <Slider label="Symbol rate ÷ LED bandwidth" value={ratio} min={0.5} max={8} step={0.1} onChange={setRatio} format={(v) => `${v.toFixed(1)}×`} />
          <Slider label="Pre-emphasis strength" value={emph} min={0} max={1} step={0.01} onChange={setEmph} format={(v) => `${(v * 100).toFixed(0)} %`} />
          <Readouts>
            <Readout k="Eye opening, plain" v={`${(d.openPlain * 100).toFixed(0)} %`} tone={d.openPlain > 0.4 ? 'good' : d.openPlain > 0.1 ? 'warn' : 'bad'} />
            <Readout k="Eye opening, pre-emph." v={`${(d.openPre * 100).toFixed(0)} %`} tone={d.openPre > 0.4 ? 'good' : d.openPre > 0.1 ? 'warn' : 'bad'} />
            <Readout k="Low-freq. swing kept" v={`${(d.scale * 100).toFixed(0)} %`} />
          </Readouts>
        </>
      }
      caption={
        <p>
          A bias-tee adds the high-speed data current (through a capacitor) to a steady DC bias current (through an inductor), so the LED stays lit and dimmable while
          it carries data. When the symbol rate exceeds the LED bandwidth, each bit smears into the next. Pre-emphasis spikes the drive current at every transition to
          charge the junction faster. It opens the eye but spends part of the LED's limited swing on the spikes, so the steady-state signal shrinks.
        </p>
      }
    >
      <svg viewBox="0 0 640 150" style={{ width: '100%', display: 'block' }} role="img" aria-label="Bias-tee schematic">
        <g fill="none" stroke="var(--text-2)" strokeWidth="1.6">
          <path d="M40 40 H150" />
          <path d="M150 28 V52 M160 28 V52" />
          <path d="M160 40 H360" />
          <path d="M40 110 H110" />
          <path d="M110 110 q8 -14 16 0 q8 -14 16 0 q8 -14 16 0 q8 -14 16 0" />
          <path d="M174 110 H330 V40" />
          <path d="M360 40 H420" />
          <path d="M420 25 L450 40 L420 55 Z" fill="var(--phosphor-soft)" stroke="var(--phosphor)" />
          <path d="M450 25 V55" stroke="var(--phosphor)" />
          <path d="M450 40 H520 V120" />
          <path d="M505 120 H535" />
          <path d="M432 18 l12 -12 M440 22 l12 -12" stroke="var(--phosphor)" />
        </g>
        <circle r="3.5" fill="var(--c1)">
          <animateMotion dur="1.6s" repeatCount="indefinite" path="M40 40 H150 M160 40 H420" />
        </circle>
        <circle r="3.5" fill="var(--c3)">
          <animateMotion dur="2.4s" repeatCount="indefinite" path="M40 110 H330 V40 H420" />
        </circle>
        <g fill="var(--text-3)" fontFamily="var(--font-mono)" fontSize="11">
          <text x="40" y="30">data (AC)</text>
          <text x="140" y="70">C</text>
          <text x="40" y="100">bias (DC)</text>
          <text x="130" y="130">L</text>
          <text x="400" y="78">LED</text>
          <text x="530" y="140">gnd</text>
          <text x="210" y="30">AC + DC → LED current</text>
        </g>
      </svg>
      <Plot
        title="Drive current: plain NRZ (dashed) vs pre-emphasised"
        height={140}
        y={[-1.15, 1.15]}
        series={[
          { x: d.t, y: d.x, color: 'var(--text-3)', dash: [4, 3], width: 1 },
          { x: d.t, y: d.preN, color: 'var(--pump)', width: 1.6 },
        ]}
      />
      <Plot
        title="Light output after the LED's low-pass response"
        height={150}
        y={[-1.15, 1.15]}
        series={[
          { x: d.t, y: d.outPlain, color: 'var(--text-3)', width: 1.4 },
          { x: d.t, y: d.outPre, color: 'var(--phosphor)', width: 2 },
        ]}
        hlines={[{ y: 0, label: 'threshold' }]}
      />
    </Widget>
  );
}
