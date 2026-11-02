/** Iterative radix-2 FFT on separate real/imag arrays (length must be a power of 2). */

export interface Complex {
  re: Float64Array;
  im: Float64Array;
}

export function complex(n: number): Complex {
  return { re: new Float64Array(n), im: new Float64Array(n) };
}

export function isPow2(n: number) {
  return n > 0 && (n & (n - 1)) === 0;
}

export function nextPow2(n: number) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function transform(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  if (!isPow2(n)) throw new Error(`FFT length ${n} is not a power of two`);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/** Forward FFT, returns a new Complex. */
export function fft(x: Complex): Complex {
  const out = { re: Float64Array.from(x.re), im: Float64Array.from(x.im) };
  transform(out.re, out.im, false);
  return out;
}

/** Inverse FFT (1/N normalised), returns a new Complex. */
export function ifft(X: Complex): Complex {
  const out = { re: Float64Array.from(X.re), im: Float64Array.from(X.im) };
  transform(out.re, out.im, true);
  return out;
}

/**
 * Welch power spectral density estimate of a real signal.
 * Returns one-sided frequencies [Hz] and PSD in dB (relative, Hann window, 50% overlap).
 */
export function welchPSD(x: ArrayLike<number>, fs: number, seg = 512): { f: number[]; psdDb: number[] } {
  const n = Math.min(seg, nextPow2(Math.max(16, Math.floor(x.length / 2))));
  const N = isPow2(n) ? n : nextPow2(n) / 2;
  const hop = N / 2;
  const win = Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const wpow = win.reduce((s, w) => s + w * w, 0);
  const acc = new Float64Array(N / 2 + 1);
  let count = 0;
  for (let start = 0; start + N <= x.length; start += hop) {
    const c = complex(N);
    for (let i = 0; i < N; i++) c.re[i] = x[start + i] * win[i];
    const X = fft(c);
    for (let k = 0; k <= N / 2; k++) acc[k] += X.re[k] ** 2 + X.im[k] ** 2;
    count++;
  }
  const f: number[] = [];
  const psdDb: number[] = [];
  for (let k = 0; k <= N / 2; k++) {
    f.push((k * fs) / N);
    const p = acc[k] / Math.max(1, count) / (wpow * fs);
    psdDb.push(10 * Math.log10(p + 1e-30));
  }
  return { f, psdDb };
}
