/**
 * Front-end and equalisation DSP: LED response, filters, adaptive equalisers, eye-diagram slicing.
 */

/** One-pole low-pass (models LED/photodiode bandwidth). fc and fs in Hz. Unity DC gain. */
export function onePole(x: ArrayLike<number>, fc: number, fs: number, initial?: number): Float64Array {
  const a = Math.exp((-2 * Math.PI * fc) / fs);
  const y = new Float64Array(x.length);
  let s = initial ?? x[0] ?? 0;
  for (let i = 0; i < x.length; i++) {
    s = a * s + (1 - a) * x[i];
    y[i] = s;
  }
  return y;
}

/** Exact inverse of onePole: a zero-forcing "analogue" equaliser (a.k.a. pre/post-emphasis). */
export function onePoleInverse(y: ArrayLike<number>, fc: number, fs: number): Float64Array {
  const a = Math.exp((-2 * Math.PI * fc) / fs);
  const x = new Float64Array(y.length);
  x[0] = y[0];
  for (let i = 1; i < y.length; i++) x[i] = (y[i] - a * y[i - 1]) / (1 - a);
  return x;
}

/** Magnitude response (dB) of a first-order low-pass at frequencies f. */
export const firstOrderDb = (f: number, fc: number) => -10 * Math.log10(1 + (f / fc) ** 2);

/**
 * Soft-saturating LED electro-optic transfer (Rapp model) with hard clipping below turn-on.
 * u is the normalised drive (1 = bias point). Output saturates towards `sat`.
 */
export function ledTransfer(u: number, nonlinear: boolean, sat = 2, p = 2): number {
  if (u <= 0) return 0;
  if (!nonlinear) return Math.min(u, sat);
  return u / Math.pow(1 + Math.pow(u / sat, 2 * p), 1 / (2 * p));
}

export function convolve(x: ArrayLike<number>, h: ArrayLike<number>): Float64Array {
  const y = new Float64Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let s = 0;
    for (let k = 0; k < h.length && k <= n; k++) s += h[k] * x[n - k];
    y[n] = s;
  }
  return y;
}

/** Integrate-and-dump (matched filter for rectangular pulses), sampling symbol i over [i·sps, (i+1)·sps). */
export function integrateDump(x: ArrayLike<number>, sps: number, delay = 0): Float64Array {
  const n = Math.floor((x.length - delay) / sps);
  const out = new Float64Array(Math.max(0, n));
  for (let i = 0; i < n; i++) {
    let s = 0;
    // use the central 60% of the symbol to reduce ISI from finite bandwidth
    const a = Math.floor(sps * 0.2);
    const b = Math.ceil(sps * 0.8);
    for (let j = a; j < b; j++) s += x[delay + i * sps + j];
    out[i] = s / (b - a);
  }
  return out;
}

/** Best integer sample delay aligning y to reference x (max cross-correlation over 0..maxLag). */
export function bestDelay(x: ArrayLike<number>, y: ArrayLike<number>, maxLag: number): number {
  let best = 0;
  let bestV = -Infinity;
  const n = Math.min(x.length, y.length) - maxLag;
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < n; i += 3) s += x[i] * y[i + lag];
    if (s > bestV) {
      bestV = s;
      best = lag;
    }
  }
  return best;
}

export interface EqResult {
  out: Float64Array; // equalised symbol-rate samples
  taps: Float64Array;
  mseCurve: number[];
}

/**
 * Symbol-spaced LMS / decision-feedback equaliser.
 * Training on the first `nTrain` known symbols, then decision directed.
 */
export function lmsEqualizer(
  rx: ArrayLike<number>,
  ref: ArrayLike<number>,
  slicer: (v: number) => number,
  opts: { ff: number; fb?: number; mu?: number; nTrain?: number },
): EqResult {
  const ff = opts.ff;
  const fb = opts.fb ?? 0;
  const mu = opts.mu ?? 0.01;
  const nTrain = opts.nTrain ?? 400;
  const w = new Float64Array(ff + fb);
  const center = Math.floor(ff / 2);
  w[center] = 1;
  const out = new Float64Array(rx.length);
  const past = new Float64Array(fb);
  const mse: number[] = [];
  let acc = 0;
  for (let n = 0; n < rx.length; n++) {
    let y = 0;
    for (let k = 0; k < ff; k++) {
      const idx = n + center - k;
      y += w[k] * (idx >= 0 && idx < rx.length ? rx[idx] : 0);
    }
    for (let k = 0; k < fb; k++) y -= w[ff + k] * past[k];
    out[n] = y;
    const d = n < nTrain && n < ref.length ? ref[n] : slicer(y);
    const e = d - y;
    // normalised LMS: step scaled by the regressor energy so it stays stable at any signal level
    let energy = 1e-9;
    for (let k = 0; k < ff; k++) {
      const idx = n + center - k;
      const v = idx >= 0 && idx < rx.length ? rx[idx] : 0;
      energy += v * v;
    }
    for (let k = 0; k < fb; k++) energy += past[k] * past[k];
    const step = (mu * (ff + fb)) / energy;
    for (let k = 0; k < ff; k++) {
      const idx = n + center - k;
      w[k] += step * e * (idx >= 0 && idx < rx.length ? rx[idx] : 0);
    }
    for (let k = 0; k < fb; k++) w[ff + k] -= step * e * past[k];
    for (let k = fb - 1; k > 0; k--) past[k] = past[k - 1];
    if (fb) past[0] = d;
    acc += e * e;
    if ((n + 1) % 50 === 0) {
      mse.push(acc / 50);
      acc = 0;
    }
  }
  return { out, taps: w, mseCurve: mse };
}

/** Cut a waveform into overlapping 2-symbol traces for an eye diagram. */
export function eyeTraces(x: ArrayLike<number>, sps: number, maxTraces = 220, offset = 0): number[][] {
  const traces: number[][] = [];
  const span = 2 * sps;
  for (let s = offset + sps; s + span < x.length && traces.length < maxTraces; s += sps) {
    const t: number[] = [];
    for (let j = 0; j <= span; j++) t.push(x[s + j - Math.floor(sps / 2)]);
    traces.push(t);
  }
  return traces;
}

/** Normalise a signal to zero mean and given peak (for display). */
export function normalise(x: ArrayLike<number>, peak = 1): Float64Array {
  let m = 0;
  for (let i = 0; i < x.length; i++) m += x[i];
  m /= x.length || 1;
  let p = 1e-30;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i] - m));
  return Float64Array.from(x, (v) => ((v - m) / p) * peak);
}
