import { useEffect, useMemo, useRef, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { GroupTitle, Readout, Readouts, Slider, Widget } from '@/viz/controls';
import { bitErrors, dotp, leastSquares, linFeatures, Mlp, pam4LedChannel, stats, volterraFeatures, windowAt } from '@/sim/neural';
import { sci } from '@/sim/math';

/**
 * Neural-network equalisation, trained live in the browser. A PAM-4 signal passes through a
 * compressive, band-limited LED; five receivers compete on fresh test symbols:
 * fixed thresholds, linear least-squares FIR, DFE, 2nd/3rd-order Volterra and an MLP classifier.
 */
const TAPS = 7;
const N_TRAIN = 3000;
const N_TEST = 6000;

type Method = 'thr' | 'lin' | 'dfe' | 'vol' | 'mlp';
const LABEL: Record<Method, string> = { thr: 'Threshold', lin: 'Linear FIR', dfe: 'DFE', vol: 'Volterra', mlp: 'Neural net' };
const COLOR: Record<Method, string> = { thr: 'var(--text-3)', lin: 'var(--c1)', dfe: 'var(--c6)', vol: 'var(--c5)', mlp: 'var(--c2)' };

function NetDiagram({ net, act }: { net: Mlp; act: number[] }) {
  const W = 300;
  const H = 210;
  const col = (n: number, x: number) => Array.from({ length: n }, (_, i) => ({ x, y: 14 + ((i + 0.5) / n) * (H - 28) }));
  const inp = col(net.nIn, 24);
  const hid = col(net.nHid, W / 2);
  const out = col(net.nOut, W - 24);
  const maxW1 = Math.max(...Array.from(net.W1, Math.abs), 1e-6);
  const maxW2 = Math.max(...Array.from(net.W2, Math.abs), 1e-6);
  const { h, p } = net.forward(act);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Neural network weights">
      {hid.map((hn, j) =>
        inp.map((ip, i) => {
          const w = net.W1[j * net.nIn + i];
          return <line key={`a${i}-${j}`} x1={ip.x} y1={ip.y} x2={hn.x} y2={hn.y} stroke={w > 0 ? 'var(--c1)' : 'var(--c4)'} strokeOpacity={0.08 + 0.7 * (Math.abs(w) / maxW1)} strokeWidth={0.4 + 1.6 * (Math.abs(w) / maxW1)} />;
        }),
      )}
      {out.map((on, k) =>
        hid.map((hn, j) => {
          const w = net.W2[k * net.nHid + j];
          return <line key={`b${j}-${k}`} x1={hn.x} y1={hn.y} x2={on.x} y2={on.y} stroke={w > 0 ? 'var(--c1)' : 'var(--c4)'} strokeOpacity={0.08 + 0.7 * (Math.abs(w) / maxW2)} strokeWidth={0.4 + 1.6 * (Math.abs(w) / maxW2)} />;
        }),
      )}
      {inp.map((n, i) => (
        <circle key={`i${i}`} cx={n.x} cy={n.y} r={7} fill={`color-mix(in srgb, var(--c6) ${Math.round(50 + 45 * Math.tanh(act[i]))}%, var(--surface-3))`} stroke="var(--line-strong)" />
      ))}
      {hid.map((n, j) => (
        <circle key={`h${j}`} cx={n.x} cy={n.y} r={5.5} fill={`color-mix(in srgb, var(--c2) ${Math.round(50 + 50 * h[j])}%, var(--surface-3))`} stroke="var(--line-strong)" />
      ))}
      {out.map((n, k) => (
        <g key={`o${k}`}>
          <circle cx={n.x} cy={n.y} r={9} fill={`color-mix(in srgb, var(--good) ${Math.round(100 * p[k])}%, var(--surface-3))`} stroke="var(--line-strong)" />
          <text x={n.x - 16} y={n.y + 4} fontSize="10" textAnchor="end" fill="var(--text-3)" fontFamily="var(--font-mono)">
            {k}
          </text>
        </g>
      ))}
      <text x={24} y={H - 1} fontSize="9" textAnchor="middle" fill="var(--text-3)">
        7 samples
      </text>
      <text x={W / 2} y={H - 1} fontSize="9" textAnchor="middle" fill="var(--text-3)">
        hidden (tanh)
      </text>
      <text x={W - 24} y={H - 1} fontSize="9" textAnchor="middle" fill="var(--text-3)">
        PAM-4 symbol
      </text>
    </svg>
  );
}

export default function NeuralEqualizer() {
  const [bw, setBw] = useState(0.35);
  const [nl, setNl] = useState(1.8);
  const [snr, setSnr] = useState(24);
  const [hidden, setHidden] = useState(12);
  const [show, setShow] = useState<Method>('mlp');
  const [epochs, setEpochs] = useState(0);
  const [losses, setLosses] = useState<number[]>([]);
  const [training, setTraining] = useState(false);
  const netRef = useRef<Mlp | null>(null);

  const data = useMemo(() => {
    const train = pam4LedChannel({ n: N_TRAIN, bwRatio: bw, nonlin: nl, snrDb: snr, seed: 3 });
    const test = pam4LedChannel({ n: N_TEST, bwRatio: bw, nonlin: nl, snrDb: snr, seed: 99 });
    const st = stats(train.rx);
    const Xtr = Array.from(train.rx, (_, i) => windowAt(train.rx, i, TAPS, st.mean, st.std));
    const Xte = Array.from(test.rx, (_, i) => windowAt(test.rx, i, TAPS, st.mean, st.std));
    return { train, test, st, Xtr, Xte, ytr: Array.from(train.sym), yte: Array.from(test.sym) };
  }, [bw, nl, snr]);

  // classical equalisers: closed-form least squares
  const classical = useMemo(() => {
    const { Xtr, Xte, ytr, yte, train, test, st } = data;
    const slice = (v: number) => Math.max(0, Math.min(3, Math.round(v)));
    const res: Record<string, { out: number[]; dec: number[] }> = {};
    // thresholds from class means of the raw sample (no equaliser)
    const means = [0, 1, 2, 3].map((k) => {
      let s = 0;
      let c = 0;
      ytr.forEach((y, i) => y === k && ((s += (train.rx[i] - st.mean) / st.std), c++));
      return s / Math.max(1, c);
    });
    const rawDec = (v: number) => means.reduce((best, m, k) => (Math.abs(v - m) < Math.abs(v - means[best]) ? k : best), 0);
    res.thr = { out: Array.from(test.rx, (v) => (v - st.mean) / st.std), dec: Array.from(test.rx, (v) => rawDec((v - st.mean) / st.std)) };
    const wl = leastSquares(Xtr.map(linFeatures), ytr);
    const lo = Xte.map((x) => dotp(wl, linFeatures(x)));
    res.lin = { out: lo, dec: lo.map(slice) };
    const dfeF = (x: number[], p1: number, p2: number) => [...linFeatures(x), p1, p2];
    const wd = leastSquares(
      Xtr.map((x, i) => dfeF(x, ytr[i - 1] ?? 0, ytr[i - 2] ?? 0)),
      ytr,
    );
    const dOut: number[] = [];
    const dDec: number[] = [];
    for (let i = 0; i < Xte.length; i++) {
      const v = dotp(wd, dfeF(Xte[i], dDec[i - 1] ?? 0, dDec[i - 2] ?? 0));
      dOut.push(v);
      dDec.push(slice(v));
    }
    res.dfe = { out: dOut, dec: dDec };
    const wv = leastSquares(Xtr.map(volterraFeatures), ytr);
    const vo = Xte.map((x) => dotp(wv, volterraFeatures(x)));
    res.vol = { out: vo, dec: vo.map(slice) };
    void yte;
    return res;
  }, [data]);

  const epRef = useRef(0);
  const seedRef = useRef(5);
  const reset = () => {
    netRef.current = new Mlp(TAPS, hidden, 4, seedRef.current++);
    epRef.current = 0;
    setEpochs(0);
    setLosses([]);
  };
  // (re)initialise the network when the channel or size changes
  useEffect(() => {
    reset();
    setTraining(true);
  }, [data, hidden]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!training) return;
    let timer = 0;
    const step = () => {
      const net = netRef.current;
      if (!net) return;
      const l = net.epoch(data.Xtr, data.ytr, 0.01, 32, epRef.current);
      epRef.current++;
      setEpochs(epRef.current);
      setLosses((ls) => [...ls, l]);
      if (epRef.current >= 60) {
        setTraining(false);
        return;
      }
      timer = window.setTimeout(step, 16);
    };
    timer = window.setTimeout(step, 16);
    return () => clearTimeout(timer);
  }, [training, data]);

  const toggleTraining = () => {
    if (training) setTraining(false);
    else {
      if (epRef.current >= 60) reset();
      setTraining(true);
    }
  };

  const mlpRes = useMemo(() => {
    const net = netRef.current;
    if (!net) return { out: [] as number[], dec: [] as number[] };
    const dec = data.Xte.map((x) => net.predict(x));
    const out = data.Xte.map((x) => {
      const { p } = net.forward(x);
      return p[1] + 2 * p[2] + 3 * p[3];
    });
    return { out, dec };
  }, [epochs, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const all: Record<Method, { out: number[]; dec: number[] }> = { ...(classical as Record<'thr' | 'lin' | 'dfe' | 'vol', { out: number[]; dec: number[] }>), mlp: mlpRes };
  const ber = (m: Method) => {
    const d = all[m].dec;
    if (!d.length) return NaN;
    let e = 0;
    for (let i = 0; i < d.length; i++) e += bitErrors(d[i], data.yte[i]);
    return e / (2 * d.length);
  };
  const methods: Method[] = ['thr', 'lin', 'dfe', 'vol', 'mlp'];
  const bers = methods.map(ber);
  const shown = all[show];
  const n = 600;
  const idx = Array.from({ length: n }, (_, i) => i);
  const colors = ['var(--c4)', 'var(--c2)', 'var(--c3)', 'var(--c1)'];

  const controls = (
    <>
      <GroupTitle>LED channel</GroupTitle>
      <Slider label="LED bandwidth / symbol rate" value={bw} min={0.08} max={1} step={0.01} onChange={setBw} />
      <Slider label="LED non-linearity" value={nl} min={0.05} max={3.5} step={0.05} onChange={setNl} />
      <Slider label="SNR" value={snr} min={10} max={36} step={0.5} unit="dB" onChange={setSnr} />
      <GroupTitle>Network</GroupTitle>
      <Slider label="Hidden neurons" value={hidden} min={2} max={24} step={1} onChange={(v) => setHidden(Math.round(v))} />
      <button type="button" className="btn small" onClick={toggleTraining}>
        {training ? 'Pause training' : epochs >= 60 ? 'Retrain from scratch' : 'Resume training'}
      </button>
      <Readouts>
        {methods.map((m, i) => (
          <Readout key={m} k={<button type="button" className={`linkish ${show === m ? 'on' : ''}`} onClick={() => setShow(m)}>{LABEL[m]} BER</button>} v={isNaN(bers[i]) ? '—' : bers[i] === 0 ? `< ${sci(1 / (2 * N_TEST), 0)}` : sci(bers[i], 1)} tone={bers[i] < 1e-3 ? 'good' : bers[i] < 2e-2 ? 'warn' : 'bad'} />
        ))}
      </Readouts>
    </>
  );

  return (
    <Widget
      title="A neural-network equaliser, trained in your browser"
      eyebrow="Live training · MLP"
      controls={controls}
      caption={
        <p>
          The LED compresses the top PAM-4 levels (non-linearity) and smears each symbol into the next (bandwidth). Linear filters can undo the smear but not the compression; Volterra adds
          polynomial terms; the neural net learns any smooth non-linear decision boundary from {N_TRAIN.toLocaleString()} training symbols. Every method is tested on {N_TEST.toLocaleString()} fresh
          symbols. Click a BER label to see that method's output.
        </p>
      }
    >
      <div className="grid-2">
        <div>
          <div className="plot-title">
            <span>Network · epoch {epochs}</span>
            <span>{training ? 'training…' : 'done'}</span>
          </div>
          {netRef.current && <NetDiagram net={netRef.current} act={data.Xte[17] ?? new Array(TAPS).fill(0)} />}
          <Plot title="Training loss (cross-entropy)" series={[{ y: losses.length ? losses : [0], color: 'var(--c2)' }]} height={110} xLabel="epoch" />
        </div>
        <div>
          <Plot
            title={`${LABEL[show]} output, coloured by true symbol`}
            series={[0, 1, 2, 3].map((k) => ({
              x: idx.filter((i) => data.yte[i] === k),
              y: idx.filter((i) => data.yte[i] === k).map((i) => shown.out[i] ?? 0),
              kind: 'scatter' as const,
              color: colors[k],
              size: 2,
            }))}
            height={200}
            xLabel="test symbol"
          />
          <Plot
            title="Bit error rate on test data"
            series={[{ x: methods.map((_, i) => i), y: bers.map((b) => Math.max(1e-5, isNaN(b) ? 1e-5 : b)), kind: 'stem', color: 'var(--c2)' }]}
            points={methods.map((m, i) => ({ x: i, y: Math.max(1e-5, isNaN(bers[i]) ? 1e-5 : bers[i]), color: COLOR[m], r: 5, label: LABEL[m] }))}
            logY
            y={[1e-5, 0.5]}
            x={[-0.5, 4.5]}
            xTicks={[]}
            height={150}
          />
        </div>
      </div>
    </Widget>
  );
}
