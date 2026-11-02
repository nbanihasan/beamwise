/**
 * Optical OFDM for IM/DD: Hermitian symmetry gives a real time-domain signal;
 * DCO-OFDM adds a DC bias, ACO-OFDM uses odd subcarriers and clips at zero.
 * References: Armstrong, JLT 2009; Armstrong & Lowery, Electron. Lett. 2006; Tsonev et al. (U-OFDM) 2012.
 */
import { complex, fft, ifft, type Complex } from './fft';

export interface QamPoint {
  re: number;
  im: number;
}

/** Gray-coded square M-QAM, unit average energy. */
export function qamMap(bits: ArrayLike<number>, M: number): QamPoint[] {
  const k = Math.log2(M);
  const side = Math.sqrt(M);
  const half = k / 2;
  const norm = Math.sqrt((2 * (M - 1)) / 3);
  const pts: QamPoint[] = [];
  const axis = (start: number) => {
    let g = 0;
    for (let j = 0; j < half; j++) g = (g << 1) | bits[start + j];
    let b = g;
    for (let sh = g >> 1; sh; sh >>= 1) b ^= sh;
    return (2 * b - (side - 1)) / norm;
  };
  for (let s = 0; s + k <= bits.length; s += k) pts.push({ re: axis(s), im: axis(s + half) });
  return pts;
}

export function qamDemap(pts: QamPoint[], M: number): Uint8Array {
  const k = Math.log2(M);
  const side = Math.sqrt(M);
  const half = k / 2;
  const norm = Math.sqrt((2 * (M - 1)) / 3);
  const out = new Uint8Array(pts.length * k);
  const axis = (v: number, off: number) => {
    const b = Math.max(0, Math.min(side - 1, Math.round((v * norm + (side - 1)) / 2)));
    const g = b ^ (b >> 1);
    for (let j = 0; j < half; j++) out[off + j] = (g >> (half - 1 - j)) & 1;
  };
  pts.forEach((p, s) => {
    axis(p.re, s * k);
    axis(p.im, s * k + half);
  });
  return out;
}

export function qamConstellation(M: number): QamPoint[] {
  const k = Math.log2(M);
  const pts: QamPoint[] = [];
  for (let v = 0; v < M; v++) {
    const bits = Array.from({ length: k }, (_, j) => (v >> (k - 1 - j)) & 1);
    pts.push(qamMap(bits, M)[0]);
  }
  return pts;
}

export type OfdmVariant = 'dco' | 'aco';

/** Indices of data-carrying subcarriers for an N-point IFFT. */
export function dataCarriers(N: number, variant: OfdmVariant): number[] {
  const idx: number[] = [];
  for (let k = 1; k < N / 2; k++) if (variant === 'dco' || k % 2 === 1) idx.push(k);
  return idx;
}

/** Build one real OFDM symbol (no CP) from data symbols placed on dataCarriers with Hermitian symmetry. */
export function hermitianIfft(N: number, carriers: number[], data: QamPoint[]): Float64Array {
  const X: Complex = complex(N);
  carriers.forEach((k, i) => {
    const d = data[i] ?? { re: 0, im: 0 };
    X.re[k] = d.re;
    X.im[k] = d.im;
    X.re[N - k] = d.re;
    X.im[N - k] = -d.im;
  });
  const x = ifft(X);
  return x.re; // imaginary part is ~0 by construction
}

export function fftReal(x: ArrayLike<number>): Complex {
  const c = complex(x.length);
  for (let i = 0; i < x.length; i++) c.re[i] = x[i];
  return fft(c);
}

export function papr(x: ArrayLike<number>): number {
  let peak = 0;
  let p = 0;
  for (let i = 0; i < x.length; i++) {
    peak = Math.max(peak, x[i] * x[i]);
    p += x[i] * x[i];
  }
  return peak / (p / x.length || 1);
}

/** Bits carried per OFDM frame (one symbol incl. CP) and resulting spectral efficiency. */
export function ofdmEfficiency(N: number, cp: number, M: number, variant: OfdmVariant) {
  const nData = dataCarriers(N, variant).length;
  const bits = nData * Math.log2(M);
  return { nData, bitsPerSymbol: bits, bitsPerSample: bits / (N + cp) };
}
