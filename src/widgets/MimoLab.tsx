import { useMemo, useState } from 'react';
import { Html, Line } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { losGain } from '@/sim/lambertian';
import { singularValues } from '@/sim/math';

/**
 * Optical MIMO: the channel matrix between an LED array and a detector array.
 * Non-imaging receivers see every LED almost equally (ill-conditioned H); an imaging lens maps each LED
 * onto its own pixel, making H nearly diagonal (Zeng et al., JSAC 2009; Fath & Haas, TCOM 2013).
 */
export default function MimoLab() {
  const [n, setN] = useState<2 | 4>(4);
  const [ledSp, setLedSp] = useState(1.2);
  const [pdSp, setPdSp] = useState(0.1);
  const [rxType, setRx] = useState<'nonimaging' | 'imaging'>('nonimaging');
  const [snrDb, setSnr] = useState(30);
  const h = 2.2;

  const { leds, pds, H } = useMemo(() => {
    const side = n === 4 ? 2 : 2;
    const grid = (sp: number, z: number, count: number) =>
      Array.from({ length: count }, (_, i) => {
        const ix = n === 4 ? i % side : i;
        const iy = n === 4 ? Math.floor(i / side) : 0;
        const ox = n === 4 ? (side - 1) / 2 : (count - 1) / 2;
        return [(ix - ox) * sp, (iy - (n === 4 ? (side - 1) / 2 : 0)) * sp, z] as [number, number, number];
      });
    const L = grid(ledSp, h, n);
    const P = grid(pdSp, 0, n);
    let Hm: number[][];
    if (rxType === 'nonimaging') {
      Hm = P.map((p) => L.map((l) => losGain({ pos: l, normal: [0, 0, -1], m: 1 }, { pos: p, normal: [0, 0, 1], area: 1e-4, fovDeg: 60 }).H));
    } else {
      // imaging receiver: lens (focal f) images LED i to point -f/h * position; pixel pitch = pdSp/2
      const f = 0.004;
      const pitch = (ledSp * f) / h; // pixels laid out to match the nominal LED image grid
      Hm = P.map((_, j) => {
        const pj = grid(pitch, 0, n)[j];
        return L.map((l) => {
          const ix = (-f / h) * l[0];
          const iy = (-f / h) * l[1];
          const dx = (ix + pj[0]) / pitch;
          const dy = (iy + pj[1]) / pitch;
          const spot = 0.35; // optical blur radius, in pixels
          const overlap = Math.exp(-(dx * dx + dy * dy) / (2 * spot * spot));
          return overlap * 3e-5;
        });
      });
    }
    return { leds: L, pds: P, H: Hm };
  }, [n, ledSp, pdSp, rxType]);

  const sv = singularValues(H);
  const cond = sv[0] / Math.max(sv[sv.length - 1], 1e-30);
  const scale = Math.max(...H.flat(), 1e-30);
  const snr = Math.pow(10, snrDb / 10);
  // equal-power capacity, normalised so the strongest SISO link has the given SNR
  const cap = sv.reduce((s, v) => s + Math.log2(1 + (snr / n) * (v / scale) ** 2), 0);
  const siso = Math.log2(1 + snr);
  const maxH = scale;

  return (
    <Widget
      title="Optical MIMO: can the receiver tell the LEDs apart?"
      eyebrow="3D · channel matrix"
      controls={
        <>
          <Segmented label="Array size" value={n} onChange={setN} options={[{ value: 2, label: '2 × 2' }, { value: 4, label: '4 × 4' }]} />
          <Segmented label="Receiver" value={rxType} onChange={setRx} options={[{ value: 'nonimaging', label: 'Non-imaging PDs' }, { value: 'imaging', label: 'Imaging (lens)' }]} />
          <Slider label="LED spacing" value={ledSp} min={0.2} max={2.5} step={0.05} onChange={setLedSp} format={(v) => `${v.toFixed(2)} m`} />
          {rxType === 'nonimaging' && <Slider label="PD spacing" value={pdSp} min={0.01} max={1} log onChange={setPdSp} format={(v) => `${(v * 100).toFixed(1)} cm`} />}
          <Slider label="SNR" value={snrDb} min={0} max={50} step={1} onChange={setSnr} format={(v) => `${v} dB`} />
          <Readouts>
            <Readout k="Condition number" v={`${(20 * Math.log10(cond)).toFixed(1)} dB`} tone={cond < 3 ? 'good' : cond < 30 ? 'warn' : 'bad'} />
            <Readout k="MIMO capacity" v={`${cap.toFixed(1)} b/s/Hz`} />
            <Readout k="SISO capacity" v={`${siso.toFixed(1)} b/s/Hz`} />
            <Readout k="Gain" v={`${(cap / siso).toFixed(2)}×`} tone={cap / siso > 1.5 ? 'good' : 'warn'} />
          </Readouts>
        </>
      }
      caption={
        <p>
          With intensity modulation there is no phase, so the paths from different LEDs to closely spaced detectors look almost identical: H is nearly rank-one, its
          condition number explodes, and zero-forcing would amplify noise enormously. Spreading the detectors helps a little. An imaging receiver helps a lot: the lens
          maps each LED onto different pixels, making H almost diagonal and capacity grows nearly linearly with the number of streams.
        </p>
      }
    >
      <Stage height={320} camera={[3.6, 3.2, 4.6]} target={[0, 1, 0]} bloom={0.9}>
        <ambientLight intensity={0.5} />
        {leds.map((l, i) => (
          <mesh key={`l${i}`} position={[l[0], l[2], l[1]]}>
            <boxGeometry args={[0.32, 0.04, 0.32]} />
            <meshStandardMaterial color="#fff" emissive={['#ff6b6b', '#6bff9e', '#6ba8ff', '#ffd36b'][i]} emissiveIntensity={2.6} toneMapped={false} />
          </mesh>
        ))}
        {pds.map((p, j) => (
          <mesh key={`p${j}`} position={[rxType === 'imaging' ? p[0] * 0.02 / Math.max(pdSp, 0.01) : p[0], 0.02, rxType === 'imaging' ? p[1] * 0.02 / Math.max(pdSp, 0.01) : p[1]]}>
            <boxGeometry args={[0.06, 0.03, 0.06]} />
            <meshStandardMaterial color="#5ad8ff" emissive="#5ad8ff" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        ))}
        {rxType === 'imaging' && (
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.1, 24, 12]} />
            <meshPhysicalMaterial color="#cfe6ff" transmission={0.8} transparent opacity={0.5} roughness={0.05} />
          </mesh>
        )}
        {H.map((row, j) =>
          row.map((g, i) => {
            const p = pds[j];
            const px = rxType === 'imaging' ? (p[0] * 0.02) / Math.max(pdSp, 0.01) : p[0];
            const pz = rxType === 'imaging' ? (p[1] * 0.02) / Math.max(pdSp, 0.01) : p[1];
            const w = g / maxH;
            return (
              <Line
                key={`${i}-${j}`}
                points={[
                  [leds[i][0], leds[i][2], leds[i][1]],
                  [px, 0.03, pz],
                ]}
                color={['#ff6b6b', '#6bff9e', '#6ba8ff', '#ffd36b'][i]}
                lineWidth={0.5 + 2.5 * w}
                transparent
                opacity={0.08 + 0.85 * w}
              />
            );
          }),
        )}
        <Html position={[0, -0.25, 0]} center>
          <div className="scene-label">{rxType === 'imaging' ? 'lens + pixel array' : 'photodiode array'}</div>
        </Html>
      </Stage>
      <div>
        <div className="plot-title">
          <span>Channel matrix |H| (rows: detectors · columns: LEDs)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 4, maxWidth: 360 }}>
          {H.flat().map((g, k) => {
            const t = g / maxH;
            return (
              <div
                key={k}
                className="mono"
                style={{
                  aspectRatio: '1.6',
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '0.7rem',
                  background: `color-mix(in srgb, var(--phosphor) ${Math.round(t * 85)}%, var(--surface-2))`,
                  color: t > 0.55 ? 'var(--phosphor-ink)' : 'var(--text-2)',
                }}
              >
                {t.toFixed(2)}
              </div>
            );
          })}
        </div>
      </div>
    </Widget>
  );
}
