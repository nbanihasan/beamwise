import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { dataCarriers, fftReal, hermitianIfft, papr, qamMap, type QamPoint } from '@/sim/ofdm';
import { prbs } from '@/sim/modulation';
import { dB, gaussian, rng } from '@/sim/math';

/** Build an optical OFDM symbol: Hermitian symmetry, IFFT, bias (DCO) or zero-clipping (ACO). */
function Stack({ comps, sum, N }: { comps: number[][]; sum: number[]; N: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.25) * 0.35 - 0.5;
  });
  const sx = 6 / N;
  const peak = Math.max(...sum.map(Math.abs), 1e-9);
  return (
    <group ref={g}>
      {comps.map((c, k) => (
        <Line key={k} points={c.map((v, n) => [n * sx - 3, (v / peak) * 1.2, -0.35 * (k + 1)] as [number, number, number])} color={new THREE.Color().setHSL(0.6 - (k / comps.length) * 0.55, 0.8, 0.62)} lineWidth={1.2} transparent opacity={0.75} />
      ))}
      <Line points={sum.map((v, n) => [n * sx - 3, (v / peak) * 1.2, 0.3] as [number, number, number])} color="#ffcf6b" lineWidth={3} />
      <Html position={[3.4, 0.2, 0.3]} center>
        <div className="scene-label">sum = OFDM symbol</div>
      </Html>
      <Html position={[3.4, 0.2, -0.35 * comps.length]} center>
        <div className="scene-label">subcarriers</div>
      </Html>
    </group>
  );
}

export default function OfdmBuilder() {
  const [variant, setVariant] = useState<'dco' | 'aco'>('dco');
  const [N, setN] = useState(32);
  const [M, setM] = useState<4 | 16>(16);
  const [bias, setBias] = useState(2);
  const [seed, setSeed] = useState(1);

  const d = useMemo(() => {
    const car = dataCarriers(N, variant);
    const k = Math.log2(M);
    const data = qamMap(prbs(car.length * k, seed), M);
    const x = hermitianIfft(N, car, data);
    const sigma = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / N) || 1;
    const tx = variant === 'dco' ? Array.from(x, (v) => Math.max(0, v + bias * sigma)) : Array.from(x, (v) => Math.max(0, v));
    const clipped = variant === 'dco' ? Array.from(x).filter((v) => v + bias * sigma < 0).length : 0;
    // spectra
    const full = Array.from({ length: N }, (_, kk) => {
      const i = car.indexOf(kk);
      const j = car.indexOf(N - kk);
      if (i >= 0) return data[i];
      if (j >= 0) return { re: data[j].re, im: -data[j].im };
      return { re: 0, im: 0 };
    });
    // receive: FFT of transmitted (noise-free) signal, read back data carriers
    const g = gaussian(rng(seed + 9));
    const pts: QamPoint[] = [];
    for (let rep = 0; rep < 40; rep++) {
      const dd = qamMap(prbs(car.length * k, seed * 100 + rep), M);
      const xx = hermitianIfft(N, car, dd);
      const tt = variant === 'dco' ? Array.from(xx, (v) => Math.max(0, v + bias * sigma)) : Array.from(xx, (v) => Math.max(0, v));
      const F = fftReal(tt.map((v) => v + 0.02 * sigma * g()));
      car.forEach((kk) => {
        const sc = variant === 'aco' ? 2 : 1;
        pts.push({ re: F.re[kk] * sc, im: F.im[kk] * sc });
      });
    }
    // per-carrier sinusoid components for the 3D stack (first 8 positive data carriers)
    const comps = car.slice(0, Math.min(8, car.length)).map((kk, i) =>
      // one symbol period sampled 4× finer than the IFFT grid: t = n / 4 samples
      Array.from({ length: N * 4 }, (_, n) => (2 / N) * (data[i].re * Math.cos((2 * Math.PI * kk * n) / (N * 4)) - data[i].im * Math.sin((2 * Math.PI * kk * n) / (N * 4)))),
    );
    const sumFine = Array.from({ length: N * 4 }, (_, n) => comps.reduce((a, c) => a + c[n], 0));
    const meanP = tx.reduce((a, b) => a + b, 0) / N;
    const acP = x.reduce((a, v) => a + v * v, 0) / N;
    return { x: Array.from(x), tx, sigma, clipped, full, pts, comps, sumFine, papr: papr(x), car, meanP, acP };
  }, [variant, N, M, bias, seed]);

  const idx = Array.from({ length: N }, (_, i) => i);
  const effBits = d.car.length * Math.log2(M);
  return (
    <Widget
      title="Building an optical OFDM symbol"
      eyebrow="3D · interactive"
      controls={
        <>
          <Segmented label="Variant" value={variant} onChange={setVariant} options={[{ value: 'dco', label: 'DCO-OFDM' }, { value: 'aco', label: 'ACO-OFDM' }]} />
          <Segmented label="FFT size N" value={N} onChange={setN} options={[{ value: 16, label: '16' }, { value: 32, label: '32' }, { value: 64, label: '64' }]} />
          <Segmented label="Constellation" value={M} onChange={setM} options={[{ value: 4, label: '4-QAM' }, { value: 16, label: '16-QAM' }]} />
          {variant === 'dco' && <Slider label="DC bias" value={bias} min={0} max={4} step={0.1} onChange={setBias} format={(v) => `${v.toFixed(1)} σ`} />}
          <button className="btn small" type="button" onClick={() => setSeed((s) => s + 1)}>
            New random data
          </button>
          <GroupTitle>Result</GroupTitle>
          <Readouts>
            <Readout k="Data subcarriers" v={`${d.car.length} of ${N}`} />
            <Readout k="Bits / symbol" v={effBits} />
            <Readout k="PAPR" v={`${dB(d.papr).toFixed(1)} dB`} />
            {variant === 'dco' && <Readout k="Clipped samples" v={`${d.clipped}`} tone={d.clipped ? 'warn' : 'good'} />}
            <Readout k="Signal / DC power" v={`${((d.acP / (d.meanP * d.meanP || 1)) * 100).toFixed(0)} %`} />
          </Readouts>
        </>
      }
      caption={
        <p>
          The IFFT of arbitrary QAM symbols is complex, but an LED needs a real signal. Placing the complex conjugate of each symbol on the mirror subcarrier
          (X[N−k] = X*[k]) makes the output real, at the cost of half the subcarriers. <strong>DCO-OFDM</strong> then adds a bias so the signal is mostly positive and
          clips the rest. <strong>ACO-OFDM</strong> loads only odd subcarriers: clipping the negative half then only adds distortion on even subcarriers, so no bias is
          needed and the data arrives at half amplitude. Lower the DCO bias and watch the constellation smear.
        </p>
      }
    >
      <Stage height={260} camera={[0.5, 1.8, 6.4]} target={[0, -0.6, -1.2]} bloom={0.7} hint="sinusoids of the first subcarriers and their sum">
        <ambientLight />
        <Stack comps={d.comps} sum={d.sumFine} N={N * 4} />
      </Stage>
      <div className="grid-2">
        <Plot
          title="Frequency domain: Re{X[k]} with Hermitian mirror"
          height={170}
          xLabel="subcarrier k"
          series={[
            { x: idx, y: d.full.map((p) => p.re), kind: 'stem', color: 'var(--c1)', size: 2.4 },
            { x: idx.map((v) => v + 0.3), y: d.full.map((p) => p.im), kind: 'stem', color: 'var(--c4)', size: 2.4 },
          ]}
          vlines={[{ x: N / 2, label: 'N/2', color: 'var(--text-3)' }]}
        />
        <Plot
          title="Received constellation"
          height={170}
          equalAspect
          x={[-1.8, 1.8]}
          y={[-1.6, 1.6]}
          series={[{ x: d.pts.map((p) => p.re), y: d.pts.map((p) => p.im), kind: 'scatter', color: 'var(--phosphor)', size: 1.4 }]}
        />
      </div>
      <Plot
        title="Time domain: bipolar IFFT output (grey) and what drives the LED (yellow)"
        height={170}
        series={[
          { x: idx, y: d.x, kind: 'step', color: 'var(--text-3)', width: 1.2, dash: [3, 3] },
          { x: idx, y: d.tx, kind: 'step', color: 'var(--phosphor)', width: 2 },
        ]}
        hlines={[{ y: 0, label: 'LED off', color: 'var(--bad)' }, ...(variant === 'dco' ? [{ y: bias * d.sigma, label: 'bias', color: 'var(--pump)' }] : [])]}
      />
    </Widget>
  );
}
