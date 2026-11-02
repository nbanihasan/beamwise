/**
 * A tiny, deterministic end-to-end VLC chain used by the 3D system view to show "the signal at this
 * point" for every block. It sends the text "Hi" through Hamming(7,4), a block interleaver, Manchester
 * line coding, OOK, an LED, a room channel with a burst of interference, a photodiode front end, an
 * equaliser and back. The burst deliberately breaks two adjacent bits so the interleaver + FEC can be
 * seen repairing them.
 */
import { gaussian, rng } from '@/sim/math';
import { ledTransfer, onePole } from '@/sim/dsp';

export const MESSAGE = 'Hi';
const SPS = 12; // samples per chip

export function textToBits(t: string): number[] {
  const out: number[] = [];
  for (const ch of t) {
    const c = ch.charCodeAt(0);
    for (let i = 7; i >= 0; i--) out.push((c >> i) & 1);
  }
  return out;
}

export function bitsToText(b: number[]): string {
  let s = '';
  for (let i = 0; i + 7 < b.length; i += 8) {
    let c = 0;
    for (let k = 0; k < 8; k++) c = (c << 1) | (b[i + k] & 1);
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '·';
  }
  return s;
}

/** Hamming(7,4): data d1..d4 → [p1 p2 d1 p3 d2 d3 d4]. */
export function hamming74Encode(bits: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 4) {
    const [d1, d2, d3, d4] = [bits[i] ?? 0, bits[i + 1] ?? 0, bits[i + 2] ?? 0, bits[i + 3] ?? 0];
    const p1 = d1 ^ d2 ^ d4;
    const p2 = d1 ^ d3 ^ d4;
    const p3 = d2 ^ d3 ^ d4;
    out.push(p1, p2, d1, p3, d2, d3, d4);
  }
  return out;
}

export function hamming74Decode(code: number[]): { bits: number[]; corrected: number[] } {
  const bits: number[] = [];
  const corrected: number[] = [];
  for (let i = 0; i + 6 < code.length; i += 7) {
    const c = code.slice(i, i + 7);
    const s1 = c[0] ^ c[2] ^ c[4] ^ c[6];
    const s2 = c[1] ^ c[2] ^ c[5] ^ c[6];
    const s3 = c[3] ^ c[4] ^ c[5] ^ c[6];
    const syn = s1 + 2 * s2 + 4 * s3;
    if (syn) {
      c[syn - 1] ^= 1;
      corrected.push(i + syn - 1);
    }
    bits.push(c[2], c[4], c[5], c[6]);
  }
  return { bits, corrected };
}

/** Block interleaver: write row-wise into rows×cols, read column-wise. */
export function interleave(x: number[], rows: number): number[] {
  const cols = Math.ceil(x.length / rows);
  const out: number[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (r * cols + c < x.length) out.push(x[r * cols + c]);
  return out;
}
export function deinterleave(x: number[], rows: number): number[] {
  const cols = Math.ceil(x.length / rows);
  const out = new Array(x.length).fill(0);
  let k = 0;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (r * cols + c < x.length) out[r * cols + c] = x[k++];
  return out;
}

export interface ChainSignals {
  text: string;
  bits: number[];
  coded: number[];
  parityMask: boolean[];
  interleaved: number[];
  chips: number[];
  levels: number[];
  dac: number[];
  driveMa: number[];
  optical: number[];
  received: number[];
  ambientFiltered: number[];
  photocurrent: number[];
  tia: number[];
  adc: { t: number[]; v: number[] };
  eye: number[][];
  eyeEq: number[][];
  soft: number[];
  softEq: number[];
  chipDecisions: number[];
  chipErrors: number[];
  rxInterleaved: number[];
  rxErrorsBeforeFec: number[];
  rxCoded: number[];
  corrected: number[];
  rxBits: number[];
  rxText: string;
}

export function runChain(): ChainSignals {
  const u = rng(42);
  const n = gaussian(u);
  const bits = textToBits(MESSAGE);
  const coded = hamming74Encode(bits);
  const parityMask = coded.map((_, i) => [0, 1, 3].includes(i % 7));
  const interleaved = interleave(coded, 4);
  // Manchester: 1 → [1,0], 0 → [0,1]
  const chips: number[] = [];
  for (const b of interleaved) chips.push(b ? 1 : 0, b ? 0 : 1);
  const levels = chips.map((c) => (c ? 1 : 0));

  // DAC + pulse shaping: hold then smooth (two cascaded poles ≈ gentle raised-cosine edges)
  const hold: number[] = [];
  for (const l of levels) for (let k = 0; k < SPS; k++) hold.push(l);
  const fs = 1;
  const dac = Array.from(onePole(onePole(hold, 0.12, fs, 0.5), 0.12, fs, 0.5));
  const driveMa = dac.map((v) => 350 + 250 * (v - 0.5) * 2); // bias 350 mA ± 250 mA
  // LED: mild compression + slow phosphor-limited bandwidth
  const optical = Array.from(onePole(dac.map((v) => ledTransfer(0.3 + 1.4 * v, true, 2)), 0.06, fs, 0.9));
  // channel: attenuation + diffuse tail + interference burst on a few chips
  const H = 1;
  const diffuse = onePole(optical, 0.03, fs, optical[0]);
  const burstStart = 21 * SPS; // chips 21–24
  const received = optical.map((v, i) => {
    const amb = 0.9;
    const burst = i >= burstStart && i < burstStart + 4 * SPS ? 0.85 * Math.sin((i - burstStart) * 0.9) : 0;
    return H * (0.8 * v + 0.2 * diffuse[i]) + amb + burst;
  });
  // optical filter removes most of the ambient DC level
  const ambientFiltered = received.map((v) => v - 0.75);
  const R = 0.4;
  const photocurrent = ambientFiltered.map((v) => R * v + 0.02 * n());
  const tia = Array.from(onePole(photocurrent.map((i) => i * 5), 0.2, fs, photocurrent[0] * 5)).map((v) => v + 0.03 * n());
  // ADC: 3 samples per chip, 4-bit
  const adcT: number[] = [];
  const adcV: number[] = [];
  const vmax = Math.max(...tia);
  const vmin = Math.min(...tia);
  for (let i = Math.floor(SPS / 6); i < tia.length; i += SPS / 3) {
    const q = Math.round(((tia[i] - vmin) / (vmax - vmin)) * 15);
    adcT.push(i / SPS);
    adcV.push(q);
  }
  // symbol timing: sample each chip at its best phase
  const eye: number[][] = [];
  for (let c = 1; c < chips.length - 1; c++) eye.push(tia.slice(c * SPS - SPS / 2, c * SPS + SPS + SPS / 2));
  const phase = Math.floor(SPS * 0.75);
  const soft = chips.map((_, c) => tia[Math.min(tia.length - 1, c * SPS + phase)]);
  // simple 2-tap equaliser: remove the tail of the previous chip (ISI from the slow LED)
  const mid = (Math.max(...soft) + Math.min(...soft)) / 2;
  const softEq = soft.map((v, i) => v - 0.35 * ((i > 0 ? soft[i - 1] : mid) - mid));
  const midEq = (Math.max(...softEq) + Math.min(...softEq)) / 2;
  const eyeEq = eye.map((tr, k) => tr.map((v) => v - 0.35 * ((k >= 0 ? soft[k] : mid) - mid)));
  const chipDecisions = softEq.map((v) => (v > midEq ? 1 : 0));
  const chipErrors = chipDecisions.map((d, i) => (d !== levels[i] ? i : -1)).filter((i) => i >= 0);
  // Manchester decode: compare the two halves
  const rxInterleaved: number[] = [];
  for (let i = 0; i + 1 < softEq.length; i += 2) rxInterleaved.push(softEq[i] > softEq[i + 1] ? 1 : 0);
  // force the burst to look like a classic two-bit error, so the repair is visible
  const burstBit = Math.floor(21 / 2);
  rxInterleaved[burstBit] ^= rxInterleaved[burstBit] === interleaved[burstBit] ? 1 : 0;
  rxInterleaved[burstBit + 1] ^= rxInterleaved[burstBit + 1] === interleaved[burstBit + 1] ? 1 : 0;
  const rxCoded = deinterleave(rxInterleaved, 4);
  const rxErrorsBeforeFec = rxCoded.map((b, i) => (b !== coded[i] ? i : -1)).filter((i) => i >= 0);
  const { bits: rxBits, corrected } = hamming74Decode(rxCoded.slice());
  return {
    text: MESSAGE,
    bits,
    coded,
    parityMask,
    interleaved,
    chips,
    levels,
    dac,
    driveMa,
    optical,
    received,
    ambientFiltered,
    photocurrent,
    tia,
    adc: { t: adcT, v: adcV },
    eye,
    eyeEq,
    soft,
    softEq,
    chipDecisions,
    chipErrors,
    rxInterleaved,
    rxErrorsBeforeFec,
    rxCoded,
    corrected,
    rxBits,
    rxText: bitsToText(rxBits),
  };
}

export const CHAIN_SPS = SPS;
