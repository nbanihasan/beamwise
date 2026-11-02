import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Slider, Widget, berTone } from '@/viz/controls';
import { deadTimeRate, photonRate, spadOokBer, noiseBudget, berOOK } from '@/sim/receiver';
import { rng, sci } from '@/sim/math';

/** Photon counting with dead time; SPAD-array vs PIN sensitivity for OOK. */
export default function SpadLab() {
  const [dbm, setDbm] = useState(-62);
  const [deadNs, setDead] = useState(10);
  const [nSpads, setN] = useState(1024);
  const [pde, setPde] = useState(0.3);
  const bitRate = 50e6;
  const nm = 450;
  const P = Math.pow(10, dbm / 10) / 1000;
  const lambdaIn = pde * photonRate(P / nSpads, nm); // per SPAD

  const timeline = useMemo(() => {
    // 2 µs window of one SPAD at a slowed-down incident rate for visibility
    const u = rng(3);
    const win = 2e-6;
    const rate = Math.min(lambdaIn, 4e8);
    const arrivals: number[] = [];
    let t = 0;
    while (arrivals.length < 400) {
      t += -Math.log(1 - u()) / Math.max(rate, 1);
      if (t > win) break;
      arrivals.push(t);
    }
    const counted: number[] = [];
    const lost: number[] = [];
    let busy = -1;
    for (const a of arrivals) {
      if (a >= busy) {
        counted.push(a);
        busy = a + deadNs * 1e-9;
      } else lost.push(a);
    }
    return { counted, lost };
  }, [lambdaIn, deadNs]);

  const sat = useMemo(() => {
    const x = Array.from({ length: 120 }, (_, i) => -90 + i * 0.6);
    const ideal = x.map((d) => pde * photonRate(Math.pow(10, d / 10) / 1000, nm));
    const real = x.map((d) => nSpads * deadTimeRate(pde * photonRate(Math.pow(10, d / 10) / 1000 / nSpads, nm), deadNs * 1e-9));
    return { x, ideal, real };
  }, [deadNs, nSpads, pde]);

  const ber = useMemo(() => {
    const x = Array.from({ length: 50 }, (_, i) => -90 + i * 1.2);
    const spad = x.map((d) => Math.max(1e-12, spadOokBer(Math.pow(10, d / 10) / 1000, nm, bitRate, { pde, deadTime: deadNs * 1e-9, darkRate: 1000, nSpads }).ber));
    const pin = x.map((d) => Math.max(1e-12, berOOK(noiseBudget({ R: 0.3, Pr: Math.pow(10, d / 10) / 1000, Ibg: 0, B: bitRate, inputNoise: 3e-12 }).snr)));
    return { x, spad, pin };
  }, [deadNs, nSpads, pde]);

  const now = spadOokBer(P, nm, bitRate, { pde, deadTime: deadNs * 1e-9, darkRate: 1000, nSpads });
  return (
    <Widget
      title="Counting photons: SPAD receivers"
      controls={
        <>
          <Slider label="Received power" value={dbm} min={-90} max={-30} step={0.5} onChange={setDbm} format={(v) => `${v.toFixed(1)} dBm`} />
          <Slider label="Dead time τd" value={deadNs} min={1} max={100} log onChange={setDead} format={(v) => `${v.toFixed(1)} ns`} />
          <Slider label="SPADs in array" value={nSpads} min={1} max={16384} log onChange={(v) => setN(Math.round(v))} format={(v) => `${Math.round(v)}`} />
          <Slider label="Detection efficiency" value={pde} min={0.05} max={0.6} step={0.01} onChange={setPde} format={(v) => `${(v * 100).toFixed(0)} %`} />
          <Readouts>
            <Readout k="Photons per bit" v={((photonRate(P, nm) * pde) / bitRate).toPrecision(3)} />
            <Readout k="Mean counts 1/0" v={`${now.l1.toFixed(1)} / ${now.l0.toFixed(2)}`} />
            <Readout k="OOK BER @ 50 Mb/s" v={sci(now.ber, 1)} tone={berTone(now.ber)} />
          </Readouts>
        </>
      }
      caption={
        <p>
          A SPAD fires once per detected photon and is then blind for its dead time τ<sub>d</sub>, so the count rate saturates at λ/(1 + λτ<sub>d</sub>). Splitting light
          over an array of N SPADs pushes saturation up by N. Because the receiver counts photons, it reaches BER 10⁻⁶ with roughly 20 detected photons per bit,
          tens of dB below a PIN receiver limited by amplifier noise. See Huang <em>et al.</em> (2024).
        </p>
      }
    >
      <Plot
        title="One SPAD, 2 µs: photons counted (yellow) and lost in dead time (red)"
        height={110}
        x={[0, 2]}
        y={[0, 1.2]}
        hideYTicks
        xLabel="time (µs)"
        series={[
          { x: timeline.counted.map((t) => t * 1e6), y: timeline.counted.map(() => 1), kind: 'stem', color: 'var(--phosphor)', size: 2 },
          { x: timeline.lost.map((t) => t * 1e6), y: timeline.lost.map(() => 0.55), kind: 'stem', color: 'var(--bad)', size: 2 },
        ]}
      />
      <div className="grid-2">
        <Plot
          title="Count rate vs power: saturation"
          height={200}
          logY
          xLabel="received power (dBm)"
          yLabel="counts/s"
          legend
          series={[
            { x: sat.x, y: sat.ideal, color: 'var(--text-3)', dash: [4, 4], label: 'no dead time' },
            { x: sat.x, y: sat.real, color: 'var(--phosphor)', width: 2, label: `${nSpads} SPADs` },
          ]}
          vlines={[{ x: dbm }]}
        />
        <Plot
          title="BER vs received power (OOK, 50 Mb/s)"
          height={200}
          logY
          y={[1e-10, 1]}
          xLabel="received power (dBm)"
          legend
          series={[
            { x: ber.x, y: ber.spad, color: 'var(--phosphor)', width: 2, label: 'SPAD array' },
            { x: ber.x, y: ber.pin, color: 'var(--c1)', width: 2, label: 'PIN + TIA' },
          ]}
          hlines={[{ y: 1e-6, label: '1e-6' }]}
          vlines={[{ x: dbm }]}
        />
      </div>
    </Widget>
  );
}
