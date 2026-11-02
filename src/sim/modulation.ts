/**
 * Baseband modulation and line coding for intensity-modulated links.
 * Waveforms are normalised drive signals in [-1, 1] (the LED bias point sits at 0).
 */
import { rng } from './math';

export function prbs(n: number, seed = 7): Uint8Array {
  const u = rng(seed);
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = u() < 0.5 ? 0 : 1;
  return b;
}

export type LineCode = 'nrz' | 'rz' | 'manchester' | '4b6b';

/** DC-balanced 4B6B table (every codeword has exactly three ones), in the style of IEEE 802.15.7. */
export const FOUR_B_SIX_B: string[] = [
  '001110', '001101', '010011', '010110', '010101', '100011', '100110', '100101',
  '011001', '011010', '011100', '110001', '110010', '101001', '101010', '101100',
];

/** Encode bits into channel chips ("half-symbols" for Manchester/RZ). */
export function lineEncode(bits: ArrayLike<number>, code: LineCode): Uint8Array {
  const out: number[] = [];
  if (code === 'nrz') for (let i = 0; i < bits.length; i++) out.push(bits[i]);
  if (code === 'rz') for (let i = 0; i < bits.length; i++) out.push(bits[i], 0);
  // IEEE 802.3 convention: 0 -> high-low, 1 -> low-high
  if (code === 'manchester') for (let i = 0; i < bits.length; i++) out.push(bits[i] ? 0 : 1, bits[i] ? 1 : 0);
  if (code === '4b6b') {
    for (let i = 0; i + 3 < bits.length; i += 4) {
      const v = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
      for (const ch of FOUR_B_SIX_B[v]) out.push(ch === '1' ? 1 : 0);
    }
  }
  return Uint8Array.from(out);
}

export function lineDecode(chips: ArrayLike<number>, code: LineCode): Uint8Array {
  const out: number[] = [];
  if (code === 'nrz') for (let i = 0; i < chips.length; i++) out.push(chips[i]);
  if (code === 'rz') for (let i = 0; i + 1 < chips.length; i += 2) out.push(chips[i]);
  if (code === 'manchester') for (let i = 0; i + 1 < chips.length; i += 2) out.push(chips[i] < chips[i + 1] ? 1 : 0);
  if (code === '4b6b') {
    for (let i = 0; i + 5 < chips.length; i += 6) {
      const w = Array.from({ length: 6 }, (_, k) => chips[i + k]).join('');
      let idx = FOUR_B_SIX_B.indexOf(w);
      if (idx < 0) {
        // nearest codeword in Hamming distance
        let best = 99;
        FOUR_B_SIX_B.forEach((c, j) => {
          let d = 0;
          for (let k = 0; k < 6; k++) if (c[k] !== w[k]) d++;
          if (d < best) {
            best = d;
            idx = j;
          }
        });
      }
      out.push((idx >> 3) & 1, (idx >> 2) & 1, (idx >> 1) & 1, idx & 1);
    }
  }
  return Uint8Array.from(out);
}

/** Chip rate multiplier of a line code (chips per bit). */
export const codeExpansion: Record<LineCode, number> = { nrz: 1, rz: 2, manchester: 2, '4b6b': 1.5 };

/** Gray-coded M-PAM levels in [-1, 1]. bits.length must be a multiple of log2(M). */
export function pamMap(bits: ArrayLike<number>, M: number): Float64Array {
  const k = Math.log2(M);
  const n = Math.floor(bits.length / k);
  const out = new Float64Array(n);
  for (let s = 0; s < n; s++) {
    let g = 0;
    for (let j = 0; j < k; j++) g = (g << 1) | bits[s * k + j];
    // gray -> binary index
    let b = g;
    for (let sh = g >> 1; sh; sh >>= 1) b ^= sh;
    out[s] = -1 + (2 * b) / (M - 1);
  }
  return out;
}

export function pamDemap(levels: ArrayLike<number>, M: number): Uint8Array {
  const k = Math.log2(M);
  const out = new Uint8Array(levels.length * k);
  for (let s = 0; s < levels.length; s++) {
    const idx = Math.max(0, Math.min(M - 1, Math.round(((levels[s] + 1) * (M - 1)) / 2)));
    const g = idx ^ (idx >> 1);
    for (let j = 0; j < k; j++) out[s * k + j] = (g >> (k - 1 - j)) & 1;
  }
  return out;
}

/** L-PPM: each group of log2(L) bits selects one "on" slot out of L. Returns slots of 0/1. */
export function ppmMap(bits: ArrayLike<number>, L: number): Uint8Array {
  const k = Math.log2(L);
  const n = Math.floor(bits.length / k);
  const out = new Uint8Array(n * L);
  for (let s = 0; s < n; s++) {
    let v = 0;
    for (let j = 0; j < k; j++) v = (v << 1) | bits[s * k + j];
    out[s * L + v] = 1;
  }
  return out;
}

/**
 * Variable PPM (IEEE 802.15.7): a bit period split in two; pulse width = dimming level d.
 * '0' -> pulse at start of period, '1' -> pulse at end. Returns samples per bit = res.
 */
export function vppmWave(bits: ArrayLike<number>, dimming: number, res = 20): Float64Array {
  const out = new Float64Array(bits.length * res);
  const w = Math.max(1, Math.round(dimming * res));
  for (let i = 0; i < bits.length; i++) {
    for (let j = 0; j < res; j++) {
      const on = bits[i] ? j >= res - w : j < w;
      out[i * res + j] = on ? 1 : 0;
    }
  }
  return out;
}

/** Hold each symbol for `sps` samples (rectangular pulse shaping). */
export function upsampleHold(sym: ArrayLike<number>, sps: number): Float64Array {
  const out = new Float64Array(sym.length * sps);
  for (let i = 0; i < sym.length; i++) out.fill(sym[i], i * sps, (i + 1) * sps);
  return out;
}

/** Map chips {0,1} to drive levels {-1, +1}. */
export const chipsToDrive = (chips: ArrayLike<number>) => Float64Array.from(chips, (c) => (c ? 1 : -1));

export function countErrors(a: ArrayLike<number>, b: ArrayLike<number>): { errors: number; n: number } {
  const n = Math.min(a.length, b.length);
  let e = 0;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) e++;
  return { errors: e, n };
}
