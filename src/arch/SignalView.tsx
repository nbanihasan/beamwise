import { useEffect, useRef } from 'react';
import type { ChainSignals } from './chain';
import { CHAIN_SPS } from './chain';

/**
 * Small canvas renderer for "the signal at this point" in the system view. Always drawn on the dark
 * glass panel, so it uses a fixed palette rather than theme tokens.
 */
const C = {
  grid: 'rgba(255,255,255,0.07)',
  axis: 'rgba(255,255,255,0.25)',
  text: 'rgba(244,244,246,0.7)',
  one: '#f4f4f6',
  zero: 'rgba(255,255,255,0.1)',
  parity: '#ffd27a',
  bad: '#ff6f86',
  good: '#5ee0a8',
  wave: '#8fd3ff',
  wave2: '#ffd27a',
  light: '#ffe08a',
};

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

function bitsRow(bits: number[], color: (i: number) => string | null, label?: (i: number) => string | null): Draw {
  return (g, w, h) => {
    const n = bits.length;
    const per = Math.min(28, Math.floor(w / Math.min(n, 28)));
    const rows = Math.ceil(n / Math.floor(w / per));
    const cols = Math.floor(w / per);
    const cell = Math.min(per, Math.floor((h - 4) / rows));
    for (let i = 0; i < n; i++) {
      const x = (i % cols) * cell;
      const y = Math.floor(i / cols) * cell;
      const c = color(i);
      g.fillStyle = c ?? (bits[i] ? C.one : C.zero);
      g.beginPath();
      g.roundRect(x + 1.5, y + 1.5, cell - 3, cell - 3, 3);
      g.fill();
      g.fillStyle = bits[i] && !c ? '#050507' : 'rgba(244,244,246,0.85)';
      g.font = `${Math.round(cell * 0.42)}px Geist Mono, monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label?.(i) ?? String(bits[i]), x + cell / 2, y + cell / 2 + 1);
    }
  };
}

function wave(ys: number[][], colors: string[], opts: { thresh?: number; fill?: boolean; stems?: boolean; dots?: number[] } = {}): Draw {
  return (g, w, h) => {
    const all = ys.flat();
    let lo = Math.min(...all, opts.thresh ?? Infinity);
    let hi = Math.max(...all, opts.thresh ?? -Infinity);
    const pad = (hi - lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
    const X = (i: number, n: number) => (i / Math.max(1, n - 1)) * (w - 4) + 2;
    const Y = (v: number) => h - 4 - ((v - lo) / (hi - lo)) * (h - 8);
    g.strokeStyle = C.grid;
    g.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo(0, (h * k) / 4);
      g.lineTo(w, (h * k) / 4);
      g.stroke();
    }
    if (opts.thresh !== undefined) {
      g.strokeStyle = 'rgba(255,210,122,0.6)';
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(0, Y(opts.thresh));
      g.lineTo(w, Y(opts.thresh));
      g.stroke();
      g.setLineDash([]);
    }
    ys.forEach((y, s) => {
      g.strokeStyle = colors[s % colors.length];
      g.fillStyle = colors[s % colors.length];
      g.lineWidth = 1.6;
      if (opts.stems) {
        y.forEach((v, i) => {
          const x = X(i, y.length);
          g.globalAlpha = 0.5;
          g.beginPath();
          g.moveTo(x, Y(lo + pad));
          g.lineTo(x, Y(v));
          g.stroke();
          g.globalAlpha = 1;
          g.fillStyle = opts.dots?.includes(i) ? C.bad : colors[s % colors.length];
          g.beginPath();
          g.arc(x, Y(v), opts.dots?.includes(i) ? 3.4 : 2.2, 0, Math.PI * 2);
          g.fill();
        });
        return;
      }
      g.beginPath();
      y.forEach((v, i) => (i ? g.lineTo(X(i, y.length), Y(v)) : g.moveTo(X(i, y.length), Y(v))));
      g.stroke();
      if (opts.fill && s === 0) {
        g.lineTo(X(y.length - 1, y.length), h);
        g.lineTo(X(0, y.length), h);
        g.closePath();
        g.globalAlpha = 0.12;
        g.fill();
        g.globalAlpha = 1;
      }
    });
  };
}

function eye(traces: number[][], color: string): Draw {
  return (g, w, h) => {
    const all = traces.flat();
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const n = traces[0]?.length ?? 1;
    const X = (i: number) => (i / (n - 1)) * w;
    const Y = (v: number) => h - 6 - ((v - lo) / (hi - lo || 1)) * (h - 12);
    g.strokeStyle = color;
    g.globalAlpha = 0.28;
    g.lineWidth = 1.2;
    for (const t of traces) {
      g.beginPath();
      t.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
      g.stroke();
    }
    g.globalAlpha = 1;
    // sampling instant
    const xs = X(CHAIN_SPS / 2 + Math.floor(CHAIN_SPS * 0.75));
    g.strokeStyle = C.parity;
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(xs, 0);
    g.lineTo(xs, h);
    g.stroke();
    g.setLineDash([]);
  };
}

function text(main: string, sub: string, color = C.one): Draw {
  return (g, _w, h) => {
    g.fillStyle = color;
    g.font = `500 ${Math.min(64, h * 0.6)}px Geist, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(`“${main}”`, 4, h * 0.42);
    g.fillStyle = C.text;
    g.font = `12px Geist Mono, monospace`;
    g.fillText(sub, 6, h * 0.86);
  };
}

const span = (x: number[], a: number, b: number) => x.slice(a * CHAIN_SPS, b * CHAIN_SPS);

export function describeSignal(key: string, s: ChainSignals): { title: string; draw: Draw; legend?: string } {
  switch (key) {
    case 'bits':
      return { title: 'Message bits (ASCII)', draw: bitsRow(s.bits, () => null), legend: `"${s.text}" → ${s.bits.length} bits` };
    case 'coded':
      return { title: 'Codewords: data + parity', draw: bitsRow(s.coded, (i) => (s.parityMask[i] ? C.parity : null)), legend: `${s.coded.length} coded bits · amber = parity (rate 4/7)` };
    case 'interleaved':
      return { title: 'Interleaved order (4 × 7 block)', draw: bitsRow(s.interleaved, () => null), legend: 'Same bits, new order: neighbours now come from different codewords' };
    case 'chips':
      return { title: 'Manchester chips (first 24)', draw: wave([s.chips.slice(0, 24).flatMap((c) => [c, c])], [C.one]), legend: '1 → on·off, 0 → off·on: a transition in every bit, 50 % average' };
    case 'levels':
      return { title: 'OOK symbol amplitudes', draw: wave([s.levels.slice(0, 36)], [C.wave], { stems: true }), legend: 'One amplitude per chip' };
    case 'dac':
      return { title: 'Shaped drive waveform', draw: wave([span(s.dac, 0, 20)], [C.wave], { fill: true }), legend: 'Edges rounded to save bandwidth' };
    case 'driveMa':
      return { title: 'LED current (mA)', draw: wave([span(s.driveMa, 0, 20)], [C.wave2], { thresh: 350, fill: true }), legend: 'Bias 350 mA (dashed) ± signal' };
    case 'optical':
      return { title: 'Optical power out of the LED', draw: wave([span(s.dac, 0, 20), span(s.optical, 0, 20)], ['rgba(143,211,255,0.35)', C.light], { fill: false }), legend: 'Blue: drive · Yellow: light (slow phosphor rounds and lags the edges)' };
    case 'received':
      return { title: 'Power at the receiver', draw: wave([span(s.received, 14, 30)], [C.light], { fill: true }), legend: 'Large ambient DC level + interference burst on chips 21–24' };
    case 'ambientFiltered':
      return { title: 'After the optical filter', draw: wave([span(s.received, 14, 30), span(s.ambientFiltered, 14, 30)], ['rgba(255,224,138,0.3)', C.light]), legend: 'Most of the ambient light is rejected (signal shown bright)' };
    case 'photocurrent':
      return { title: 'Photocurrent (with shot noise)', draw: wave([span(s.photocurrent, 0, 20)], [C.good]), legend: 'i = R·P + noise' };
    case 'tia':
      return { title: 'TIA output voltage', draw: wave([span(s.tia, 0, 20)], [C.good], { fill: true }), legend: 'Amplified, slightly band-limited, plus thermal noise' };
    case 'adc':
      return { title: 'ADC samples (4-bit codes)', draw: wave([s.adc.v.slice(0, 60)], [C.good], { stems: true }), legend: '3 samples per chip, 16 levels' };
    case 'eye':
      return { title: 'Eye diagram before equalisation', draw: eye(s.eye, C.good), legend: 'Dashed: chosen sampling instant' };
    case 'eyeEq':
      return { title: 'Eye diagram after equalisation', draw: eye(s.eyeEq, C.wave), legend: 'The tail of each previous chip is removed: wider opening' };
    case 'soft': {
      const thr = (Math.max(...s.softEq) + Math.min(...s.softEq)) / 2;
      return { title: 'Decisions vs threshold', draw: wave([s.softEq.slice(0, 36)], [C.wave], { stems: true, thresh: thr, dots: s.chipErrors.filter((i) => i < 36) }), legend: 'Red dots: chips hit by the interference burst' };
    }
    case 'rxCoded':
      return {
        title: 'De-interleaved bits',
        draw: bitsRow(s.rxCoded, (i) => (s.rxErrorsBeforeFec.includes(i) ? C.bad : null)),
        legend: `Errors at positions ${s.rxErrorsBeforeFec.join(', ')}: codewords ${s.rxErrorsBeforeFec.map((i) => Math.floor(i / 7) + 1).join(' and ')}, one each`,
      };
    case 'decoded':
      return {
        title: 'Corrected codewords',
        draw: bitsRow(s.rxCoded.map((b, i) => (s.corrected.includes(i) ? b ^ 1 : b)), (i) => (s.corrected.includes(i) ? C.good : null)),
        legend: `${s.corrected.length} bits flipped back by the syndrome decoder`,
      };
    case 'text':
      return { title: 'Delivered message', draw: text(s.rxText, `${s.rxBits.length} bits · ${s.rxText === s.text ? 'no residual errors' : 'errors remain'}`, s.rxText === s.text ? C.good : C.bad) };
    default:
      return { title: '', draw: () => {} };
  }
}

export function SignalView({ draw, height = 120 }: { draw: Draw; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      c.width = w * dpr;
      c.height = height * dpr;
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, height);
      draw(g, w, height);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [draw, height]);
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}
