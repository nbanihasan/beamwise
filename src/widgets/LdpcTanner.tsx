import { useMemo, useState } from 'react';
import { Readout, Readouts, Segmented, Widget } from '@/viz/controls';

/**
 * A toy LDPC code on its Tanner graph. Columns of H are the 10 edges of the complete graph K5, so every
 * bit takes part in exactly 2 checks and every check sees 4 bits: a (10,6) regular, low-density code.
 * Decode with Gallager bit flipping (hard) or min-sum belief propagation (soft) and watch the checks clear.
 */
const CHECKS = 5;
const EDGES: [number, number][] = [];
for (let a = 0; a < CHECKS; a++) for (let b = a + 1; b < CHECKS; b++) EDGES.push([a, b]);
const N = EDGES.length; // 10 bits
const H: number[][] = Array.from({ length: CHECKS }, (_, c) => EDGES.map(([a, b]) => (a === c || b === c ? 1 : 0)));
const bitsOf = (c: number) => EDGES.map((e, i) => (e[0] === c || e[1] === c ? i : -1)).filter((i) => i >= 0);
const checksOf = (v: number) => EDGES[v];

/** A valid codeword: bits on the edges of a cycle (every vertex touches an even number of them). */
const CODEWORD = (() => {
  const cyc = [0, 1, 3, 2]; // cycle 0-1-3-2-0 in K5
  const w = Array(N).fill(0);
  for (let i = 0; i < cyc.length; i++) {
    const a = Math.min(cyc[i], cyc[(i + 1) % cyc.length]);
    const b = Math.max(cyc[i], cyc[(i + 1) % cyc.length]);
    w[EDGES.findIndex((e) => e[0] === a && e[1] === b)] = 1;
  }
  return w;
})();

const syndrome = (x: number[]) => H.map((row) => row.reduce((s, h, i) => s ^ (h & x[i]), 0));

interface Step {
  x: number[];
  llr?: number[];
  flipped: number[];
}

function bitFlipSteps(r: number[], maxIt = 8): Step[] {
  const steps: Step[] = [{ x: r.slice(), flipped: [] }];
  let x = r.slice();
  for (let it = 0; it < maxIt; it++) {
    const s = syndrome(x);
    if (s.every((v) => v === 0)) break;
    const votes = x.map((_, v) => checksOf(v).filter((c) => s[c]).length);
    const m = Math.max(...votes);
    const flip = votes.map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0);
    x = x.map((b, i) => (flip.includes(i) ? 1 - b : b));
    steps.push({ x: x.slice(), flipped: flip });
  }
  return steps;
}

/** Min-sum BP. Channel LLR: +|L| means "probably 0". Errored bits get a weak wrong LLR. */
function minSumSteps(r: number[], conf: number[], maxIt = 8): Step[] {
  const Lch = r.map((b, i) => (b ? -1 : 1) * conf[i]);
  const q: number[][] = H.map((row) => row.map((h, i) => (h ? Lch[i] : 0)));
  const steps: Step[] = [{ x: r.slice(), llr: Lch.slice(), flipped: [] }];
  for (let it = 0; it < maxIt; it++) {
    const rmsg: number[][] = H.map(() => Array(N).fill(0));
    for (let c = 0; c < CHECKS; c++) {
      const vs = bitsOf(c);
      for (const v of vs) {
        let sign = 1;
        let mn = Infinity;
        for (const u of vs) if (u !== v) { sign *= Math.sign(q[c][u]) || 1; mn = Math.min(mn, Math.abs(q[c][u])); }
        rmsg[c][v] = 0.8 * sign * mn; // normalised min-sum
      }
    }
    const post = Lch.map((l, v) => l + checksOf(v).reduce((s, c) => s + rmsg[c][v], 0));
    for (let c = 0; c < CHECKS; c++) for (const v of bitsOf(c)) q[c][v] = post[v] - rmsg[c][v];
    const prev = steps[steps.length - 1].x;
    const x = post.map((l) => (l < 0 ? 1 : 0));
    steps.push({ x, llr: post, flipped: x.map((b, i) => (b !== prev[i] ? i : -1)).filter((i) => i >= 0) });
    if (syndrome(x).every((v) => v === 0)) break;
  }
  return steps;
}

export default function LdpcTanner() {
  const [errs, setErrs] = useState<number[]>([4]);
  const [mode, setMode] = useState<'flip' | 'bp'>('flip');
  const [k, setK] = useState(0);
  const r = CODEWORD.map((b, i) => (errs.includes(i) ? 1 - b : b));
  // soft confidence: errored bits are "unsure" (weak), others confident
  const conf = r.map((_, i) => (errs.includes(i) ? 0.6 : 1.4 + 0.25 * (i % 3)));
  const steps = useMemo(() => (mode === 'flip' ? bitFlipSteps(r) : minSumSteps(r, conf)), [mode, errs.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = steps[Math.min(k, steps.length - 1)];
  const s = syndrome(step.x);
  const ok = s.every((v) => v === 0);
  const correct = step.x.every((b, i) => b === CODEWORD[i]);
  const last = k >= steps.length - 1;

  const W = 720;
  const cx = (c: number) => 120 + c * 120;
  const vx = (v: number) => 36 + v * 72;
  const toggle = (v: number) => {
    setErrs(errs.includes(v) ? errs.filter((e) => e !== v) : [...errs, v]);
    setK(0);
  };

  return (
    <Widget
      title="LDPC decoding on a Tanner graph"
      eyebrow="Interactive · iterative decoding"
      controls={
        <>
          <Segmented label="Decoder" value={mode} options={[{ value: 'flip', label: 'Bit flipping (hard)' }, { value: 'bp', label: 'Min-sum BP (soft)' }]} onChange={(m) => { setMode(m); setK(0); }} />
          <div className="ctl-row" style={{ gap: 8, display: 'flex', flexWrap: 'wrap' }}>
            <button type="button" className="btn small" onClick={() => setK(0)} disabled={k === 0}>
              Reset
            </button>
            <button type="button" className="btn small primary" onClick={() => setK(k + 1)} disabled={last}>
              Iterate
            </button>
          </div>
          <Readouts>
            <Readout k="Errors injected" v={errs.length} />
            <Readout k="Iteration" v={`${Math.min(k, steps.length - 1)} / ${steps.length - 1}`} />
            <Readout k="Unsatisfied checks" v={s.reduce((a, b) => a + b, 0)} tone={ok ? 'good' : 'bad'} />
            <Readout k="Result" v={!ok ? 'decoding…' : correct ? 'corrected' : 'wrong codeword!'} tone={!ok ? 'warn' : correct ? 'good' : 'bad'} />
          </Readouts>
        </>
      }
      caption={
        <p>
          Bits (circles, bottom) connect to the parity checks (squares, top) they take part in. Click bits to inject errors, then press <b>Iterate</b>. A red check is unsatisfied. Bit flipping flips
          whichever bits sit in the most red checks; min-sum passes soft beliefs (bar height) along the edges until every check is satisfied. One error is always fixed; with two or three, the hard decoder
          often stalls or lands on the wrong codeword, while soft decoding, helped by the channel's confidence, usually recovers. Real LDPC codes use thousands of bits and the same rule.
        </p>
      }
    >
      <svg viewBox={`0 0 ${W} 312`} className="ldpc-svg" role="img" aria-label="Tanner graph">
        {EDGES.map(([a, b], v) =>
          [a, b].map((c) => (
            <line key={`${v}-${c}`} x1={vx(v)} y1={230} x2={cx(c)} y2={56} stroke={s[c] ? 'var(--bad)' : 'var(--line-strong)'} strokeOpacity={s[c] ? 0.75 : 1} strokeWidth={s[c] ? 1.6 : 1} />
          )),
        )}
        {Array.from({ length: CHECKS }, (_, c) => (
          <g key={c} transform={`translate(${cx(c)},56)`}>
            <rect x={-17} y={-17} width={34} height={34} rx={7} fill={s[c] ? 'rgba(255,111,134,0.18)' : 'rgba(94,224,168,0.14)'} stroke={s[c] ? 'var(--bad)' : 'var(--good)'} strokeWidth={1.6} />
            <text y={5} textAnchor="middle" className="ldpc-t">
              ⊕
            </text>
            <text y={-26} textAnchor="middle" className="ldpc-l">
              c{c + 1}
            </text>
          </g>
        ))}
        {step.x.map((b, v) => {
          const wrong = b !== CODEWORD[v];
          const llr = step.llr?.[v];
          return (
            <g key={v} transform={`translate(${vx(v)},230)`} onClick={() => toggle(v)} style={{ cursor: 'pointer' }}>
              {step.flipped.includes(v) && <circle r={25} fill="none" stroke="var(--phosphor)" strokeDasharray="3 3" />}
              <circle r={17} fill={b ? 'var(--phosphor)' : 'var(--solid)'} stroke={wrong ? 'var(--bad)' : 'var(--line-strong)'} strokeWidth={wrong ? 2.4 : 1.2} />
              <text y={5} textAnchor="middle" className="ldpc-t" style={{ fill: b ? 'var(--phosphor-ink)' : 'var(--text)' }}>
                {b}
              </text>
              {llr !== undefined && <rect x={-5} y={llr > 0 ? 24 : 24} width={10} height={Math.min(36, Math.abs(llr) * 8)} rx={2} fill={llr > 0 ? 'var(--c1)' : 'var(--c2)'} opacity={0.8} />}
              <text y={llr !== undefined ? 70 : 38} textAnchor="middle" className="ldpc-l">
                v{v + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </Widget>
  );
}
