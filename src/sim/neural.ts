/**
 * A tiny multilayer perceptron (one hidden tanh layer, softmax output) trained with Adam, plus the
 * PAM-4 LED channel and the classical least-squares equalisers it is compared against.
 * Small enough to train in a browser frame; deterministic given a seed.
 */
import { gaussian, rng, solve } from './math';

export interface LedChannelParams {
  n: number;
  bwRatio: number; // LED 3-dB bandwidth / symbol rate
  nonlin: number; // 0 = linear, larger = stronger compression
  snrDb: number;
  seed: number;
}

export interface ChannelData {
  sym: Int8Array; // 0..3
  rx: Float64Array; // received sample per symbol
}

/** PAM-4 → compressive LED → first-order low-pass (ISI) → AWGN, sampled once per symbol. */
export function pam4LedChannel(p: LedChannelParams): ChannelData {
  const u = rng(p.seed);
  const g = gaussian(u);
  const sym = new Int8Array(p.n);
  for (let i = 0; i < p.n; i++) sym[i] = Math.floor(u() * 4);
  const rho = Math.exp(-2 * Math.PI * p.bwRatio);
  const beta = Math.max(1e-3, p.nonlin);
  const rx = new Float64Array(p.n);
  let state = 0.5;
  let sigPow = 0;
  const clean = new Float64Array(p.n);
  for (let i = 0; i < p.n; i++) {
    const drive = 0.15 + 0.85 * (sym[i] / 3);
    const light = Math.tanh(beta * drive) / Math.tanh(beta); // LED compression
    state = (1 - rho) * light + rho * state;
    clean[i] = state;
  }
  let mean = 0;
  for (let i = 0; i < p.n; i++) mean += clean[i] / p.n;
  for (let i = 0; i < p.n; i++) sigPow += (clean[i] - mean) ** 2 / p.n;
  const sigma = Math.sqrt(sigPow / 10 ** (p.snrDb / 10));
  for (let i = 0; i < p.n; i++) rx[i] = clean[i] + sigma * g();
  return { sym, rx };
}

export const GRAY = [0, 1, 3, 2];
export function bitErrors(a: number, b: number) {
  const x = GRAY[a] ^ GRAY[b];
  return (x & 1) + ((x >> 1) & 1);
}

export function windowAt(rx: ArrayLike<number>, i: number, taps: number, mean: number, std: number): number[] {
  const h = Math.floor(taps / 2);
  const out: number[] = [];
  for (let k = -h; k <= h; k++) {
    const j = i + k;
    out.push(j >= 0 && j < rx.length ? (rx[j] - mean) / std : 0);
  }
  return out;
}

export function stats(x: ArrayLike<number>) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m += x[i] / x.length;
  let v = 0;
  for (let i = 0; i < x.length; i++) v += (x[i] - m) ** 2 / x.length;
  return { mean: m, std: Math.sqrt(v) || 1 };
}

/** Least-squares fit of target levels from arbitrary features; returns weights. */
export function leastSquares(features: number[][], target: number[], ridge = 1e-6): number[] {
  const d = features[0].length;
  const A = Array.from({ length: d }, () => new Array(d).fill(0));
  const b = new Array(d).fill(0);
  for (let n = 0; n < features.length; n++) {
    const f = features[n];
    for (let i = 0; i < d; i++) {
      b[i] += f[i] * target[n];
      for (let j = 0; j < d; j++) A[i][j] += f[i] * f[j];
    }
  }
  for (let i = 0; i < d; i++) A[i][i] += ridge * features.length;
  return solve(A, b);
}

export const dotp = (w: number[], f: number[]) => w.reduce((s, x, i) => s + x * f[i], 0);

export const linFeatures = (win: number[]) => [1, ...win];
export function volterraFeatures(win: number[]) {
  const c = Math.floor(win.length / 2);
  const q: number[] = [];
  for (let i = c - 1; i <= c + 1; i++) for (let j = i; j <= c + 1; j++) q.push(win[i] * win[j]);
  return [1, ...win, ...q, win[c] ** 3];
}

export class Mlp {
  W1: Float64Array;
  b1: Float64Array;
  W2: Float64Array;
  b2: Float64Array;
  private m: Float64Array[];
  private v: Float64Array[];
  private t = 0;
  constructor(
    public nIn: number,
    public nHid: number,
    public nOut: number,
    seed = 1,
  ) {
    const u = rng(seed);
    const g = gaussian(u);
    this.W1 = Float64Array.from({ length: nIn * nHid }, () => g() * Math.sqrt(1 / nIn));
    this.b1 = new Float64Array(nHid);
    this.W2 = Float64Array.from({ length: nHid * nOut }, () => g() * Math.sqrt(1 / nHid));
    this.b2 = new Float64Array(nOut);
    const z = () => [new Float64Array(nIn * nHid), new Float64Array(nHid), new Float64Array(nHid * nOut), new Float64Array(nOut)];
    this.m = z();
    this.v = z();
  }
  forward(x: number[]) {
    const h = new Float64Array(this.nHid);
    for (let j = 0; j < this.nHid; j++) {
      let s = this.b1[j];
      for (let i = 0; i < this.nIn; i++) s += this.W1[j * this.nIn + i] * x[i];
      h[j] = Math.tanh(s);
    }
    const z = new Float64Array(this.nOut);
    let mx = -Infinity;
    for (let k = 0; k < this.nOut; k++) {
      let s = this.b2[k];
      for (let j = 0; j < this.nHid; j++) s += this.W2[k * this.nHid + j] * h[j];
      z[k] = s;
      mx = Math.max(mx, s);
    }
    let sum = 0;
    for (let k = 0; k < this.nOut; k++) sum += (z[k] = Math.exp(z[k] - mx));
    for (let k = 0; k < this.nOut; k++) z[k] /= sum;
    return { h, p: z };
  }
  predict(x: number[]) {
    const { p } = this.forward(x);
    let best = 0;
    for (let k = 1; k < p.length; k++) if (p[k] > p[best]) best = k;
    return best;
  }
  /** One pass over the data in mini-batches; returns mean cross-entropy. */
  epoch(X: number[][], y: number[], lr = 0.01, batch = 32, seed = 0) {
    const order = Array.from(X.keys());
    const u = rng(seed + 7);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(u() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let loss = 0;
    const gW1 = new Float64Array(this.W1.length);
    const gb1 = new Float64Array(this.b1.length);
    const gW2 = new Float64Array(this.W2.length);
    const gb2 = new Float64Array(this.b2.length);
    for (let s = 0; s < order.length; s += batch) {
      gW1.fill(0);
      gb1.fill(0);
      gW2.fill(0);
      gb2.fill(0);
      const end = Math.min(order.length, s + batch);
      for (let n = s; n < end; n++) {
        const x = X[order[n]];
        const t = y[order[n]];
        const { h, p } = this.forward(x);
        loss -= Math.log(Math.max(1e-12, p[t]));
        const dz = Float64Array.from(p, (v, k) => v - (k === t ? 1 : 0));
        for (let k = 0; k < this.nOut; k++) {
          gb2[k] += dz[k];
          for (let j = 0; j < this.nHid; j++) gW2[k * this.nHid + j] += dz[k] * h[j];
        }
        for (let j = 0; j < this.nHid; j++) {
          let dh = 0;
          for (let k = 0; k < this.nOut; k++) dh += this.W2[k * this.nHid + j] * dz[k];
          const da = dh * (1 - h[j] * h[j]);
          gb1[j] += da;
          for (let i = 0; i < this.nIn; i++) gW1[j * this.nIn + i] += da * x[i];
        }
      }
      const bs = end - s;
      this.t++;
      const params = [this.W1, this.b1, this.W2, this.b2];
      const grads = [gW1, gb1, gW2, gb2];
      const b1 = 0.9;
      const b2 = 0.999;
      for (let q = 0; q < 4; q++) {
        const P = params[q];
        const G = grads[q];
        const M = this.m[q];
        const V = this.v[q];
        for (let i = 0; i < P.length; i++) {
          const gr = G[i] / bs;
          M[i] = b1 * M[i] + (1 - b1) * gr;
          V[i] = b2 * V[i] + (1 - b2) * gr * gr;
          const mh = M[i] / (1 - b1 ** this.t);
          const vh = V[i] / (1 - b2 ** this.t);
          P[i] -= (lr * mh) / (Math.sqrt(vh) + 1e-8);
        }
      }
    }
    return loss / order.length;
  }
}
