import { useEffect, useMemo, useRef, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { lambertianOrder, losGain } from '@/sim/lambertian';
import { inferno } from '@/three/colormap';
import { dB } from '@/sim/math';
import { useTheme } from '@/lib/theme';

/**
 * A LiFi attocell network seen from above: SINR map, frequency reuse, and a user walking through
 * the room with hysteresis-based handover and WiFi fallback in dead zones (Wu et al., COMST 2021).
 */
const ROOM = 10;
const RES = 70;

export default function AttocellLab() {
  const [spacing, setSpacing] = useState(2.5);
  const [semi, setSemi] = useState(40);
  const [reuse, setReuse] = useState<1 | 2 | 4>(1);
  const [hyst, setHyst] = useState(3);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { version } = useTheme();
  const [t, setT] = useState(0);

  const aps = useMemo(() => {
    const list: { x: number; y: number; c: number }[] = [];
    const n = Math.max(1, Math.floor(ROOM / spacing));
    const off = (ROOM - (n - 1) * spacing) / 2;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const c = reuse === 1 ? 0 : reuse === 2 ? (i + j) % 2 : (i % 2) * 2 + (j % 2);
      list.push({ x: off + i * spacing, y: off + j * spacing, c });
    }
    return list;
  }, [spacing, reuse]);

  const m = lambertianOrder(semi);
  const h = 2.25;
  const gainAt = (x: number, y: number, ap: { x: number; y: number }) =>
    losGain({ pos: [ap.x, ap.y, h], normal: [0, 0, -1], m }, { pos: [x, y, 0], normal: [0, 0, 1], area: 1e-4, fovDeg: 70 }).H;
  // SINR with electrical signal power ∝ (R H P)^2; noise sets a floor; interference from same-colour APs
  const noise = 1e-15; // relative noise floor in (A)^2 units given P=1 W, R=0.5
  const sinrAt = (x: number, y: number, serving: number) => {
    const g = aps.map((ap) => (0.5 * gainAt(x, y, ap)) ** 2);
    const s = g[serving];
    const i = g.reduce((acc, v, k) => (k !== serving && aps[k].c === aps[serving].c ? acc + v : acc), 0);
    return s / (i + noise * reuse) ; // narrower band per cell with reuse -> less noise per band, but rate / reuse
  };
  const bestAp = (x: number, y: number) => {
    let b = 0;
    let bv = -1;
    aps.forEach((ap, k) => {
      const v = gainAt(x, y, ap);
      if (v > bv) {
        bv = v;
        b = k;
      }
    });
    return b;
  };

  const map = useMemo(() => {
    const out = new Float32Array(RES * RES);
    for (let j = 0; j < RES; j++)
      for (let i = 0; i < RES; i++) {
        const x = ((i + 0.5) / RES) * ROOM;
        const y = ((j + 0.5) / RES) * ROOM;
        out[j * RES + i] = dB(sinrAt(x, y, bestAp(x, y)));
      }
    return out;
  }, [aps, m]); // eslint-disable-line react-hooks/exhaustive-deps

  // walking path: a lissajous loop through the room
  const path = (s: number) => [ROOM / 2 + 3.8 * Math.sin(2 * Math.PI * s), ROOM / 2 + 3.4 * Math.sin(4 * Math.PI * s + 0.6)] as [number, number];
  const walk = useMemo(() => {
    const steps = 400;
    let serving = bestAp(...path(0));
    let handovers = 0;
    let wifiTime = 0;
    const sinr: number[] = [];
    const serv: number[] = [];
    for (let k = 0; k <= steps; k++) {
      const [x, y] = path(k / steps);
      const cand = bestAp(x, y);
      if (cand !== serving) {
        const sNew = dB(sinrAt(x, y, cand));
        const sOld = dB(sinrAt(x, y, serving));
        if (sNew - sOld > hyst || !isFinite(sOld)) {
          serving = cand;
          handovers++;
        }
      }
      const v = dB(sinrAt(x, y, serving));
      if (!(v > 5)) wifiTime++;
      sinr.push(Math.max(-20, Math.min(70, v)));
      serv.push(serving);
    }
    return { sinr, serv, handovers, wifiShare: wifiTime / (steps + 1) };
  }, [aps, m, hyst]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      setT(((performance.now() - start) / 16000) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const W = c.clientWidth;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr;
    c.height = W * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = W / RES;
    for (let j = 0; j < RES; j++)
      for (let i = 0; i < RES; i++) {
        const v = map[j * RES + i];
        const tt = Math.max(0, Math.min(1, (v + 5) / 60));
        const [r, g, b] = inferno(isFinite(v) ? tt : 0);
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(i * cell, j * cell, cell + 0.6, cell + 0.6);
      }
    const S = W / ROOM;
    const palette = ['#5ad8ff', '#ff7aa8', '#9bff7a', '#c79bff'];
    aps.forEach((ap) => {
      ctx.beginPath();
      ctx.arc(ap.x * S, ap.y * S, 7, 0, Math.PI * 2);
      ctx.fillStyle = palette[ap.c];
      ctx.fill();
      ctx.strokeStyle = '#0b0d13';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    // path
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    for (let k = 0; k <= 200; k++) {
      const [x, y] = path(k / 200);
      if (k === 0) ctx.moveTo(x * S, y * S);
      else ctx.lineTo(x * S, y * S);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const k = Math.round(t * 400);
    const [ux, uy] = path(k / 400);
    const serving = walk.serv[k] ?? 0;
    const onWifi = !(walk.sinr[k] > 5);
    ctx.strokeStyle = onWifi ? '#ffb547' : '#ffffff';
    ctx.lineWidth = 2;
    if (!onWifi) {
      ctx.beginPath();
      ctx.moveTo(ux * S, uy * S);
      ctx.lineTo(aps[serving].x * S, aps[serving].y * S);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(ux * S, uy * S, 8, 0, Math.PI * 2);
    ctx.fillStyle = onWifi ? '#ffb547' : '#ffffff';
    ctx.fill();
    ctx.font = '12px JetBrains Mono, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(onWifi ? 'user · WiFi fallback' : `user · AP ${serving + 1}`, ux * S + 12, uy * S - 10);
  }, [map, aps, t, walk, version]);

  const k = Math.round(t * 400);
  const rateFactor = 1 / reuse;
  return (
    <Widget
      title="LiFi attocells: coverage, interference and handover"
      controls={
        <>
          <Slider label="Access-point spacing" value={spacing} min={1.5} max={5} step={0.1} onChange={setSpacing} format={(v) => `${v.toFixed(1)} m`} />
          <Slider label="LED semi-angle" value={semi} min={15} max={70} step={1} onChange={setSemi} format={(v) => `${v}°`} />
          <Segmented label="Frequency reuse" value={reuse} onChange={setReuse} options={[{ value: 1, label: '1 (full)' }, { value: 2, label: '2' }, { value: 4, label: '4' }]} />
          <Slider label="Handover hysteresis" value={hyst} min={0} max={10} step={0.5} onChange={setHyst} format={(v) => `${v} dB`} />
          <Readouts>
            <Readout k="Access points" v={aps.length} />
            <Readout k="Handovers / loop" v={walk.handovers} tone={walk.handovers > 30 ? 'warn' : undefined} />
            <Readout k="Time on WiFi" v={`${(walk.wifiShare * 100).toFixed(0)} %`} tone={walk.wifiShare > 0.2 ? 'bad' : walk.wifiShare > 0.05 ? 'warn' : 'good'} />
            <Readout k="Bandwidth per cell" v={`${(rateFactor * 100).toFixed(0)} %`} />
          </Readouts>
        </>
      }
      caption={
        <p>
          A top view of a 10 × 10 m floor. Colour is the downlink SINR from the strongest access point. With full reuse, every light uses the whole band and cell edges
          suffer interference; reuse 2 or 4 colours neighbours differently (dots) and clears the edges at the cost of bandwidth per cell. The walking user hands over
          when a neighbour is better by more than the hysteresis margin; too little hysteresis causes ping-pong handovers. Where SINR falls below 5 dB the user falls back
          to WiFi, the core idea of hybrid LiFi/WiFi networks.
        </p>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        <canvas ref={canvas} style={{ width: '100%', maxWidth: 460, aspectRatio: '1', borderRadius: 12, display: 'block', margin: '0 auto' }} aria-label="SINR map with access points and moving user" />
        <Plot
          title="SINR along the walk"
          height={150}
          y={[-20, 70]}
          yLabel="dB"
          series={[{ y: walk.sinr, color: 'var(--phosphor)', width: 1.6 }]}
          hlines={[{ y: 5, label: 'WiFi fallback', color: 'var(--warn)' }]}
          vlines={[{ x: k, color: 'var(--text-2)' }]}
        />
      </div>
    </Widget>
  );
}
