import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { Readout, Readouts, Slider, Widget } from '@/viz/controls';
import { losGain } from '@/sim/lambertian';
import { rssToDistance, trilaterate } from '@/sim/positioning';
import { gaussian, rng } from '@/sim/math';

/** RSS-based visible light positioning with trilateration; drag the receiver. */
const ROOM = 5;
const LEDS: [number, number][] = [
  [1.25, 1.25],
  [1.25, 3.75],
  [3.75, 1.25],
  [3.75, 3.75],
];
const S = 80; // px per metre
const PAD = 24;

export default function PositioningLab() {
  const [pos, setPos] = useState<[number, number]>([2.1, 3.0]);
  const [noiseDb, setNoise] = useState(0.5);
  const [hErr, setHErr] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const h = 2.15;
  const m = 1;
  const A = 1e-4;

  const est = useMemo(() => {
    const g = gaussian(rng(Math.round(pos[0] * 100 + pos[1] * 7)));
    const trial = () => {
      const r = LEDS.map(([x, y]) => {
        const H = losGain({ pos: [x, y, h], normal: [0, 0, -1], m }, { pos: [pos[0], pos[1], 0], normal: [0, 0, 1], area: A, fovDeg: 90 }).H;
        const Pr = H * Math.pow(10, (noiseDb * g()) / 10);
        const hAssumed = h + hErr;
        const d = rssToDistance(Pr, 1, m, A, hAssumed);
        return Math.sqrt(Math.max(0, d * d - hAssumed * hAssumed));
      });
      return { r, p: trilaterate(LEDS, r) };
    };
    const first = trial();
    const cloud = Array.from({ length: 150 }, () => trial().p);
    const errs = cloud.map(([x, y]) => Math.hypot(x - pos[0], y - pos[1])).sort((a, b) => a - b);
    return { ...first, cloud, med: errs[Math.floor(errs.length / 2)], p90: errs[Math.floor(errs.length * 0.9)] };
  }, [pos, noiseDb, hErr]);

  const toWorld = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const sx = (ROOM * S + 2 * PAD) / r.width;
    const x = ((e.clientX - r.left) * sx - PAD) / S;
    const y = ((e.clientY - r.top) * sx - PAD) / S;
    setPos([Math.min(ROOM - 0.05, Math.max(0.05, x)), Math.min(ROOM - 0.05, Math.max(0.05, y))]);
  };
  const dragging = useRef(false);
  const X = (v: number) => PAD + v * S;
  const err = Math.hypot(est.p[0] - pos[0], est.p[1] - pos[1]);

  return (
    <Widget
      title="Visible light positioning by trilateration"
      controls={
        <>
          <Slider label="RSS measurement noise" value={noiseDb} min={0} max={3} step={0.05} onChange={setNoise} format={(v) => `${v.toFixed(2)} dB`} />
          <Slider label="Error in assumed height" value={hErr} min={-0.3} max={0.3} step={0.01} onChange={setHErr} format={(v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)} cm`} />
          <Readouts>
            <Readout k="This estimate" v={`${(err * 100).toFixed(1)} cm`} tone={err < 0.1 ? 'good' : err < 0.3 ? 'warn' : 'bad'} />
            <Readout k="Median error" v={`${(est.med * 100).toFixed(1)} cm`} />
            <Readout k="90th percentile" v={`${(est.p90 * 100).toFixed(1)} cm`} />
          </Readouts>
          <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>
            Drag the receiver (white) around the room.
          </p>
        </>
      }
      caption={
        <p>
          Each luminaire broadcasts its ID. The receiver measures each one's received power, inverts the Lambertian model to get a distance, and the circles' intersection
          gives its position by linear least squares. Small dB errors in power become centimetre errors in range, and they are worst near the walls, where the geometry
          is poor. The faint cloud shows 150 noisy repeats.
        </p>
      }
    >
      <svg
        ref={svg}
        viewBox={`0 0 ${ROOM * S + 2 * PAD} ${ROOM * S + 2 * PAD}`}
        style={{ width: '100%', maxWidth: 460, display: 'block', margin: '0 auto', touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          toWorld(e);
        }}
        onPointerMove={(e) => dragging.current && toWorld(e)}
        onPointerUp={() => (dragging.current = false)}
        role="img"
        aria-label="Top view of the room with LEDs, range circles and position estimate"
      >
        <rect x={PAD} y={PAD} width={ROOM * S} height={ROOM * S} fill="var(--bg-2)" stroke="var(--line-strong)" rx={8} />
        {[1, 2, 3, 4].map((v) => (
          <g key={v}>
            <line x1={X(v)} x2={X(v)} y1={PAD} y2={PAD + ROOM * S} stroke="var(--plot-grid)" />
            <line y1={X(v)} y2={X(v)} x1={PAD} x2={PAD + ROOM * S} stroke="var(--plot-grid)" />
          </g>
        ))}
        {est.cloud.map(([x, y], i) => (
          <circle key={i} cx={X(x)} cy={X(y)} r={2} fill="var(--c4)" opacity={0.35} />
        ))}
        {LEDS.map(([x, y], i) => (
          <g key={i}>
            <circle cx={X(x)} cy={X(y)} r={Math.max(0, est.r[i]) * S} fill="none" stroke="var(--phosphor)" strokeOpacity={0.55} strokeDasharray="5 4" />
            <rect x={X(x) - 9} y={X(y) - 9} width={18} height={18} rx={4} fill="var(--phosphor)" />
            <text x={X(x)} y={X(y) - 14} textAnchor="middle" fontSize={11} fill="var(--text-2)" fontFamily="var(--font-mono)">
              ID {i + 1}
            </text>
          </g>
        ))}
        <line x1={X(pos[0])} y1={X(pos[1])} x2={X(est.p[0])} y2={X(est.p[1])} stroke="var(--c4)" strokeWidth={1.5} />
        <circle cx={X(est.p[0])} cy={X(est.p[1])} r={7} fill="none" stroke="var(--c4)" strokeWidth={2.5} />
        <circle cx={X(pos[0])} cy={X(pos[1])} r={8} fill="var(--text)" stroke="var(--bg)" strokeWidth={2} />
        <text x={X(pos[0]) + 12} y={X(pos[1]) + 4} fontSize={11} fill="var(--text)" fontFamily="var(--font-mono)">
          true
        </text>
        <text x={X(est.p[0]) + 12} y={X(est.p[1]) + 16} fontSize={11} fill="var(--c4)" fontFamily="var(--font-mono)">
          estimate
        </text>
      </svg>
    </Widget>
  );
}
