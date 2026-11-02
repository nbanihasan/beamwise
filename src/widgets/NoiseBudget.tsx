import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Segmented, Slider, Widget, berTone } from '@/viz/controls';
import { berOOK, noiseBudget, optimalApdGain } from '@/sim/receiver';
import { dB, eng, sci } from '@/sim/math';

/** Shot, background and thermal noise; thermal- vs shot-limited regimes; the APD gain optimum. */
const AMBIENT = [
  { id: 'dark', label: 'Dark room', ua: 1 },
  { id: 'office', label: 'Office', ua: 50 },
  { id: 'window', label: 'Near window', ua: 500 },
  { id: 'sun', label: 'Direct sun', ua: 5000 },
] as const;

export default function NoiseBudget() {
  const [prDbm, setPrDbm] = useState(-25);
  const [amb, setAmb] = useState<(typeof AMBIENT)[number]['id']>('office');
  const [bwMHz, setBw] = useState(20);
  const [inA, setIn] = useState(5);
  const [M, setM] = useState(1);
  const R = 0.5;
  const Ibg = AMBIENT.find((a) => a.id === amb)!.ua * 1e-6;
  const p = { R, Pr: Math.pow(10, prDbm / 10) / 1000, Ibg, B: bwMHz * 1e6, inputNoise: inA * 1e-12, kA: 0.02 };
  const nb = noiseBudget({ ...p, M });
  const best = optimalApdGain(p, 500);

  const curves = useMemo(() => {
    const x = Array.from({ length: 121 }, (_, i) => -60 + i * 0.5);
    const pin = x.map((d) => dB(noiseBudget({ ...p, Pr: Math.pow(10, d / 10) / 1000, M: 1 }).snr));
    const apd = x.map((d) => dB(optimalApdGain({ ...p, Pr: Math.pow(10, d / 10) / 1000 }, 500).snr));
    return { x, pin, apd };
  }, [amb, bwMHz, inA]); // eslint-disable-line react-hooks/exhaustive-deps

  const gainCurve = useMemo(() => {
    const g = Array.from({ length: 100 }, (_, i) => Math.pow(10, (i / 99) * Math.log10(500)));
    return { g, snr: g.map((m) => dB(noiseBudget({ ...p, M: m }).snr)) };
  }, [prDbm, amb, bwMHz, inA]); // eslint-disable-line react-hooks/exhaustive-deps

  const parts = [
    { k: 'Signal shot', v: nb.shot, c: 'var(--phosphor)' },
    { k: 'Background shot', v: nb.background, c: 'var(--c4)' },
    { k: 'Thermal / amplifier', v: nb.thermal, c: 'var(--c1)' },
  ];
  return (
    <Widget
      title="Noise budget of an optical receiver"
      controls={
        <>
          <GroupTitle>Signal</GroupTitle>
          <Slider label="Received power" value={prDbm} min={-60} max={0} step={0.5} onChange={setPrDbm} format={(v) => `${v.toFixed(1)} dBm`} />
          <Segmented label="Ambient light" value={amb} onChange={setAmb} options={AMBIENT.map((a) => ({ value: a.id, label: a.label }))} />
          <GroupTitle>Receiver</GroupTitle>
          <Slider label="Bandwidth B" value={bwMHz} min={1} max={1000} log onChange={setBw} format={(v) => `${v.toFixed(v < 10 ? 1 : 0)} MHz`} />
          <Slider label="Amplifier noise" value={inA} min={0.5} max={30} step={0.5} onChange={setIn} format={(v) => `${v.toFixed(1)} pA/√Hz`} />
          <Slider label="APD gain M" value={M} min={1} max={500} log onChange={setM} format={(v) => `${v.toFixed(v < 10 ? 1 : 0)}`} />
          <Readouts>
            <Readout k="SNR" v={`${dB(nb.snr).toFixed(1)} dB`} />
            <Readout k="OOK BER" v={sci(berOOK(nb.snr), 1)} tone={berTone(berOOK(nb.snr))} />
            <Readout k="Best APD gain" v={`M ≈ ${best.M.toFixed(0)}`} />
          </Readouts>
        </>
      }
      caption={
        <p>
          The three noise sources add as variances: σ² = 2q(RP<sub>r</sub>)M²F(M)B + 2qI<sub>bg</sub>M²F(M)B + i<sub>n</sub>²B. At low power the receiver is
          thermal-noise limited and SNR rises 2 dB per dB of optical power; at high power it is shot-noise limited and rises only 1 dB per dB. Avalanche gain lifts the
          signal above the amplifier noise, but its excess noise F(M) means there is an optimum M, beyond which more gain hurts.
        </p>
      }
    >
      <div>
        <div className="plot-title">
          <span>Noise power share</span>
          <span>σ total = {eng(Math.sqrt(nb.total), 'A')}</span>
        </div>
        <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
          {parts.map((q) => (
            <div key={q.k} title={q.k} style={{ width: `${(q.v / nb.total) * 100}%`, background: q.c, transition: 'width .25s' }} />
          ))}
        </div>
        <div className="plot-legend">
          {parts.map((q) => (
            <span key={q.k}>
              <i style={{ background: q.c }} />
              {q.k} {((q.v / nb.total) * 100).toFixed(0)} %
            </span>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <Plot
          title="SNR vs received power"
          height={210}
          xLabel="received power (dBm)"
          yLabel="SNR (dB)"
          y={[-20, 90]}
          legend
          series={[
            { x: curves.x, y: curves.pin, color: 'var(--c1)', label: 'PIN', width: 2 },
            { x: curves.x, y: curves.apd, color: 'var(--phosphor)', label: 'APD, optimum M', width: 2 },
          ]}
          vlines={[{ x: prDbm, color: 'var(--text-3)' }]}
          hlines={[{ y: 13.5, label: 'BER 1e-6 (OOK)', color: 'var(--good)' }]}
        />
        <Plot
          title="SNR vs avalanche gain"
          height={210}
          logX
          xLabel="gain M"
          yLabel="SNR (dB)"
          series={[{ x: gainCurve.g, y: gainCurve.snr, color: 'var(--phosphor)', width: 2 }]}
          points={[
            { x: best.M, y: dB(best.snr), color: 'var(--good)', label: 'optimum' },
            { x: M, y: dB(nb.snr), color: 'var(--pump)', ring: true },
          ]}
        />
      </div>
    </Widget>
  );
}
