import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Widget, GroupTitle } from '@/viz/controls';
import { ledTransfer, firstOrderDb } from '@/sim/dsp';
import { fftReal } from '@/sim/ofdm';
import { dB } from '@/sim/math';

/** LED light–current transfer (non-linearity, clipping) and modulation bandwidth for common LED types. */
const TYPES = [
  { id: 'phosphor', label: 'Phosphor white', fc: 3, note: 'Slow yellow phosphor (µs decay) limits the white output to a few MHz.' },
  { id: 'filtered', label: 'White + blue filter', fc: 15, note: 'Filtering out the slow phosphor leaves the fast blue pump, at the cost of power.' },
  { id: 'rgb', label: 'RGB chip', fc: 20, note: 'No phosphor; three chips, each modulated independently (also enables WDM).' },
  { id: 'micro', label: 'Micro-LED', fc: 800, note: 'Tiny junction capacitance and high current density: hundreds of MHz to GHz.' },
] as const;

export default function LedCurves() {
  const [bias, setBias] = useState(0.5);
  const [swing, setSwing] = useState(0.3);
  const [type, setType] = useState<(typeof TYPES)[number]['id']>('filtered');
  const ty = TYPES.find((t) => t.id === type)!;

  // normalised current 0..1 (1 = absolute max rating), turn-on at 0.08
  const L = (i: number) => 0.9 * ledTransfer((i - 0.08) / 0.42, true, 2.1, 1.6);
  const curve = useMemo(() => {
    const I = Array.from({ length: 200 }, (_, k) => k / 199);
    return { I, P: I.map(L) };
  }, []);

  const wave = useMemo(() => {
    const N = 256;
    const t = Array.from({ length: N }, (_, k) => k / N);
    const i = t.map((x) => bias + swing * Math.sin(2 * Math.PI * 4 * x));
    const p = i.map((v) => (v < 0 ? 0 : L(Math.min(1.2, v))));
    const F = fftReal(p);
    const h = (k: number) => Math.hypot(F.re[k], F.im[k]);
    const fund = h(4);
    const harm = Math.sqrt(h(8) ** 2 + h(12) ** 2 + h(16) ** 2 + h(20) ** 2);
    return { t, i, p, thd: harm / Math.max(1e-12, fund) };
  }, [bias, swing]);

  const freq = useMemo(() => {
    const f = Array.from({ length: 200 }, (_, k) => Math.pow(10, -1 + (k / 199) * 4));
    return { f, all: TYPES.map((t) => f.map((x) => firstOrderDb(x, t.fc))) };
  }, []);

  const thdDb = dB(wave.thd * wave.thd);
  return (
    <Widget
      title="LED transfer curve and bandwidth"
      controls={
        <>
          <GroupTitle>Operating point</GroupTitle>
          <Slider label="Bias current" value={bias} min={0.05} max={0.9} step={0.01} onChange={setBias} format={(v) => `${(v * 1000).toFixed(0)} mA`} />
          <Slider label="Signal swing (peak)" value={swing} min={0.01} max={0.6} step={0.01} onChange={setSwing} format={(v) => `±${(v * 1000).toFixed(0)} mA`} />
          <GroupTitle>LED type</GroupTitle>
          <Segmented value={type} onChange={setType} options={TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>
            {ty.note}
          </p>
          <Readouts>
            <Readout k="THD" v={`${thdDb.toFixed(1)} dB`} tone={thdDb < -30 ? 'good' : thdDb < -18 ? 'warn' : 'bad'} />
            <Readout k="−3 dB bandwidth" v={ty.fc >= 1000 ? `${ty.fc / 1000} GHz` : `${ty.fc} MHz`} />
          </Readouts>
        </>
      }
      caption={
        <p>
          Left: the light–current (L–I) curve has a turn-on knee and droops at high current (heating and efficiency droop). Keep the bias in the straight part and the
          swing small and the output is a faithful copy of the input; push it and the waveform clips and gains harmonics (total harmonic distortion, THD). Right: each
          LED behaves roughly like a first-order low-pass filter, which sets how fast you can modulate it.
        </p>
      }
    >
      <div className="grid-2">
        <Plot
          title="L–I curve with operating range"
          height={210}
          x={[0, 1]}
          y={[0, 1]}
          xLabel="drive current (normalised)"
          yLabel="optical power"
          series={[{ x: curve.I, y: curve.P, color: 'var(--phosphor)', width: 2.2 }]}
          bands={[{ x0: Math.max(0, bias - swing), x1: Math.min(1, bias + swing), color: 'var(--pump-soft)' }]}
          vlines={[{ x: bias, label: 'bias', color: 'var(--pump)' }]}
          points={[{ x: bias, y: L(bias), color: 'var(--pump)' }]}
        />
        <Plot
          title="Frequency response, first-order model"
          height={210}
          logX
          x={[0.1, 1000]}
          y={[-30, 2]}
          xLabel="frequency (MHz)"
          yLabel="dB"
          series={TYPES.map((t, k) => ({
            x: freq.f,
            y: freq.all[k],
            color: t.id === type ? 'var(--phosphor)' : 'var(--text-3)',
            width: t.id === type ? 2.4 : 1,
            alpha: t.id === type ? 1 : 0.5,
          }))}
          hlines={[{ y: -3, label: '−3 dB' }]}
          vlines={[{ x: ty.fc, color: 'var(--phosphor)' }]}
        />
      </div>
      <Plot
        title="Drive current (blue) and emitted light (yellow) over two periods"
        height={160}
        y={[-0.05, 1.05]}
        series={[
          { x: wave.t, y: wave.i.map((v) => Math.max(-0.05, v)), color: 'var(--pump)', width: 1.4, dash: [4, 3] },
          { x: wave.t, y: wave.p, color: 'var(--phosphor)', width: 2.2 },
        ]}
      />
    </Widget>
  );
}
