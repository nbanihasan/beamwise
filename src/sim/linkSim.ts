/**
 * End-to-end IM/DD link simulator used by the Link Lab.
 * bits -> line code / modulation -> LED (bias, non-linearity, bandwidth) -> channel (Lambertian LOS +
 * diffuse tail) -> photodiode (shot, ambient, amplifier noise) -> equaliser -> detector -> BER.
 */
import { PHYS, gaussian, rng, dB, variance } from './math';
import { losGain, lambertianOrder } from './lambertian';
import { chipsToDrive, lineDecode, lineEncode, pamDemap, pamMap, prbs, upsampleHold } from './modulation';
import { integrateDump, ledTransfer, lmsEqualizer, onePole, onePoleInverse, eyeTraces } from './dsp';
import { dataCarriers, fftReal, hermitianIfft, qamDemap, qamMap, type QamPoint } from './ofdm';
import { welchPSD } from './fft';

export type Scheme = 'ook' | 'manchester' | 'pam4' | 'dco-ofdm' | 'aco-ofdm';
export type EqMode = 'none' | 'zf' | 'lms' | 'dfe';

export interface LinkConfig {
  scheme: Scheme;
  symbolRateMHz: number; // chip/symbol rate (single carrier) or sample rate (OFDM)
  qam: 4 | 16 | 64;
  dcBiasSigma: number; // DCO-OFDM bias in multiples of σ
  ledBandwidthMHz: number;
  modIndex: number;
  nonlinear: boolean;
  ledPowerW: number; // average optical power
  semiAngleDeg: number;
  heightM: number; // vertical TX-RX separation
  offsetM: number; // horizontal offset
  fovDeg: number;
  areaMm2: number;
  lensIndex: number; // concentrator refractive index (0 = bare detector)
  diffuseFraction: number; // share of received power arriving via reflections
  rmsDelayNs: number;
  responsivity: number; // A/W
  ambientUA: number; // background photocurrent [µA]
  tiaNoisePA: number; // amplifier input noise [pA/√Hz]
  equalizer: EqMode;
  seed: number;
}

export const DEFAULT_LINK: LinkConfig = {
  scheme: 'ook',
  symbolRateMHz: 40,
  qam: 16,
  dcBiasSigma: 3,
  ledBandwidthMHz: 15,
  modIndex: 0.6,
  nonlinear: true,
  ledPowerW: 2,
  semiAngleDeg: 60,
  heightM: 2.15,
  offsetM: 0.6,
  fovDeg: 60,
  areaMm2: 20,
  lensIndex: 1.5,
  diffuseFraction: 0.1,
  rmsDelayNs: 4,
  responsivity: 0.4,
  ambientUA: 20,
  tiaNoisePA: 5,
  equalizer: 'none',
  seed: 11,
};

export interface LinkResult {
  ok: boolean;
  note?: string;
  fs: number;
  sps: number;
  H0: number;
  PrW: number;
  signalCurrent: number;
  noiseStd: number; // per symbol-rate sample [A]
  snrDb: number; // electrical SNR at the detector (pre-equaliser, theory)
  measuredSnrDb: number; // from decision-point error vector
  ber: number;
  errors: number;
  nBits: number;
  throughputMbps: number;
  waveforms: { t: number[]; drive: number[]; optical: number[]; received: number[] };
  psd: { f: number[]; tx: number[]; rx: number[] };
  channelResponse: { f: number[]; db: number[] };
  eyeBefore: number[][];
  eyeAfter: number[][] | null;
  decisions: { before: number[]; after: number[]; levels: number[] };
  constellation: { raw: QamPoint[]; eq: QamPoint[]; ideal: QamPoint[] } | null;
  subcarrierSnrDb: { f: number[]; snr: number[] } | null;
  mse: number[];
}

/** Overall LED + channel magnitude response (for display). */
function responseDb(cfg: LinkConfig, fMax: number) {
  const f: number[] = [];
  const db: number[] = [];
  const tau = cfg.rmsDelayNs * 1e-9;
  for (let i = 0; i <= 200; i++) {
    const fr = (fMax * i) / 200;
    const led2 = 1 / (1 + (fr / (cfg.ledBandwidthMHz * 1e6)) ** 2);
    const w = 2 * Math.PI * fr * tau;
    const k = cfg.diffuseFraction;
    // (1-k) + k/(1+jw)
    const re = 1 - k + k / (1 + w * w);
    const im = (-k * w) / (1 + w * w);
    f.push(fr / 1e6);
    db.push(10 * Math.log10(led2 * (re * re + im * im)));
  }
  return { f, db };
}

function frontEnd(drive: Float64Array, cfg: LinkConfig, fs: number, sat: number) {
  const m = lambertianOrder(cfg.semiAngleDeg);
  const los = losGain(
    { pos: [0, 0, cfg.heightM], normal: [0, 0, -1], m },
    { pos: [cfg.offsetM, 0, 0], normal: [0, 0, 1], area: cfg.areaMm2 * 1e-6, fovDeg: cfg.fovDeg, n: cfg.lensIndex >= 1 ? cfg.lensIndex : 0 },
  );
  // total gain including diffuse share: H_total = H_los / (1 - k)
  const H0 = los.H > 0 ? los.H / Math.max(1e-6, 1 - cfg.diffuseFraction) : 0;
  const optical = new Float64Array(drive.length);
  for (let i = 0; i < drive.length; i++) optical[i] = cfg.ledPowerW * ledTransfer(1 + drive[i], cfg.nonlinear, sat);
  const ledOut = onePole(optical, cfg.ledBandwidthMHz * 1e6, fs, cfg.ledPowerW);
  const diffuse = onePole(ledOut, 1 / (2 * Math.PI * Math.max(1e-12, cfg.rmsDelayNs * 1e-9)), fs, cfg.ledPowerW);
  const k = cfg.diffuseFraction;
  const rxOpt = new Float64Array(drive.length);
  for (let i = 0; i < drive.length; i++) rxOpt[i] = H0 * ((1 - k) * ledOut[i] + k * diffuse[i]);
  // photocurrent + noise
  const u = rng(cfg.seed);
  const g = gaussian(u);
  let meanI = 0;
  for (let i = 0; i < rxOpt.length; i++) meanI += cfg.responsivity * rxOpt[i];
  meanI /= rxOpt.length;
  const Ibg = cfg.ambientUA * 1e-6;
  const N0 = 2 * PHYS.q * (meanI + Ibg) + (cfg.tiaNoisePA * 1e-12) ** 2; // A²/Hz
  const sigmaSample = Math.sqrt((N0 * fs) / 2);
  const current = new Float64Array(drive.length);
  for (let i = 0; i < drive.length; i++) current[i] = cfg.responsivity * rxOpt[i] - meanI + sigmaSample * g();
  return { H0, optical, rxOpt, current, meanI, N0, PrW: meanI / cfg.responsivity };
}

/** Least-squares fit y ≈ a·x + b on the first n points. */
function fitGain(x: ArrayLike<number>, y: ArrayLike<number>, n: number) {
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  const N = Math.min(n, x.length, y.length);
  for (let i = 0; i < N; i++) {
    sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i];
  }
  const a = (N * sxy - sx * sy) / (N * sxx - sx * sx || 1e-30);
  const b = (sy - a * sx) / N;
  return { a: a || 1e-30, b };
}

export function simulateLink(cfg: LinkConfig): LinkResult {
  return cfg.scheme.endsWith('ofdm') ? simulateOfdm(cfg) : simulateSingleCarrier(cfg);
}

function simulateSingleCarrier(cfg: LinkConfig): LinkResult {
  const sps = 8;
  const Rs = cfg.symbolRateMHz * 1e6;
  const fs = Rs * sps;
  const nSym = 3000;
  const isPam = cfg.scheme === 'pam4';
  const bitsPerSym = isPam ? 2 : 1;
  const nBitsRaw = cfg.scheme === 'manchester' ? nSym / 2 : nSym * bitsPerSym;
  const bits = prbs(nBitsRaw, cfg.seed + 1);
  const symbols = isPam ? pamMap(bits, 4) : chipsToDrive(cfg.scheme === 'manchester' ? lineEncode(bits, 'manchester') : bits);
  const drive = upsampleHold(symbols, sps).map((v) => v * cfg.modIndex) as Float64Array;
  const fe = frontEnd(drive, cfg, fs, 2);
  const levels = isPam ? [-1, -1 / 3, 1 / 3, 1] : [-1, 1];
  const slicer = (v: number) => levels.reduce((b, l) => (Math.abs(v - l) < Math.abs(v - b) ? l : b), levels[0]);

  let wave = fe.current;
  if (cfg.equalizer === 'zf') wave = onePoleInverse(wave, cfg.ledBandwidthMHz * 1e6, fs);
  const raw = integrateDump(fe.current, sps);
  const sampled = cfg.equalizer === 'zf' ? integrateDump(wave, sps) : raw;
  const nTrain = 300;
  const fitRaw = fitGain(symbols, raw, nTrain);
  const fit = fitGain(symbols, sampled, nTrain);
  const before = Array.from(raw, (v) => (v - fitRaw.b) / fitRaw.a);
  let after = Array.from(sampled, (v) => (v - fit.b) / fit.a);
  let mse: number[] = [];
  if (cfg.equalizer === 'lms' || cfg.equalizer === 'dfe') {
    const eq = lmsEqualizer(after, symbols, slicer, {
      ff: cfg.equalizer === 'lms' ? 11 : 7,
      fb: cfg.equalizer === 'dfe' ? 3 : 0,
      mu: isPam ? 0.004 : 0.008,
      nTrain,
    });
    after = Array.from(eq.out);
    mse = eq.mseCurve;
  }
  const skip = cfg.equalizer === 'lms' || cfg.equalizer === 'dfe' ? nTrain : 20;
  const decided = after.map(slicer);
  let rxBits: Uint8Array;
  if (isPam) rxBits = pamDemap(decided, 4);
  else {
    const chips = decided.map((v) => (v > 0 ? 1 : 0));
    rxBits = cfg.scheme === 'manchester' ? lineDecode(chips, 'manchester') : Uint8Array.from(chips);
  }
  const bitSkip = Math.floor(skip * (cfg.scheme === 'manchester' ? 0.5 : bitsPerSym));
  let errors = 0;
  let n = 0;
  for (let i = bitSkip; i < Math.min(bits.length, rxBits.length); i++, n++) if (bits[i] !== rxBits[i]) errors++;
  // measured SNR from decision-point error (after equaliser)
  let es = 0, ee = 0;
  for (let i = skip; i < after.length; i++) {
    es += symbols[i] ** 2;
    ee += (after[i] - symbols[i]) ** 2;
  }
  const sigSym = fe.meanI * cfg.modIndex; // photocurrent swing amplitude
  const noiseStd = Math.sqrt((fe.N0 * Rs) / 2 / 0.6); // integrate-and-dump over 60% of symbol
  const tN = 48 * sps;
  const t = Array.from({ length: tN }, (_, i) => (i / fs) * 1e6);
  const scaleI = 1 / (fitRaw.a || 1);
  const psdTx = welchPSD(drive, fs, 512);
  const psdRx = welchPSD(fe.current, fs, 512);
  const throughput = (Rs * (cfg.scheme === 'manchester' ? 0.5 : bitsPerSym)) / 1e6;
  return {
    ok: fe.H0 > 0,
    note: fe.H0 > 0 ? undefined : 'Receiver is outside the LED beam or its field of view: no line-of-sight power.',
    fs,
    sps,
    H0: fe.H0,
    PrW: fe.PrW,
    signalCurrent: sigSym,
    noiseStd,
    snrDb: dB((sigSym * sigSym) / (noiseStd * noiseStd)),
    measuredSnrDb: dB(es / Math.max(ee, 1e-30)),
    ber: n ? errors / n : 0.5,
    errors,
    nBits: n,
    throughputMbps: throughput,
    waveforms: {
      t,
      drive: Array.from(drive.slice(0, tN)),
      optical: Array.from(fe.optical.slice(0, tN)),
      received: Array.from(fe.current.slice(0, tN), (v) => v * scaleI),
    },
    psd: { f: psdTx.f.map((x) => x / 1e6), tx: psdTx.psdDb, rx: psdRx.psdDb },
    channelResponse: responseDb(cfg, fs / 2),
    eyeBefore: eyeTraces(Array.from(fe.current, (v) => (v - fitRaw.b * 0) * scaleI), sps, 200, 40 * sps),
    eyeAfter: cfg.equalizer === 'zf' ? eyeTraces(Array.from(wave, (v) => v / (fit.a || 1)), sps, 200, 40 * sps) : null,
    decisions: { before: before.slice(skip, skip + 600), after: after.slice(skip, skip + 600), levels },
    constellation: null,
    subcarrierSnrDb: null,
    mse,
  };
}

function simulateOfdm(cfg: LinkConfig): LinkResult {
  const N = 64;
  const cp = 8;
  const sps = 4;
  const variant = cfg.scheme === 'dco-ofdm' ? 'dco' : 'aco';
  const carriers = dataCarriers(N, variant);
  const M = cfg.qam;
  const k = Math.log2(M);
  const nSym = 60; // 1 pilot + data
  const fsBase = cfg.symbolRateMHz * 1e6;
  const fs = fsBase * sps;
  const bits = prbs((nSym - 1) * carriers.length * k, cfg.seed + 2);
  const pilotBits = prbs(carriers.length * k, 999);
  const txSymbols: QamPoint[][] = [];
  const timeBlocks: Float64Array[] = [];
  for (let s = 0; s < nSym; s++) {
    const b = s === 0 ? pilotBits : bits.slice((s - 1) * carriers.length * k, s * carriers.length * k);
    const d = qamMap(b, M);
    txSymbols.push(d);
    timeBlocks.push(hermitianIfft(N, carriers, d));
  }
  // global RMS for scaling
  let p = 0, cnt = 0;
  for (const tb of timeBlocks) for (const v of tb) { p += v * v; cnt++; }
  const sigma = Math.sqrt(p / cnt) || 1;
  const serial: number[] = [];
  for (const tb of timeBlocks) {
    const withCp = [...tb.slice(N - cp), ...tb];
    for (const v of withCp) {
      // DCO: drive = x / (k σ) around bias 1 -> clips where x < -kσ.
      // ACO: clip at zero (no bias needed); scale so a 3.5σ peak still fits under LED saturation.
      // Its average optical power is therefore lower than DCO's: that is ACO's power-efficiency advantage.
      const x = variant === 'dco' ? v / (cfg.dcBiasSigma * sigma) : (0.7 * Math.max(0, v)) / sigma - 1;
      serial.push(x);
    }
  }
  const drive = upsampleHold(serial, sps);
  const fe = frontEnd(drive, cfg, fs, 2.5);
  // downsample by averaging each group of sps samples
  const rx = new Float64Array(serial.length);
  for (let i = 0; i < serial.length; i++) {
    let s = 0;
    for (let j = 0; j < sps; j++) s += fe.current[i * sps + j];
    rx[i] = s / sps;
  }
  const L = N + cp;
  const Y: QamPoint[][] = [];
  for (let s = 0; s < nSym; s++) {
    const block = rx.slice(s * L + cp, s * L + cp + N);
    const F = fftReal(block);
    Y.push(carriers.map((c) => ({ re: F.re[c], im: F.im[c] })));
  }
  // channel estimate from pilot
  const Hk = carriers.map((_, i) => {
    const x = txSymbols[0][i];
    const y = Y[0][i];
    const den = x.re * x.re + x.im * x.im || 1;
    return { re: (y.re * x.re + y.im * x.im) / den, im: (y.im * x.re - y.re * x.im) / den };
  });
  const meanGain = Hk.reduce((s, h) => s + Math.hypot(h.re, h.im), 0) / Hk.length || 1;
  const eqPts: QamPoint[] = [];
  const rawPts: QamPoint[] = [];
  const errV = new Float64Array(carriers.length);
  const sigV = new Float64Array(carriers.length);
  const rxBits: number[] = [];
  for (let s = 1; s < nSym; s++) {
    const pts: QamPoint[] = [];
    Y[s].forEach((y, i) => {
      const h = Hk[i];
      const den = h.re * h.re + h.im * h.im || 1e-30;
      const z = cfg.equalizer === 'none'
        ? { re: y.re / meanGain, im: y.im / meanGain }
        : { re: (y.re * h.re + y.im * h.im) / den, im: (y.im * h.re - y.re * h.im) / den };
      pts.push(z);
      const x = txSymbols[s][i];
      errV[i] += (z.re - x.re) ** 2 + (z.im - x.im) ** 2;
      sigV[i] += x.re ** 2 + x.im ** 2;
      if (eqPts.length < 2400) eqPts.push(z);
      if (rawPts.length < 2400) rawPts.push({ re: y.re / meanGain, im: y.im / meanGain });
    });
    rxBits.push(...qamDemap(pts, M));
  }
  let errors = 0;
  for (let i = 0; i < bits.length; i++) if (bits[i] !== rxBits[i]) errors++;
  const subSnr = Array.from(errV, (e, i) => dB(sigV[i] / Math.max(e, 1e-30)));
  const totalSig = sigV.reduce((a, b) => a + b, 0);
  const totalErr = errV.reduce((a, b) => a + b, 0);
  const tN = 3 * L * sps;
  const t = Array.from({ length: tN }, (_, i) => (i / fs) * 1e6);
  const psdTx = welchPSD(drive, fs, 512);
  const psdRx = welchPSD(fe.current, fs, 512);
  const eff = (carriers.length * k) / L;
  const scale = 1 / (fe.meanI || 1);
  const ideal: QamPoint[] = [];
  for (let v = 0; v < M; v++) ideal.push(qamMap(Array.from({ length: k }, (_, j) => (v >> (k - 1 - j)) & 1), M)[0]);
  const noiseStd = Math.sqrt((fe.N0 * fsBase) / 2);
  return {
    ok: fe.H0 > 0,
    note: fe.H0 > 0 ? undefined : 'Receiver is outside the LED beam or its field of view: no line-of-sight power.',
    fs,
    sps,
    H0: fe.H0,
    PrW: fe.PrW,
    signalCurrent: fe.meanI,
    noiseStd,
    snrDb: dB(variance(Array.from(fe.rxOpt, (v) => v * cfg.responsivity)) / noiseStd ** 2),
    measuredSnrDb: dB(totalSig / Math.max(totalErr, 1e-30)),
    ber: errors / bits.length,
    errors,
    nBits: bits.length,
    throughputMbps: (eff * fsBase) / 1e6,
    waveforms: {
      t,
      drive: Array.from(drive.slice(0, tN)),
      optical: Array.from(fe.optical.slice(0, tN)),
      received: Array.from(fe.current.slice(0, tN), (v) => v * scale),
    },
    psd: { f: psdTx.f.map((x) => x / 1e6), tx: psdTx.psdDb, rx: psdRx.psdDb },
    channelResponse: responseDb(cfg, fsBase / 2),
    eyeBefore: [],
    eyeAfter: null,
    decisions: { before: [], after: [], levels: [] },
    constellation: { raw: rawPts, eq: eqPts, ideal },
    subcarrierSnrDb: { f: carriers.map((c) => (c * fsBase) / N / 1e6), snr: subSnr },
    mse: [],
  };
}
