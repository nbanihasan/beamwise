import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Slider, Widget } from '@/viz/controls';
import { concentratorGain, lambertianOrder, losGain } from '@/sim/lambertian';
import { tiaBandwidth } from '@/sim/receiver';
import { eng, PHYS } from '@/sim/math';

/** Receiver optics (concentrator gain vs FOV) and the transimpedance amplifier trade-off. */
export default function OpticsLab() {
  const [fov, setFov] = useState(40);
  const [n, setN] = useState(1.5);
  const [rfK, setRf] = useState(10);
  const [areaMm2, setArea] = useState(10);
  const gbw = 4e9; // op-amp gain-bandwidth product
  const cpd = areaMm2 * 30e-12; // ~30 pF/mm² for a silicon PIN at modest reverse bias
  const Ct = cpd + 1e-12;
  const Rf = rfK * 1e3;
  const f3 = tiaBandwidth(gbw, Rf, Ct);
  const thermal = Math.sqrt((4 * PHYS.k * 300) / Rf); // A/√Hz

  const coverage = useMemo(() => {
    const xs = Array.from({ length: 121 }, (_, i) => i * 0.025);
    const m = lambertianOrder(60);
    const g = (fovDeg: number, nn: number) =>
      xs.map((x) => losGain({ pos: [0, 0, 2.15], normal: [0, 0, -1], m }, { pos: [x, 0, 0], normal: [0, 0, 1], area: 1e-4, fovDeg, n: nn }).H * 1e6);
    return { xs, cur: g(fov, n), wide: g(90, 0) };
  }, [fov, n]);
  const gain = concentratorGain(n, fov);
  const radius = 2.15 * Math.tan((fov * Math.PI) / 180);

  const tia = useMemo(() => {
    const r = Array.from({ length: 100 }, (_, i) => Math.pow(10, 2 + (i / 99) * 4));
    return { r: r.map((x) => x / 1e3), bw: r.map((x) => tiaBandwidth(gbw, x, Ct) / 1e6), noise: r.map((x) => Math.sqrt((4 * PHYS.k * 300) / x) * 1e12) };
  }, [Ct]);

  return (
    <Widget
      title="Receiver front-end: optics and the transimpedance amplifier"
      controls={
        <>
          <GroupTitle>Concentrator</GroupTitle>
          <Slider label="Field of view Ψc" value={fov} min={10} max={90} step={1} onChange={setFov} format={(v) => `${v.toFixed(0)}°`} />
          <Slider label="Refractive index n" value={n} min={1} max={2.2} step={0.05} onChange={setN} format={(v) => v.toFixed(2)} />
          <GroupTitle>Photodiode + TIA</GroupTitle>
          <Slider label="Photodiode area" value={areaMm2} min={0.1} max={100} log onChange={setArea} format={(v) => `${v.toPrecision(2)} mm²`} />
          <Slider label="Feedback resistor R_F" value={rfK} min={0.1} max={1000} log onChange={setRf} format={(v) => eng(v * 1e3, 'Ω')} />
          <Readouts>
            <Readout k="Concentrator gain" v={`${gain.toFixed(1)}× (${(10 * Math.log10(gain)).toFixed(1)} dB)`} />
            <Readout k="Coverage radius" v={fov >= 89 ? 'whole room' : `${radius.toFixed(2)} m`} />
            <Readout k="PD capacitance" v={eng(cpd, 'F')} />
            <Readout k="TIA bandwidth" v={eng(f3, 'Hz')} />
            <Readout k="R_F noise" v={`${(thermal * 1e12).toFixed(2)} pA/√Hz`} />
          </Readouts>
        </>
      }
      caption={
        <p>
          An ideal non-imaging concentrator (such as a CPC) multiplies collected power by n²/sin²Ψc, but only for light within its field of view. Narrow the FOV for gain
          and the coverage area shrinks. The same tension appears electrically: a large feedback resistor gives more gain and less thermal noise (4kT/R<sub>F</sub>) but
          lower bandwidth, and a large photodiode collects more light but its capacitance slows the amplifier down.
        </p>
      }
    >
      <Plot
        title="Channel gain vs horizontal offset (LED 2.15 m above, Φ½ = 60°)"
        height={200}
        xLabel="offset from below the LED (m)"
        yLabel="H(0) × 10⁶"
        legend
        series={[
          { x: coverage.xs, y: coverage.wide, color: 'var(--text-3)', dash: [4, 3], label: 'bare PD, 90° FOV' },
          { x: coverage.xs, y: coverage.cur, color: 'var(--phosphor)', width: 2.2, label: `concentrator, ${fov}° FOV` },
        ]}
      />
      <div className="grid-2">
        <Plot
          title="TIA bandwidth vs R_F"
          height={180}
          logX
          logY
          xLabel="R_F (kΩ)"
          yLabel="MHz"
          series={[{ x: tia.r, y: tia.bw, color: 'var(--c6)', width: 2 }]}
          points={[{ x: rfK, y: f3 / 1e6, color: 'var(--phosphor)' }]}
        />
        <Plot
          title="R_F thermal noise vs R_F"
          height={180}
          logX
          logY
          xLabel="R_F (kΩ)"
          yLabel="pA/√Hz"
          series={[{ x: tia.r, y: tia.noise, color: 'var(--c4)', width: 2 }]}
          points={[{ x: rfK, y: thermal * 1e12, color: 'var(--phosphor)' }]}
        />
      </div>
    </Widget>
  );
}
