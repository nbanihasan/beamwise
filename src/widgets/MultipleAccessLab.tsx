import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Select, Slider, Widget } from '@/viz/controls';
import { rng } from '@/sim/math';
import { wavelengthToHex } from '@/sim/color';

/**
 * How several users share one optical access point. Each scheme is drawn as the resource it slices:
 * time, frequency (subcarriers), codes, space (beams), wavelength, power or contention.
 */
type Scheme = 'tdma' | 'fdma' | 'ofdma' | 'ocdma' | 'sdma' | 'wdma' | 'noma' | 'csma';
const USER_C = ['#8fa6ff', '#ffd27a', '#5ee0a8', '#ff86b0', '#c39bff', '#6fe0ff'];

const INFO: Record<Scheme, { label: string; slices: string; good: string; bad: string; where: string }> = {
  tdma: { label: 'TDMA: time slots', slices: 'time', good: 'Simple; one user at a time sees the full LED bandwidth.', bad: 'Needs tight synchronisation; each user idles most of the time.', where: '802.15.7 guaranteed time slots, G.9991 MAC cycles' },
  fdma: { label: 'FDMA: frequency bands', slices: 'frequency', good: 'No synchronisation between users; continuous transmission.', bad: 'Guard bands waste the scarce LED bandwidth; fixed per-user rate.', where: 'Early VLC broadcast, sub-carrier multiplexing' },
  ofdma: { label: 'OFDMA: subcarriers × time', slices: 'time and subcarriers', good: 'Flexible: each user gets the subcarriers where its channel is strongest, no guard bands.', bad: 'Needs DCO/ACO-OFDM (real, positive signal) and per-user feedback.', where: 'IEEE 802.11bb, ITU-T G.9991 (LiFi)' },
  ocdma: { label: 'OCDMA: optical codes', slices: 'codes', good: 'Asynchronous; all users transmit at once on the whole band.', bad: 'Unipolar on/off codes are not truly orthogonal: multiple-access interference grows with users; long codes cost bandwidth.', where: 'Optical orthogonal codes (Salehi), research VLC' },
  sdma: { label: 'SDMA: beams and cells', slices: 'space', good: 'Light does not pass walls and beams are narrow: the same spectrum is reused by every luminaire. Huge area capacity.', bad: 'Interference at cell edges; handover as users move.', where: 'LiFi attocells, angle-diversity receivers, beam-steered FSO' },
  wdma: { label: 'WDMA: colours', slices: 'wavelength', good: 'Each colour is an independent channel; RGB LEDs or laser diodes give 3–4 for free.', bad: 'Needs colour filters at every receiver; the mix must still look white.', where: 'RGB-LED VLC, multi-laser FSO and fibre' },
  noma: { label: 'NOMA: power levels', slices: 'power', good: 'Two users share the same time and frequency; the stronger user removes the weaker one\'s signal by successive interference cancellation (SIC).', bad: 'SIC errors propagate; needs good channel knowledge.', where: 'Research VLC downlinks (Marshoud et al.)' },
  csma: { label: 'CSMA/CA: contention', slices: 'contention', good: 'No scheduler; users listen and back off randomly.', bad: 'Collisions and hidden nodes (an uplink IR transmitter cannot see the others) waste airtime as users grow.', where: '802.15.7 contention access, Wi-Fi-style 802.11bb' },
};

const T = 16;
const F = 8;

function grid(s: Scheme, n: number, seed: number): (number | -1 | -2)[][] {
  const u = rng(seed);
  const g: (number | -1 | -2)[][] = Array.from({ length: F }, () => Array(T).fill(-1));
  for (let t = 0; t < T; t++)
    for (let f = 0; f < F; f++) {
      if (s === 'tdma') g[f][t] = t % n;
      else if (s === 'fdma') g[f][t] = Math.floor((f * n) / F) % n;
      else if (s === 'ofdma') {
        // each user wins the subcarriers where its (frequency-selective) channel is best, per frame of 4 slots
        const frame = Math.floor(t / 4);
        let best = 0;
        let bv = -1;
        for (let k = 0; k < n; k++) {
          const v = Math.sin(1.3 * f * (k + 1) + frame * 2.1 + k * 1.7) + 0.4 * Math.cos(f + frame * k);
          if (v > bv) { bv = v; best = k; }
        }
        g[f][t] = best;
      }
    }
  if (s === 'csma') {
    let t = 0;
    while (t < T) {
      const want = Array.from({ length: n }, () => u() < 0.55);
      const tx = want.map((w, k) => (w ? k : -1)).filter((k) => k >= 0);
      const backoff = Math.floor(u() * 2);
      t += backoff;
      if (t >= T) break;
      const len = 2 + Math.floor(u() * 2);
      const who = tx.length === 0 ? -1 : tx.length === 1 || u() < 0.55 ? tx[Math.floor(u() * tx.length)] : -2;
      for (let k = 0; k < len && t + k < T; k++) for (let f = 0; f < F; f++) g[f][t + k] = who;
      t += len;
    }
  }
  return g;
}

function GridView({ s, n, seed }: { s: Scheme; n: number; seed: number }) {
  const g = useMemo(() => grid(s, n, seed), [s, n, seed]);
  const cw = 40;
  const ch = 22;
  const used = g.flat().filter((v) => v >= 0).length / (T * F);
  return (
    <svg viewBox={`0 0 ${T * cw + 60} ${F * ch + 40}`} className="ma-svg" role="img" aria-label="Resource grid">
      {g.map((row, f) =>
        row.map((v, t) => {
          const guard = s === 'fdma' && n > 1 && (f * n) % F === F - 1 && f < F - 1;
          return (
            <rect key={`${f}-${t}`} x={50 + t * cw + 1} y={(F - 1 - f) * ch + 1 + (guard ? 6 : 0)} width={cw - 2} height={ch - 2 - (guard ? 6 : 0)} rx={3} fill={v === -2 ? 'var(--bad)' : v >= 0 ? USER_C[v] : 'var(--surface-2)'} opacity={v === -2 ? 0.75 : v >= 0 ? 0.85 : 1}>
              <title>{v === -2 ? 'collision' : v >= 0 ? `user ${v + 1}` : 'idle'}</title>
            </rect>
          );
        }),
      )}
      <text x={50} y={F * ch + 18} className="ma-l">
        time →
      </text>
      <text x={0} y={12} className="ma-l">
        freq
      </text>
      <text x={T * cw + 50} y={F * ch + 18} textAnchor="end" className="ma-l">
        {s === 'csma' ? `useful airtime ${(used * 100).toFixed(0)} %` : s === 'fdma' ? 'grey gaps = guard bands' : ''}
      </text>
    </svg>
  );
}

function OcdmaView({ n }: { n: number }) {
  // Length-13, weight-3 on/off codes. The first two form a (13,3,1) optical orthogonal code (cross-correlation ≤ 1);
  // a third user onward cannot be added without raising cross-correlation, which is exactly OCDMA's user limit.
  const codes = [
    [0, 1, 4],
    [0, 2, 8],
    [0, 3, 9],
    [0, 5, 11],
    [0, 6, 7],
    [0, 10, 12],
  ];
  const L = 13;
  const bits = [1, 0, 1, 1, 0, 1];
  const rows = codes.slice(0, n).map((c, k) => Array.from({ length: L * 2 }, (_, i) => (bits[(k + Math.floor(i / L)) % 6] && c.includes(i % L) ? 1 : 0)));
  const sum = Array.from({ length: L * 2 }, (_, i) => rows.reduce((a, r) => a + r[i], 0));
  const cw = 24;
  return (
    <svg viewBox={`0 0 ${L * 2 * cw + 70} ${(n + 2) * 24 + 30}`} className="ma-svg" role="img" aria-label="Optical CDMA chips">
      {rows.map((r, k) => (
        <g key={k} transform={`translate(64,${k * 24 + 4})`}>
          <text x={-60} y={14} className="ma-l">
            user {k + 1}
          </text>
          {r.map((v, i) => (
            <rect key={i} x={i * cw + 1} y={0} width={cw - 2} height={18} rx={2} fill={v ? USER_C[k] : 'var(--surface-2)'} />
          ))}
        </g>
      ))}
      <g transform={`translate(64,${n * 24 + 18})`}>
        <text x={-60} y={30} className="ma-l">
          received
        </text>
        {sum.map((v, i) => (
          <rect key={i} x={i * cw + 1} y={40 - v * 13} width={cw - 2} height={v * 13} rx={2} fill="var(--phosphor)" opacity={0.85} />
        ))}
        <line x1={0} x2={L * cw} y1={44} y2={44} stroke="var(--line-strong)" />
        <line x1={L * cw} x2={L * cw} y1={-n * 24 - 14} y2={44} stroke="var(--line-strong)" strokeDasharray="3 3" />
      </g>
    </svg>
  );
}

function SdmaView({ n }: { n: number }) {
  const leds = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => [120 + i * 160, 50 + j * 90] as [number, number]));
  const u = rng(11);
  const users = Array.from({ length: n }, () => [60 + u() * 440, 20 + u() * 220] as [number, number]);
  const serve = users.map(([x, y]) => leds.reduce((b, l, i) => (Math.hypot(l[0] - x, l[1] - y) < Math.hypot(leds[b][0] - x, leds[b][1] - y) ? i : b), 0));
  return (
    <svg viewBox="0 0 560 280" className="ma-svg" role="img" aria-label="Spatial reuse with attocells">
      <rect x={20} y={6} width={520} height={268} rx={10} fill="none" stroke="var(--line-strong)" />
      {leds.map(([x, y], i) => {
        const k = serve.indexOf(i);
        const multi = serve.filter((s) => s === i).length;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={72} fill={k >= 0 ? USER_C[k] : 'var(--surface)'} opacity={k >= 0 ? 0.16 : 1} stroke={k >= 0 ? USER_C[k] : 'var(--line)'} strokeDasharray="4 4" />
            <circle cx={x} cy={y} r={7} fill="var(--phosphor)" />
            {multi > 1 && (
              <text x={x} y={y - 12} textAnchor="middle" className="ma-l">
                shared by {multi}: TDMA inside
              </text>
            )}
          </g>
        );
      })}
      {users.map(([x, y], k) => (
        <g key={k}>
          <line x1={x} y1={y} x2={leds[serve[k]][0]} y2={leds[serve[k]][1]} stroke={USER_C[k]} strokeWidth={2} />
          <rect x={x - 8} y={y - 5} width={16} height={10} rx={2} fill={USER_C[k]} />
        </g>
      ))}
    </svg>
  );
}

function WdmaView({ n }: { n: number }) {
  const lams = [450, 520, 590, 635, 680, 405].slice(0, n);
  const x = Array.from({ length: 301 }, (_, i) => 380 + i);
  return (
    <Plot
      height={220}
      title="Each user on its own colour"
      xLabel="wavelength (nm)"
      yLabel="power"
      x={[380, 720]}
      y={[0, 1.1]}
      hideYTicks
      series={lams.map((l, k) => ({ x, y: x.map((w) => Math.exp(-(((w - l) / (l < 500 ? 11 : 9)) ** 2))), color: wavelengthToHex(l), kind: 'area' as const, label: `user ${k + 1}` }))}
      legend
    />
  );
}

function NomaView() {
  const [g2, setG2] = useState(-8); // weak user's channel gain relative to strong user (dB)
  const [a2, setA2] = useState(0.8); // fraction of power to weak user
  const snr = 30; // strong user's SNR, dB
  const s1 = 10 ** (snr / 10);
  const s2 = s1 * 10 ** (g2 / 10);
  const noma1 = Math.log2(1 + (1 - a2) * s1);
  const noma2 = Math.log2(1 + (a2 * s2) / ((1 - a2) * s2 + 1));
  const sweep = Array.from({ length: 50 }, (_, i) => 0.5 + (i / 49) * 0.49);
  const front = sweep.map((a) => [Math.log2(1 + (1 - a) * s1), Math.log2(1 + (a * s2) / ((1 - a) * s2 + 1))]);
  const oma = Array.from({ length: 50 }, (_, i) => {
    const t = i / 49;
    return [t * Math.log2(1 + s1), (1 - t) * Math.log2(1 + s2)];
  });
  return (
    <>
      <svg viewBox="0 0 560 120" className="ma-svg" role="img" aria-label="Superposed power levels">
        <rect x={20} y={20} width={300} height={a2 * 80} fill={USER_C[1]} opacity={0.85} />
        <rect x={20} y={20 + a2 * 80} width={300} height={(1 - a2) * 80} fill={USER_C[0]} opacity={0.85} />
        <text x={330} y={34} className="ma-l">
          weak user: more power, decoded first by both
        </text>
        <text x={330} y={92} className="ma-l">
          strong user: subtracts it (SIC), then decodes its own
        </text>
      </svg>
      <Plot
        height={200}
        title="Rate region: NOMA vs time sharing (OMA)"
        xLabel="strong user rate (b/s/Hz)"
        yLabel="weak user"
        legend
        series={[
          { x: oma.map((p) => p[0]), y: oma.map((p) => p[1]), color: 'var(--text-3)', dash: [5, 4], label: 'OMA (TDMA)' },
          { x: front.map((p) => p[0]), y: front.map((p) => p[1]), color: 'var(--c2)', width: 2, label: 'NOMA' },
        ]}
        points={[{ x: noma1, y: noma2, color: 'var(--phosphor)', r: 5 }]}
      />
      <div className="qk-ctl">
        <Slider label="Weak user's channel vs strong user" value={g2} min={-25} max={0} step={1} unit="dB" onChange={setG2} />
        <Slider label="Power share to weak user" value={a2} min={0.5} max={0.99} step={0.01} onChange={setA2} format={(v) => `${(v * 100).toFixed(0)} %`} />
      </div>
    </>
  );
}

export default function MultipleAccessLab() {
  const [s, setS] = useState<Scheme>('ofdma');
  const [n, setN] = useState(3);
  const [seed, setSeed] = useState(5);
  const info = INFO[s];
  return (
    <Widget
      title="Multiple access: sharing one beam of light"
      eyebrow="Interactive · MAC"
      controls={
        <>
          <Select label="Scheme" value={s} options={(Object.keys(INFO) as Scheme[]).map((k) => ({ value: k, label: INFO[k].label }))} onChange={setS} />
          {s !== 'noma' && <Slider label="Users" value={n} min={2} max={6} step={1} onChange={setN} />}
          {s === 'csma' && (
            <button type="button" className="btn small" onClick={() => setSeed(seed + 1)}>
              Run again
            </button>
          )}
          <Readouts>
            <Readout k="Slices" v={info.slices} />
          </Readouts>
          <p className="small muted" style={{ margin: 0 }}>
            <b>Used in:</b> {info.where}
          </p>
          <p className="small" style={{ margin: 0 }}>
            <b style={{ color: 'var(--good)' }}>+</b> {info.good}
          </p>
          <p className="small" style={{ margin: 0 }}>
            <b style={{ color: 'var(--bad)' }}>−</b> {info.bad}
          </p>
        </>
      }
      caption={<p>Every scheme answers one question: which slice of the resource does each user own? Real LiFi systems stack them, for example SDMA between luminaires, OFDMA inside each cell and WDMA across colours.</p>}
    >
      <div className="ma-legend">
        {(s === 'noma' ? [0, 1] : Array.from({ length: n }, (_, k) => k)).map((k) => (
          <span key={k}>
            <i style={{ background: USER_C[k] }} />
            {s === 'noma' ? (k ? 'weak user' : 'strong user') : `user ${k + 1}`}
          </span>
        ))}
        {s === 'csma' && (
          <span>
            <i style={{ background: 'var(--bad)' }} />
            collision
          </span>
        )}
      </div>
      {s === 'tdma' || s === 'fdma' || s === 'ofdma' || s === 'csma' ? (
        <GridView s={s} n={n} seed={seed} />
      ) : s === 'ocdma' ? (
        <OcdmaView n={n} />
      ) : s === 'sdma' ? (
        <SdmaView n={n} />
      ) : s === 'wdma' ? (
        <WdmaView n={n} />
      ) : (
        <NomaView />
      )}
    </Widget>
  );
}
