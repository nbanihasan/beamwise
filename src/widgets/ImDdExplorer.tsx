import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Toggle, Widget } from '@/viz/controls';
import { rng, gaussian } from '@/sim/math';

type Sig = 'sine' | 'two-tone' | 'ofdm';

/** Why IM/DD signals must be real and non-negative: bias, clipping and the optical carrier. */
export default function ImDdExplorer() {
  const [sig, setSig] = useState<Sig>('ofdm');
  const [bias, setBias] = useState(0.5);
  const [amp, setAmp] = useState(0.35);
  const [carrier, setCarrier] = useState(false);

  const d = useMemo(() => {
    const N = 600;
    const t = Array.from({ length: N }, (_, i) => i / N);
    const g = gaussian(rng(4));
    const tones = Array.from({ length: 24 }, (_, k) => ({ f: 3 + k * 1.5, a: g(), p: g() * Math.PI }));
    const raw = t.map((x) => {
      if (sig === 'sine') return Math.sin(2 * Math.PI * 4 * x);
      if (sig === 'two-tone') return 0.6 * Math.sin(2 * Math.PI * 3 * x) + 0.6 * Math.sin(2 * Math.PI * 7.3 * x + 1);
      return tones.reduce((s, q) => s + q.a * Math.cos(2 * Math.PI * q.f * x + q.p), 0) / Math.sqrt(tones.length / 2) / 1.6;
    });
    const s = raw.map((v) => amp * v);
    const p = s.map((v) => Math.max(0, bias + v));
    const clipped = s.filter((v) => bias + v < 0).length / N;
    const acPow = s.reduce((a, v) => a + v * v, 0) / N;
    const meanP = p.reduce((a, v) => a + v, 0) / N;
    const field = carrier ? t.map((x, i) => Math.sqrt(p[i]) * Math.cos(2 * Math.PI * 70 * x)) : null;
    return { t, s, p, clipped, acPow, meanP, field };
  }, [sig, bias, amp, carrier]);

  return (
    <Widget
      title="Intensity modulation: the signal must ride on a bias"
      controls={
        <>
          <Segmented label="Information signal" value={sig} onChange={setSig} options={[{ value: 'sine', label: 'Tone' }, { value: 'two-tone', label: 'Two tones' }, { value: 'ofdm', label: 'OFDM-like' }]} />
          <Slider label="DC bias (LED operating point)" value={bias} min={0} max={1} step={0.01} onChange={setBias} format={(v) => v.toFixed(2)} />
          <Slider label="Signal amplitude" value={amp} min={0.02} max={0.8} step={0.01} onChange={setAmp} format={(v) => v.toFixed(2)} />
          <Toggle label="Show the optical field" checked={carrier} onChange={setCarrier} />
        </>
      }
      caption={
        <p>
          A radio transmitter can swing its field positive and negative. An LED can only emit more or less light, so the data signal is added to a DC bias. Wherever
          bias + signal would go below zero the LED simply turns off, and the signal is clipped. Raise the amplitude or lower the bias to see clipping appear.
        </p>
      }
    >
      <Plot
        title="Electrical information signal s(t), zero mean, bipolar"
        height={130}
        y={[-1.2, 1.2]}
        series={[{ y: d.s, x: d.t, color: 'var(--c1)' }]}
        hlines={[{ y: 0, label: '0' }]}
      />
      <Plot
        title="Transmitted optical power P(t) = max(0, bias + s(t))"
        height={170}
        y={[-0.25, 1.6]}
        series={[
          ...(d.field ? [{ y: d.field, x: d.t, color: 'var(--c6)', width: 0.8, alpha: 0.6 }] : []),
          { y: d.s.map((v) => bias + v), x: d.t, color: 'var(--bad)', dash: [3, 3], width: 1, alpha: 0.7 },
          { y: d.p, x: d.t, color: 'var(--phosphor)', kind: 'area' as const, width: 2 },
        ]}
        hlines={[
          { y: bias, label: 'bias', color: 'var(--text-3)' },
          { y: 0, label: 'LED off', color: 'var(--bad)' },
        ]}
      />
      <Readouts>
        <Readout k="Clipped samples" v={`${(d.clipped * 100).toFixed(1)} %`} tone={d.clipped > 0.01 ? 'bad' : d.clipped > 0 ? 'warn' : 'good'} />
        <Readout k="Average optical power" v={d.meanP.toFixed(3)} />
        <Readout k="Modulation depth" v={`${((amp / Math.max(bias, 1e-3)) * 100).toFixed(0)} %`} />
        <Readout k="Signal / DC power" v={`${((d.acPow / Math.max(1e-6, bias * bias)) * 100).toFixed(1)} %`} />
      </Readouts>
    </Widget>
  );
}
