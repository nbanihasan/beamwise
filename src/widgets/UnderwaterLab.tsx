import { useEffect, useMemo, useRef, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { WATER_TYPES, beerLambert } from '@/sim/outdoor';
import { useTheme } from '@/lib/theme';

/** Pure-water absorption a(λ) [1/m], Pope & Fry (1997), coarse samples. */
const ABS: [number, number][] = [
  [400, 0.0066], [420, 0.0045], [440, 0.0064], [460, 0.0098], [480, 0.015], [500, 0.0257], [520, 0.0477], [540, 0.0507],
  [560, 0.0708], [580, 0.108], [600, 0.244], [620, 0.289], [640, 0.329], [660, 0.41], [680, 0.465], [700, 0.65],
];

export default function UnderwaterLab() {
  const [type, setType] = useState('clear');
  const [L, setL] = useState(20);
  const [txDbm, setTx] = useState(30);
  const [sensDbm, setSens] = useState(-40);
  const w = WATER_TYPES.find((x) => x.id === type)!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const { version } = useTheme();
  // received power with extinction plus geometric spreading of a 10-degree beam onto a 5 cm aperture
  const rx = (c: number, d: number) => {
    const spot = 0.01 + 2 * d * Math.tan((5 * Math.PI) / 180);
    const geo = Math.min(1, (0.05 / spot) ** 2);
    return txDbm + 10 * Math.log10(beerLambert(c, d) * geo + 1e-300);
  };
  const xs = useMemo(() => Array.from({ length: 200 }, (_, i) => 0.5 + i * 0.5), []);
  const range = xs.reduce((r, d) => (rx(w.c, d) >= sensDbm ? d : r), 0);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const W = c.clientWidth;
    const H = 90;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr;
    c.height = H * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, w.tint);
    g.addColorStop(1, '#04121c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // beam fading with Beer-Lambert over the drawn distance
    const maxD = 100;
    for (let x = 0; x < W; x += 2) {
      const d = (x / W) * maxD;
      const a = beerLambert(w.c, d);
      const spread = 6 + (x / W) * 26;
      const grad = ctx.createLinearGradient(0, H / 2 - spread, 0, H / 2 + spread);
      grad.addColorStop(0, 'rgba(90,216,255,0)');
      grad.addColorStop(0.5, `rgba(120,230,255,${Math.min(1, a * 0.95)})`);
      grad.addColorStop(1, 'rgba(90,216,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, H / 2 - spread, 2, spread * 2);
    }
    // scattering particles density ~ b
    const n = Math.round(w.b * 260);
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = 'rgba(220,240,255,0.5)';
    for (let i = 0; i < n; i++) ctx.fillRect(r() * W, r() * H, 1.4, 1.4);
    // range marker
    const xr = (Math.min(range, maxD) / maxD) * W;
    ctx.strokeStyle = '#ffcf6b';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(xr, 6);
    ctx.lineTo(xr, H - 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffcf6b';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(`max range ${range.toFixed(0)} m`, Math.min(W - 120, xr + 6), 16);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('0 m', 4, H - 6);
    ctx.fillText('100 m', W - 44, H - 6);
  }, [w, range, version]);

  return (
    <Widget
      title="Underwater optical links: the blue-green window"
      controls={
        <>
          <Segmented label="Water type" value={type} onChange={setType} options={WATER_TYPES.map((t) => ({ value: t.id, label: t.name }))} />
          <Slider label="Link distance" value={L} min={1} max={100} step={1} onChange={setL} format={(v) => `${v.toFixed(0)} m`} />
          <Slider label="Transmit power" value={txDbm} min={0} max={40} step={1} onChange={setTx} format={(v) => `${v.toFixed(0)} dBm (${(Math.pow(10, v / 10) / 1000).toPrecision(2)} W)`} />
          <Slider label="Receiver sensitivity" value={sensDbm} min={-70} max={-10} step={1} onChange={setSens} format={(v) => `${v} dBm`} />
          <Readouts>
            <Readout k="Extinction c" v={`${w.c} m⁻¹`} />
            <Readout k="Absorption / scattering" v={`${w.a} / ${w.b}`} />
            <Readout k={`Rx @ ${L} m`} v={`${rx(w.c, L).toFixed(1)} dBm`} tone={rx(w.c, L) >= sensDbm ? 'good' : 'bad'} />
            <Readout k="Max range" v={`${range.toFixed(0)} m`} />
          </Readouts>
        </>
      }
      caption={
        <p>
          Sea water absorbs red and infrared strongly but is most transparent around 450–550 nm, so UWOC uses blue-green LEDs and lasers. Power falls as
          e<sup>−c(λ)L</sup>, where the extinction coefficient c = a + b adds absorption and scattering. From pure sea water to a turbid harbour, c grows about forty-fold,
          and the usable range shrinks from around 100 m to a few metres.
        </p>
      }
    >
      <canvas ref={canvas} style={{ width: '100%', height: 90, borderRadius: 10, display: 'block' }} aria-label="Beam fading in water" />
      <div className="grid-2">
        <Plot
          title="Received power vs distance"
          height={200}
          xLabel="distance (m)"
          yLabel="dBm"
          y={[-90, txDbm + 2]}
          series={WATER_TYPES.map((t) => ({ x: xs, y: xs.map((d) => rx(t.c, d)), color: t.id === type ? 'var(--c6)' : 'var(--text-3)', width: t.id === type ? 2.4 : 1, alpha: t.id === type ? 1 : 0.5 }))}
          hlines={[{ y: sensDbm, label: 'sensitivity', color: 'var(--phosphor)' }]}
          vlines={[{ x: L }]}
        />
        <Plot
          title="Pure-water absorption a(λ)"
          height={200}
          logY
          xLabel="wavelength (nm)"
          yLabel="1/m"
          series={[{ x: ABS.map((a) => a[0]), y: ABS.map((a) => a[1]), color: 'var(--c6)', width: 2 }]}
          bands={[{ x0: 440, x1: 550, color: 'var(--pump-soft)', label: 'blue-green window' }]}
        />
      </div>
    </Widget>
  );
}
