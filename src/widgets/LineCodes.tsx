import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Widget } from '@/viz/controls';
import { rng } from '@/sim/math';

/**
 * Line codes (run-length-limited codes) drawn from your own bits: NRZ, RZ, Manchester,
 * differential Manchester, Miller, a constant-weight 4B6B and variable PPM for dimming.
 * Each half-bit is one "chip"; the figure shows the light level chip by chip.
 */
type Code = 'nrz' | 'nrzi' | 'rz' | 'manchester' | 'diffman' | 'miller' | '4b6b' | 'vppm';

/** The 20 six-bit words with exactly three ones; the first 16 carry 4 data bits (constant brightness, max run 4). */
const CW6: number[][] = (() => {
  const out: number[][] = [];
  for (let v = 0; v < 64; v++) {
    const b = Array.from({ length: 6 }, (_, i) => (v >> (5 - i)) & 1);
    const ones = b.reduce((a, x) => a + x, 0);
    // three ones, and avoid words starting or ending in a run of three, to keep long runs short across words
    if (ones === 3 && !/^(000|111)|(000|111)$/.test(b.join(''))) out.push(b);
  }
  return out.slice(0, 16);
})();

interface CodeDef {
  label: string;
  /** chips per data bit (may be fractional, e.g. 6/4) */
  chipsPerBit: number;
  encode: (bits: number[], duty?: number) => number[];
  note: string;
}

const CODES: Record<Code, CodeDef> = {
  nrz: { label: 'NRZ-L', chipsPerBit: 1, encode: (b) => b.slice(), note: 'Light on for 1, off for 0. Narrowest spectrum, but long runs leave the receiver blind to the clock and make the lamp brightness depend on the data (visible flicker).' },
  nrzi: { label: 'NRZ-I', chipsPerBit: 1, encode: (b) => { let s = 0; return b.map((x) => (s ^= x)); }, note: 'A 1 toggles the level, a 0 keeps it. Immune to inverted wiring; runs of zeros still have no transitions.' },
  rz: { label: 'RZ', chipsPerBit: 2, encode: (b) => b.flatMap((x) => [x, 0]), note: 'A 1 is a half-width pulse. Twice the bandwidth of NRZ and half the average power; long runs of zeros still lose the clock.' },
  manchester: { label: 'Manchester', chipsPerBit: 2, encode: (b) => b.flatMap((x) => (x ? [0, 1] : [1, 0])), note: 'Every bit has a mid-bit transition (IEEE 802.3 convention: 1 = low→high). Exactly 50 % brightness, no flicker, clock in every bit; costs twice the bandwidth. IEEE 802.15.7 PHY I uses it for OOK.' },
  diffman: { label: 'Diff. Manchester', chipsPerBit: 2, encode: (b) => { let s = 1; const out: number[] = []; for (const x of b) { if (!x) s ^= 1; out.push(s); s ^= 1; out.push(s); } return out; }, note: 'Always a mid-bit transition; a 0 adds a transition at the bit start. Polarity-insensitive, still DC-balanced.' },
  miller: { label: 'Miller', chipsPerBit: 2, encode: (b) => { let s = 0; const out: number[] = []; let prev = 1; for (const x of b) { if (x) { out.push(s); s ^= 1; out.push(s); } else { if (!prev) s ^= 1; out.push(s, s); } prev = x; } return out; }, note: 'Delay modulation: a 1 has a mid-bit transition, a 0 followed by a 0 transitions at the boundary. About half the bandwidth of Manchester with a guaranteed transition every two bits.' },
  '4b6b': { label: '4B6B', chipsPerBit: 1.5, encode: (b) => { const out: number[] = []; for (let i = 0; i + 3 < b.length; i += 4) out.push(...CW6[b[i] * 8 + b[i + 1] * 4 + b[i + 2] * 2 + b[i + 3]]); return out; }, note: 'Every 4 bits become a 6-chip word with exactly three ones: constant 50 % brightness and short runs, at only 1.5× the bandwidth (802.15.7 PHY II uses a 4B6B table of this kind; 8B10B is the same idea with running-disparity control).' },
  vppm: { label: 'VPPM', chipsPerBit: 10, encode: (b, duty = 0.3) => { const on = Math.max(1, Math.round(duty * 10)); return b.flatMap((x) => Array.from({ length: 10 }, (_, k) => (x ? k >= 10 - on : k < on) ? 1 : 0)); }, note: 'Variable PPM (802.15.7): the pulse width sets the dimming level, its position (early or late) carries the bit. Brightness is fixed by the width, not the data.' },
};

function runStats(ch: number[]) {
  let maxRun = 0;
  let run = 0;
  let trans = 0;
  for (let i = 0; i < ch.length; i++) {
    if (i && ch[i] === ch[i - 1]) run++;
    else {
      if (i) trans++;
      run = 1;
    }
    maxRun = Math.max(maxRun, run);
  }
  const duty = ch.reduce((a, x) => a + x, 0) / Math.max(1, ch.length);
  return { maxRun, trans, duty };
}

/** Averaged periodogram of the (mean-removed) chip stream, as a function of f / bit rate. */
function psd(code: Code, duty: number) {
  const def = CODES[code];
  const sps = 8; // samples per chip
  const fx = Array.from({ length: 90 }, (_, i) => (i + 0.5) * (3 / 90));
  const acc = new Float64Array(fx.length);
  const u = rng(7);
  for (let blk = 0; blk < 12; blk++) {
    const bits = Array.from({ length: 96 }, () => (u() < 0.5 ? 1 : 0));
    const ch = def.encode(bits, duty);
    const m = ch.reduce((a, x) => a + x, 0) / ch.length;
    const x = ch.flatMap((c) => Array(sps).fill(c - m));
    const samplesPerBit = sps * def.chipsPerBit;
    fx.forEach((f, k) => {
      let re = 0;
      let im = 0;
      const w = (2 * Math.PI * f) / samplesPerBit;
      for (let n = 0; n < x.length; n++) {
        re += x[n] * Math.cos(w * n);
        im -= x[n] * Math.sin(w * n);
      }
      acc[k] += (re * re + im * im) / x.length;
    });
  }
  const peak = Math.max(...acc);
  return { fx, y: Array.from(acc, (v) => Math.max(-40, 10 * Math.log10(v / peak + 1e-12))) };
}

const PRESETS: Record<string, string> = {
  mixed: '1011001110001011',
  zeros: '1000000000000001',
  ones: '0111111111111110',
  alt: '1010101010101010',
};

export default function LineCodes() {
  const [bits, setBits] = useState<number[]>(PRESETS.mixed.split('').map(Number));
  const [code, setCode] = useState<Code>('manchester');
  const [duty, setDuty] = useState(0.3);
  const def = CODES[code];
  const chips = useMemo(() => def.encode(bits, duty), [def, bits, duty]);
  const st = runStats(chips);
  const spec = useMemo(() => psd(code, duty), [code, duty]);
  const nrzSpec = useMemo(() => psd('nrz', duty), [duty]);

  const W = 720;
  const H = 120;
  const n = chips.length;
  const cw = W / n;
  const path = chips.map((c, i) => `${i ? 'L' : 'M'}${i * cw} ${c ? 18 : 92} L${(i + 1) * cw} ${c ? 18 : 92}`).join(' ');
  const bw = W / bits.length;

  return (
    <Widget
      title="Line codes: shaping bits for a lamp"
      eyebrow="Interactive · line coding"
      controls={
        <>
          <Segmented
            label="Code"
            value={code}
            options={(Object.keys(CODES) as Code[]).map((k) => ({ value: k, label: CODES[k].label }))}
            onChange={setCode}
          />
          {code === 'vppm' && (
            <Segmented
              label="Dimming level"
              value={duty}
              options={[0.1, 0.3, 0.5, 0.7, 0.9].map((d) => ({ value: d, label: `${Math.round(d * 100)}%` }))}
              onChange={setDuty}
            />
          )}
          <Segmented
            label="Data"
            value={Object.keys(PRESETS).find((k) => PRESETS[k] === bits.join('')) ?? 'custom'}
            options={[
              { value: 'mixed', label: 'Mixed' },
              { value: 'zeros', label: 'Long 0s' },
              { value: 'ones', label: 'Long 1s' },
              { value: 'alt', label: '1010' },
            ]}
            onChange={(k) => PRESETS[k] && setBits(PRESETS[k].split('').map(Number))}
          />
          <Readouts>
            <Readout k="Average brightness" v={`${(st.duty * 100).toFixed(0)} %`} tone={Math.abs(st.duty - (code === 'vppm' ? duty : 0.5)) < 0.06 ? 'good' : 'warn'} />
            <Readout k="Longest run" v={`${st.maxRun} chips`} tone={st.maxRun <= 4 ? 'good' : st.maxRun <= 8 ? 'warn' : 'bad'} />
            <Readout k="Transitions" v={`${st.trans} for ${bits.length} bits`} />
            <Readout k="Chips per bit" v={def.chipsPerBit.toString()} />
          </Readouts>
        </>
      }
      caption={<p>{def.note} Click any bit to flip it. Try the long runs: NRZ goes flat and its brightness swings with the data, while Manchester, 4B6B and VPPM stay steady.</p>}
    >
      <div className="lc-bits" role="group" aria-label="Data bits">
        {bits.map((b, i) => (
          <button key={i} type="button" className={`lc-bit ${b ? 'one' : ''}`} onClick={() => setBits(bits.map((x, k) => (k === i ? 1 - x : x)))} aria-label={`bit ${i + 1}: ${b}`}>
            {b}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="lc-wave" role="img" aria-label={`${def.label} waveform`}>
        {bits.map((_, i) => (
          <line key={i} x1={i * bw} x2={i * bw} y1={6} y2={H - 6} stroke="var(--line-strong)" strokeDasharray="2 4" />
        ))}
        <rect x="0" y="18" width={W} height="74" fill="var(--phosphor-soft)" opacity={0.25} />
        <path d={path} stroke="var(--phosphor)" strokeWidth="2.4" fill="none" strokeLinejoin="round" />
        <line x1="0" x2={W} y1={92 - st.duty * 74} y2={92 - st.duty * 74} stroke="var(--c3)" strokeDasharray="6 5" />
        <text x={W - 4} y={88 - st.duty * 74} textAnchor="end" className="lc-label">
          mean light
        </text>
        <text x="4" y="13" className="lc-label">
          ON
        </text>
        <text x="4" y={H - 4} className="lc-label">
          OFF
        </text>
      </svg>
      <Plot
        height={170}
        title="Power spectrum (random data)"
        xLabel="frequency / bit rate"
        yLabel="dB"
        x={[0, 3]}
        y={[-40, 2]}
        legend
        series={[
          { x: nrzSpec.fx, y: nrzSpec.y, color: 'var(--text-3)', dash: [4, 4], label: 'NRZ' },
          { x: spec.fx, y: spec.y, color: 'var(--c2)', width: 2, label: def.label },
        ]}
      />
    </Widget>
  );
}
