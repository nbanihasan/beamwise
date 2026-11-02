import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Toggle, Widget } from '@/viz/controls';
import { hamming74Decode, hamming74Encode } from '@/arch/chain';
import { linspace, logFactorial, Q } from '@/sim/math';

/**
 * Error-correcting codes, hands-on. Left: Hamming(7,4) as three overlapping parity circles; flip any
 * received bit and the syndrome points at it. Right: decoded BER vs Eb/N0 for classic codes (exact or
 * union-bound formulas) and an illustrative waterfall for long LDPC / turbo / polar codes.
 */

// positions in the Venn diagram: [p1, p2, d1, p3, d2, d3, d4] (codeword order)
const SPOT: [number, number][] = [
  [92, 70], // p1: circle A only
  [208, 70], // p2: circle B only
  [150, 92], // d1: A∩B
  [150, 200], // p3: circle C only
  [112, 150], // d2: A∩C
  [188, 150], // d3: B∩C
  [150, 128], // d4: A∩B∩C
];
const NAMES = ['p₁', 'p₂', 'd₁', 'p₃', 'd₂', 'd₃', 'd₄'];
const PARITY = [0, 1, 3];

function HammingVenn() {
  const [data, setData] = useState([1, 0, 1, 1]);
  const [flips, setFlips] = useState<number[]>([]);
  const code = hamming74Encode(data);
  const rx = code.map((b, i) => (flips.includes(i) ? b ^ 1 : b));
  const s1 = rx[0] ^ rx[2] ^ rx[4] ^ rx[6];
  const s2 = rx[1] ^ rx[2] ^ rx[5] ^ rx[6];
  const s3 = rx[3] ^ rx[4] ^ rx[5] ^ rx[6];
  const syn = s1 + 2 * s2 + 4 * s3;
  const { bits: dec } = hamming74Decode(rx.slice());
  const ok = dec.every((b, i) => b === data[i]);
  const circles = [
    { cx: 120, cy: 100, c: 'var(--c1)', bad: s1, label: 'A: p₁ d₁ d₂ d₄' },
    { cx: 180, cy: 100, c: 'var(--c3)', bad: s2, label: 'B: p₂ d₁ d₃ d₄' },
    { cx: 150, cy: 152, c: 'var(--c5)', bad: s3, label: 'C: p₃ d₂ d₃ d₄' },
  ];
  return (
    <div className="fec-venn">
      <div className="fec-row">
        <span className="eyebrow">Data</span>
        {data.map((b, i) => (
          <button key={i} type="button" className={`fec-bit ${b ? 'one' : ''}`} onClick={() => (setData(data.map((x, k) => (k === i ? x ^ 1 : x))), setFlips([]))}>
            {b}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 300 250" role="img" aria-label="Hamming 7,4 Venn diagram" style={{ width: '100%', maxWidth: 380, display: 'block', margin: '0 auto' }}>
        {circles.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={78} fill={c.bad ? 'color-mix(in srgb, var(--bad) 14%, transparent)' : 'transparent'} stroke={c.bad ? 'var(--bad)' : c.c} strokeWidth={c.bad ? 2.4 : 1.4} />
        ))}
        {SPOT.map(([x, y], i) => {
          const flipped = flips.includes(i);
          const isFix = syn > 0 && syn - 1 === i;
          return (
            <g key={i} onClick={() => setFlips(flipped ? flips.filter((f) => f !== i) : [...flips, i])} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={15} fill={rx[i] ? 'var(--text)' : 'var(--surface-3)'} stroke={isFix ? 'var(--good)' : flipped ? 'var(--bad)' : PARITY.includes(i) ? 'var(--c2)' : 'var(--line-strong)'} strokeWidth={isFix || flipped ? 3 : 1.5} />
              <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontFamily="var(--font-mono)" fill={rx[i] ? 'var(--bg)' : 'var(--text)'}>
                {rx[i]}
              </text>
              <text x={x} y={y - 20} textAnchor="middle" fontSize="10" fill="var(--text-3)">
                {NAMES[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="fec-row small">
        <span>
          Syndrome <code>{`${s3}${s2}${s1}`}</code> → {syn === 0 ? 'no error detected' : `bit ${syn} (${NAMES[syn - 1]}) is wrong`}
        </span>
        <span className={ok ? 'good' : 'bad'}>{ok ? 'decoded correctly' : 'mis-corrected!'}</span>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Tap any bit in the diagram to flip it in the channel. Each circle must contain an even number of 1s; the circles that fail (red) intersect exactly at the wrong bit.
        Flip two bits and the decoder confidently "fixes" a third: Hamming codes correct one error, not two.
      </p>
    </div>
  );
}

// ---------- coded BER models ----------
const lnC = (n: number, k: number) => logFactorial(n) - logFactorial(k) - logFactorial(n - k);
function boundedDistance(n: number, t: number, ps: number) {
  // decoded symbol error rate ≈ (1/n) Σ_{i>t} i C(n,i) ps^i (1-ps)^(n-i)
  let s = 0;
  if (ps <= 0) return 0;
  for (let i = t + 1; i <= n; i++) s += i * Math.exp(lnC(n, i) + i * Math.log(ps) + (n - i) * Math.log1p(-ps));
  return Math.min(0.5, s / n);
}
const uncoded = (g: number) => Q(Math.sqrt(2 * g));
const hamming = (g: number) => boundedDistance(7, 1, Q(Math.sqrt(2 * (4 / 7) * g)));
function rs(n: number, k: number, m: number, g: number) {
  const p = Q(Math.sqrt(2 * (k / n) * g));
  const ps = 1 - Math.pow(1 - p, m);
  return boundedDistance(n, (n - k) / 2, ps) * (2 ** (m - 1) / (2 ** m - 1));
}
const CC_SPECTRUM: [number, number][] = [
  [10, 36],
  [12, 211],
  [14, 1404],
  [16, 11633],
  [18, 77433],
];
const conv = (g: number) => Math.min(0.5, CC_SPECTRUM.reduce((s, [d, c]) => s + c * Q(Math.sqrt(2 * 0.5 * d * g)), 0));
/** Illustrative steep waterfall for long iterative codes: BER = Q(k (Eb/N0[dB] − threshold)). */
const waterfall = (thrDb: number, k = 6) => (gdB: number) => Q(k * (gdB - thrDb)) * 0.5 + 1e-13;

const CODES = [
  { id: 'unc', label: 'Uncoded', color: 'var(--text-3)', f: (g: number) => uncoded(g) },
  { id: 'ham', label: 'Hamming (7,4), hard', color: 'var(--c6)', f: hamming },
  { id: 'rs15', label: 'RS (15,11), hard', color: 'var(--c5)', f: (g: number) => rs(15, 11, 4, g) },
  { id: 'rs255', label: 'RS (255,223), hard', color: 'var(--c4)', f: (g: number) => rs(255, 223, 8, g) },
  { id: 'cc', label: 'Conv. K=7 r=½, soft Viterbi', color: 'var(--c1)', f: conv },
];
const MODERN = [
  { id: 'turbo', label: 'Turbo r=½ (long, illustrative)', color: 'var(--c2)', thr: 0.0 },
  { id: 'ldpc', label: 'LDPC r=½ (long, illustrative)', color: 'var(--c3)', thr: 0.6 },
  { id: 'polar', label: 'Polar r=½, SCL (illustrative)', color: 'var(--warn)', thr: 1.4 },
];

function CodedBer({ showModern }: { showModern: boolean }) {
  const xs = linspace(-1, 12, 140);
  const series = useMemo(() => {
    const out = CODES.map((c) => ({ x: xs, y: xs.map((d) => Math.max(1e-12, c.f(10 ** (d / 10)))), color: c.color, label: c.label }));
    if (showModern) for (const m of MODERN) out.push({ x: xs, y: xs.map((d) => Math.max(1e-12, waterfall(m.thr)(d))), color: m.color, label: m.label, dash: [5, 4] } as never);
    return out;
  }, [showModern]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Plot
      title="Decoded bit error rate"
      series={series}
      xLabel="Eb/N0 (dB, BPSK-equivalent)"
      logY
      y={[1e-9, 0.5]}
      height={260}
      hlines={[{ y: 1e-6, color: 'var(--line-strong)', dash: [3, 3], label: '10⁻⁶' }]}
      vlines={[{ x: 0.19, color: 'var(--text-3)', dash: [2, 4], label: 'Shannon r=½' }]}
      legend
    />
  );
}

export default function FecLab() {
  const [modern, setModern] = useState(true);
  const at = (f: (g: number) => number) => {
    // Eb/N0 needed for 1e-6
    for (let d = -1; d < 16; d += 0.02) if (f(10 ** (d / 10)) < 1e-6) return d;
    return NaN;
  };
  const need = useMemo(() => CODES.map((c) => ({ label: c.label, db: at(c.f) })), []);
  const base = need[0].db;
  const controls = (
    <>
      <GroupTitle>Curves</GroupTitle>
      <Toggle label="Show modern codes" checked={modern} onChange={setModern} />
      <Readouts>
        {need.slice(1).map((n) => (
          <Readout key={n.label} k={`${n.label}: gain at 10⁻⁶`} v={`${(base - n.db).toFixed(1)} dB`} tone={base - n.db > 4 ? 'good' : undefined} />
        ))}
      </Readouts>
    </>
  );
  return (
    <Widget
      title="Encoders and decoders, hands-on"
      eyebrow="Interactive · coding"
      controls={controls}
      caption={
        <p>
          Solid curves are textbook formulas (bounded-distance decoding for Hamming and Reed–Solomon, union bound for the K=7 convolutional code). Dashed curves are an illustrative
          model of long-block iterative decoders, which operate within about 1 dB of the Shannon limit; exact positions depend on block length and decoder.
        </p>
      }
    >
      <div className="grid-2">
        <HammingVenn />
        <CodedBer showModern={modern} />
      </div>
    </Widget>
  );
}
