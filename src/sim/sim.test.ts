import { describe, expect, it } from 'vitest';
import { Q, erfc, rng, poissonCdf } from './math';
import { complex, fft, ifft } from './fft';
import { lambertianOrder, losGain, concentratorGain, impulseResponse, KOMINE_ROOM } from './lambertian';
import { lineDecode, lineEncode, pamDemap, pamMap, prbs, FOUR_B_SIX_B } from './modulation';
import { dataCarriers, hermitianIfft, qamDemap, qamMap, fftReal } from './ofdm';
import { berOOK, excessNoise, noiseBudget, responsivity } from './receiver';
import { gammaGammaParams, kimAttenuationDbPerKm } from './outdoor';
import { rssToDistance, trilaterate } from './positioning';
import { onePole, onePoleInverse } from './dsp';
import { simulateLink, DEFAULT_LINK } from './linkSim';
import { stripeWidthRows } from './camera';

describe('math', () => {
  it('erfc and Q match reference values', () => {
    expect(erfc(0)).toBeCloseTo(1, 6);
    expect(Q(0)).toBeCloseTo(0.5, 6);
    expect(Q(3)).toBeCloseTo(1.3499e-3, 6);
    expect(Q(6)).toBeCloseTo(9.866e-10, 11);
  });
  it('poisson cdf sums to one', () => {
    expect(poissonCdf(200, 20)).toBeCloseTo(1, 8);
  });
});

describe('fft', () => {
  it('round-trips', () => {
    const u = rng(1);
    const x = complex(64);
    for (let i = 0; i < 64; i++) x.re[i] = u();
    const y = ifft(fft(x));
    for (let i = 0; i < 64; i++) expect(y.re[i]).toBeCloseTo(x.re[i], 10);
  });
});

describe('lambertian channel', () => {
  it('semi-angle 60° gives first-order Lambertian', () => {
    expect(lambertianOrder(60)).toBeCloseTo(1, 10);
    expect(lambertianOrder(15)).toBeCloseTo(20.0, 0);
  });
  it('on-axis gain equals (m+1)A/(2πd²)', () => {
    const r = losGain({ pos: [0, 0, 2], normal: [0, 0, -1], m: 1 }, { pos: [0, 0, 0], normal: [0, 0, 1], area: 1e-4, fovDeg: 60 });
    expect(r.H).toBeCloseTo((2 * 1e-4) / (2 * Math.PI * 4), 12);
  });
  it('outside FOV yields zero gain', () => {
    const r = losGain({ pos: [0, 0, 1], normal: [0, 0, -1], m: 1 }, { pos: [3, 0, 0], normal: [0, 0, 1], area: 1e-4, fovDeg: 30 });
    expect(r.H).toBe(0);
  });
  it('concentrator gain n²/sin²Ψc', () => {
    expect(concentratorGain(1.5, 90)).toBeCloseTo(2.25, 10);
  });
  it('diffuse reflections add delayed power with a few-ns rms spread', () => {
    const ir = impulseResponse(KOMINE_ROOM, { pos: [2.5, 2.5, 3], normal: [0, 0, -1], m: 1 }, { pos: [0.5, 1, 0.85], normal: [0, 0, 1], area: 1e-4, fovDeg: 70 }, 0.8, 0.2);
    expect(ir.diffuseGain).toBeGreaterThan(0);
    expect(ir.rmsDelay).toBeGreaterThan(0.1e-9);
    expect(ir.rmsDelay).toBeLessThan(20e-9);
  });
});

describe('modulation', () => {
  it('line codes round-trip', () => {
    const b = prbs(400, 3);
    for (const code of ['nrz', 'rz', 'manchester', '4b6b'] as const) {
      const d = lineDecode(lineEncode(b, code), code);
      expect(Array.from(d)).toEqual(Array.from(b));
    }
  });
  it('4B6B codewords are DC balanced and unique', () => {
    expect(new Set(FOUR_B_SIX_B).size).toBe(16);
    for (const w of FOUR_B_SIX_B) expect([...w].filter((c) => c === '1').length).toBe(3);
  });
  it('PAM and QAM round-trip', () => {
    const b = prbs(600, 9);
    expect(Array.from(pamDemap(pamMap(b, 4), 4))).toEqual(Array.from(b));
    expect(Array.from(qamDemap(qamMap(b, 16), 16))).toEqual(Array.from(b));
    expect(Array.from(qamDemap(qamMap(b, 64), 64))).toEqual(Array.from(b));
  });
});

describe('optical OFDM', () => {
  it('Hermitian symmetry gives a real signal that carries the data', () => {
    const N = 64;
    const car = dataCarriers(N, 'dco');
    const d = qamMap(prbs(car.length * 4, 2), 16);
    const x = hermitianIfft(N, car, d);
    const X = fftReal(x);
    car.forEach((k, i) => {
      expect(X.re[k]).toBeCloseTo(d[i].re, 9);
      expect(X.im[k]).toBeCloseTo(d[i].im, 9);
    });
  });
  it('ACO-OFDM clipping leaves odd subcarriers at half amplitude', () => {
    const N = 64;
    const car = dataCarriers(N, 'aco');
    const d = qamMap(prbs(car.length * 2, 4), 4);
    const x = hermitianIfft(N, car, d).map((v) => Math.max(0, v));
    const X = fftReal(x);
    car.forEach((k, i) => expect(X.re[k]).toBeCloseTo(d[i].re / 2, 9));
  });
});

describe('receiver', () => {
  it('silicon responsivity at 850 nm with η=0.8 ≈ 0.55 A/W', () => {
    expect(responsivity(0.8, 850)).toBeCloseTo(0.548, 2);
  });
  it('excess noise is 2 for large-M electron-only APD limit', () => {
    expect(excessNoise(1000, 0)).toBeCloseTo(2, 2);
  });
  it('BER of OOK at SNR = 13.5 dB is about 1e-6', () => {
    const snr = Math.pow(10, 13.55 / 10);
    expect(berOOK(snr)).toBeGreaterThan(5e-7);
    expect(berOOK(snr)).toBeLessThan(2e-6);
  });
  it('noise budget is positive and SNR finite', () => {
    const nb = noiseBudget({ R: 0.5, Pr: 1e-6, Ibg: 5e-6, B: 10e6, inputNoise: 5e-12 });
    expect(nb.total).toBeGreaterThan(0);
    expect(nb.snr).toBeGreaterThan(1);
  });
});

describe('outdoor', () => {
  it('clear-air attenuation is small, fog is large', () => {
    expect(kimAttenuationDbPerKm(23, 1550)).toBeLessThan(0.5);
    expect(kimAttenuationDbPerKm(0.2, 1550)).toBeGreaterThan(80);
  });
  it('weak turbulence scintillation index ≈ Rytov variance', () => {
    const p = gammaGammaParams(0.05);
    expect(p.scintillationIndex).toBeCloseTo(0.05, 1);
  });
});

describe('positioning', () => {
  it('RSS inversion and trilateration recover position', () => {
    const anchors: [number, number][] = [[1, 1], [1, 4], [4, 1], [4, 4]];
    const truth: [number, number] = [2.2, 3.1];
    const h = 2;
    const ranges = anchors.map(([x, y]) => {
      const d = Math.hypot(x - truth[0], y - truth[1], h);
      const Pr = (1 * 2 * 1e-4 * Math.pow(h, 2)) / (2 * Math.PI * Math.pow(d, 4));
      const est = rssToDistance(Pr, 1, 1, 1e-4, h);
      return Math.sqrt(est * est - h * h);
    });
    const p = trilaterate(anchors, ranges);
    expect(p[0]).toBeCloseTo(truth[0], 6);
    expect(p[1]).toBeCloseTo(truth[1], 6);
  });
});

describe('dsp', () => {
  it('one-pole inverse undoes the LED filter', () => {
    const x = Float64Array.from(prbs(200, 5));
    const y = onePoleInverse(onePole(x, 10e6, 200e6, 0), 10e6, 200e6);
    for (let i = 1; i < 200; i++) expect(y[i]).toBeCloseTo(x[i], 8);
  });
});

describe('camera', () => {
  it('stripe width = 1/(f t_row)', () => {
    expect(stripeWidthRows(1000, 20)).toBeCloseTo(50, 8);
  });
});

describe('link simulator', () => {
  it('a gentle OOK link is error free', () => {
    const r = simulateLink({ ...DEFAULT_LINK, symbolRateMHz: 5 });
    expect(r.ok).toBe(true);
    expect(r.ber).toBeLessThan(1e-3);
  });
  it('fast OOK beyond LED bandwidth benefits from equalisation', () => {
    const base = { ...DEFAULT_LINK, symbolRateMHz: 80, ledBandwidthMHz: 10 };
    const none = simulateLink({ ...base, equalizer: 'none' });
    const dfe = simulateLink({ ...base, equalizer: 'dfe' });
    expect(dfe.ber).toBeLessThan(none.ber);
  });
  it('DCO-OFDM 16-QAM link works at moderate rate', () => {
    const r = simulateLink({ ...DEFAULT_LINK, scheme: 'dco-ofdm', symbolRateMHz: 30, equalizer: 'lms' });
    expect(r.ber).toBeLessThan(1e-2);
    expect(r.throughputMbps).toBeGreaterThan(50);
  });
});

import { singularValues } from './math';
describe('linear algebra', () => {
  it('singular values of a diagonal matrix', () => {
    const s = singularValues([[3, 0], [0, 1]]);
    expect(s[0]).toBeCloseTo(3, 8);
    expect(s[1]).toBeCloseTo(1, 8);
  });
  it('rank-one matrix has one non-zero singular value', () => {
    const s = singularValues([[1, 1], [1, 1]]);
    expect(s[0]).toBeCloseTo(2, 8);
    expect(s[1]).toBeCloseTo(0, 6);
  });
});
