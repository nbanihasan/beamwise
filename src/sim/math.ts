/**
 * Small numeric toolkit shared by every simulation.
 * Everything here is deterministic given a seed so lessons render the same way every time.
 */

export const PHYS = {
  q: 1.602176634e-19, // electron charge [C]
  k: 1.380649e-23, // Boltzmann [J/K]
  h: 6.62607015e-34, // Planck [J s]
  c: 299_792_458, // speed of light [m/s]
} as const;

/** Mulberry32: tiny, fast, seedable PRNG returning floats in [0, 1). */
export function rng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sampler (Box-Muller) driven by a uniform source. */
export function gaussian(u: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let a = 0;
    while (a === 0) a = u();
    const b = u();
    const r = Math.sqrt(-2 * Math.log(a));
    spare = r * Math.sin(2 * Math.PI * b);
    return r * Math.cos(2 * Math.PI * b);
  };
}

/** Gamma(shape k, scale theta) sampler, Marsaglia-Tsang. */
export function gammaSample(k: number, theta: number, u: () => number, n: () => number): number {
  if (k < 1) return gammaSample(k + 1, theta, u, n) * Math.pow(u(), 1 / k);
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = n();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const uu = u();
    if (uu < 1 - 0.0331 * x ** 4) return d * v * theta;
    if (Math.log(uu) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * theta;
  }
}

/** Complementary error function, |relative error| < 1.2e-7 (Numerical Recipes erfcc). */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Gaussian tail probability Q(x) = P(N(0,1) > x). */
export const Q = (x: number) => 0.5 * erfc(x / Math.SQRT2);

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const dB = (linearPower: number) => 10 * Math.log10(Math.max(linearPower, 1e-300));
export const fromDB = (db: number) => Math.pow(10, db / 10);

export function linspace(a: number, b: number, n: number): number[] {
  if (n === 1) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

export function logspace(a: number, b: number, n: number): number[] {
  return linspace(a, b, n).map((e) => Math.pow(10, e));
}

export function mean(x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i];
  return x.length ? s / x.length : 0;
}

export function variance(x: ArrayLike<number>): number {
  const m = mean(x);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i] - m) ** 2;
  return x.length ? s / x.length : 0;
}

export function rms(x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return x.length ? Math.sqrt(s / x.length) : 0;
}

/** log of n! via Lanczos-free Stirling series (exact table for small n). */
const LOGFACT: number[] = [0];
export function logFactorial(n: number): number {
  if (n < 0) return NaN;
  if (n < 256) {
    for (let i = LOGFACT.length; i <= n; i++) LOGFACT[i] = LOGFACT[i - 1] + Math.log(i);
    return LOGFACT[n];
  }
  return n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n) + 1 / (12 * n) - 1 / (360 * n ** 3);
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(lambda) - lambda - logFactorial(k));
}

/** P(K <= k) for K ~ Poisson(lambda). */
export function poissonCdf(k: number, lambda: number): number {
  if (k < 0) return 0;
  let s = 0;
  for (let i = 0; i <= k; i++) s += poissonPmf(i, lambda);
  return Math.min(1, s);
}

/** Solve A x = b (A row-major n×n) by Gaussian elimination with partial pivoting. */
export function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-300;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / (M[r][r] || 1e-300);
  }
  return x;
}

/** Engineering formatter: 1.2e-6 -> "1.20 µ". */
export function eng(x: number, unit = '', digits = 3): string {
  if (!isFinite(x)) return `— ${unit}`.trim();
  if (x === 0) return `0 ${unit}`.trim();
  const prefixes: [number, string][] = [
    [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'],
  ];
  const a = Math.abs(x);
  for (const [f, p] of prefixes) {
    if (a >= f * 0.9995) return `${(x / f).toPrecision(digits)} ${p}${unit}`.trim();
  }
  return `${x.toExponential(2)} ${unit}`.trim();
}

export function sci(x: number, digits = 2): string {
  if (!isFinite(x)) return '—';
  if (x === 0) return '0';
  if (Math.abs(x) >= 1e-3 && Math.abs(x) < 1e4) return x.toPrecision(digits + 1);
  return x.toExponential(digits);
}

/** Eigenvalues of a small symmetric matrix by cyclic Jacobi rotations. */
export function symmetricEigenvalues(S: number[][]): number[] {
  const n = S.length;
  const A = S.map((r) => [...r]);
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
      }
    }
  }
  return A.map((r, i) => r[i]).sort((a, b) => b - a);
}

/** Singular values of a real matrix H (rows x cols), descending. */
export function singularValues(H: number[][]): number[] {
  const cols = H[0]?.length ?? 0;
  const HtH = Array.from({ length: cols }, (_, i) => Array.from({ length: cols }, (_, j) => H.reduce((s, row) => s + row[i] * row[j], 0)));
  return symmetricEigenvalues(HtH).map((v) => Math.sqrt(Math.max(0, v)));
}
