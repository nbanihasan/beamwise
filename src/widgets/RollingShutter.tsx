import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { ookLed, rollingShutterRows, stripeWidthRows, type RollingShutterParams } from '@/sim/camera';
import { prbs } from '@/sim/modulation';

/**
 * Rolling-shutter optical camera communication: rows are exposed one after another, so an LED
 * blinking faster than the frame rate is captured as bright and dark stripes within a single frame.
 */
const ROWS = 360;

function CameraScene({ rows, tex }: { rows: Float64Array; tex: THREE.CanvasTexture }) {
  const led = useRef<THREE.MeshStandardMaterial>(null);
  const scan = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const frac = (t * 0.35) % 1; // readout progress (slowed down)
    const r = Math.min(ROWS - 1, Math.floor(frac * ROWS));
    if (led.current) led.current.emissiveIntensity = rows[r] > 0.5 ? 7 : 0.4;
    if (scan.current) scan.current.position.y = 0.9 - frac * 1.8;
  });
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 5]} intensity={0.9} />
      {/* LED lamp */}
      <group position={[-2.3, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 0.12, 40]} />
          <meshStandardMaterial color="#2a2f3d" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <circleGeometry args={[0.42, 40]} />
          <meshStandardMaterial ref={led} color="#ffffff" emissive="#fff3d6" emissiveIntensity={6} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <Html position={[0, -0.85, 0]} center>
          <div className="scene-label">LED (flickers too fast to see)</div>
        </Html>
      </group>
      {/* camera body + lens */}
      <group position={[1.6, 0, 0]} rotation={[0, -0.8, 0]}>
        <mesh position={[0.35, 0, 0]}>
          <boxGeometry args={[0.5, 2.3, 2.3]} />
          <meshStandardMaterial color="#1a1e29" metalness={0.4} roughness={0.5} transparent opacity={0.6} />
        </mesh>
        <mesh position={[-0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.55, 0.65, 0.9, 40]} />
          <meshStandardMaterial color="#2b3040" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* live view of the sensor on the camera's back, facing away from the LED */}
        <mesh position={[0.62, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.8, 1.8]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
        <mesh ref={scan} position={[0.63, 0.9, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.86, 0.03]} />
          <meshBasicMaterial color="#5ad8ff" toneMapped={false} />
        </mesh>
        <Html position={[0.7, -1.4, 0]} center>
          <div className="scene-label">sensor image · rows read top → bottom</div>
        </Html>
      </group>
      <mesh position={[-0.85, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.55, 2.5, 32, 1, true]} />
        <meshBasicMaterial color="#fff1cc" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

export default function RollingShutter() {
  const [mode, setMode] = useState<'square' | 'ook'>('ook');
  const [freq, setFreq] = useState(2000); // Hz (square) or bit rate (OOK)
  const [rowUs, setRowUs] = useState(18);
  const [expUs, setExpUs] = useState(30);
  const bits = useMemo(() => prbs(64, 21), []);
  const p: RollingShutterParams = { rows: ROWS, rowTimeUs: rowUs, exposureUs: expUs, frameRate: 30 };
  const led = useMemo(() => (mode === 'square' ? (t: number) => (Math.floor(t * freq * 2) % 2 === 0 ? 1 : 0) : ookLed(bits, freq)), [mode, freq, bits]);
  const rows = useMemo(() => rollingShutterRows(led, p), [led, rowUs, expUs]); // eslint-disable-line react-hooks/exhaustive-deps

  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = ROWS;
    return c;
  }, []);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  const img = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // render the captured frame: LED disc region modulated by row intensity
    const draw = (cv: HTMLCanvasElement, w: number, h: number) => {
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#07080c';
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = h * 0.42;
      for (let y = 0; y < h; y++) {
        const r = Math.floor((y / h) * ROWS);
        const dy = y - cy;
        if (Math.abs(dy) > R) continue;
        const half = Math.sqrt(R * R - dy * dy);
        const v = rows[r];
        const lum = Math.round(25 + 230 * v);
        ctx.fillStyle = `rgb(${lum},${Math.round(lum * 0.96)},${Math.round(lum * 0.86)})`;
        ctx.fillRect(cx - half, y, half * 2, 1);
      }
    };
    draw(canvas, 256, ROWS);
    tex.needsUpdate = true;
    if (img.current) {
      img.current.width = 320;
      img.current.height = ROWS;
      draw(img.current, 320, ROWS);
    }
  }, [rows, canvas, tex]);

  const stripe = mode === 'square' ? stripeWidthRows(freq, rowUs) / 2 : 1 / (freq * rowUs * 1e-6);
  const bitsPerFrame = mode === 'ook' ? (ROWS * 0.84) / stripe : 0;
  const contrast = Math.max(...rows) - Math.min(...rows);
  return (
    <Widget
      title="Rolling shutter: turning a camera into a receiver"
      eyebrow="3D · optical camera communication"
      controls={
        <>
          <Segmented label="LED signal" value={mode} onChange={setMode} options={[{ value: 'square', label: 'Square wave' }, { value: 'ook', label: 'OOK data' }]} />
          <Slider label={mode === 'square' ? 'Flicker frequency' : 'Bit rate'} value={freq} min={200} max={20000} log onChange={setFreq} format={(v) => `${v < 1000 ? v.toFixed(0) : (v / 1000).toFixed(1) + 'k'}${mode === 'square' ? ' Hz' : ' b/s'}`} />
          <Slider label="Row readout time t_row" value={rowUs} min={5} max={60} step={0.5} onChange={setRowUs} format={(v) => `${v.toFixed(1)} µs`} />
          <Slider label="Exposure per row" value={expUs} min={5} max={1000} log onChange={setExpUs} format={(v) => `${v.toFixed(0)} µs`} />
          <Readouts>
            <Readout k="Rows per stripe" v={stripe.toFixed(1)} tone={stripe < 2 ? 'bad' : stripe < 4 ? 'warn' : 'good'} />
            <Readout k="Stripe contrast" v={`${(contrast * 100).toFixed(0)} %`} tone={contrast > 0.6 ? 'good' : contrast > 0.25 ? 'warn' : 'bad'} />
            {mode === 'ook' && <Readout k="Bits / frame (≈)" v={bitsPerFrame.toFixed(0)} />}
            {mode === 'ook' && <Readout k="Raw rate @ 30 fps" v={`${((bitsPerFrame * 30) / 1000).toFixed(1)} kb/s`} />}
          </Readouts>
        </>
      }
      caption={
        <p>
          In a CMOS rolling-shutter sensor each row starts its exposure t<sub>row</sub> after the previous one. An LED switching at f produces stripes 1/(f·t<sub>row</sub>)
          rows wide, so one photo holds a short burst of bits even though the camera runs at only 30 frames per second. Long exposures average over several bits and wash
          the stripes out, which is why OCC receivers lock the exposure short. This is the principle behind the IEEE 802.15.7-2018 OCC PHYs.
        </p>
      }
    >
      <Stage height={300} camera={[1.2, 1.4, 5.6]} target={[0, 0, 0]} bloom={0.8}>
        <CameraScene rows={rows} tex={tex} />
      </Stage>
      <div className="grid-2">
        <div>
          <div className="plot-title">
            <span>Captured frame</span>
          </div>
          <canvas ref={img} style={{ width: '100%', maxWidth: 320, height: 'auto', aspectRatio: `320 / ${ROWS}`, borderRadius: 10, display: 'block', border: '1px solid var(--line)' }} aria-label="Captured camera frame with stripes" />
        </div>
        <Plot title="Row intensity (what the decoder reads)" height={ROWS * 0.62} x={[0, 1.05]} y={[ROWS, 0]} xLabel="normalised intensity" series={[{ x: Array.from(rows), y: Array.from(rows, (_, i) => i), color: 'var(--phosphor)', width: 1.4 }]} />
      </div>
    </Widget>
  );
}
