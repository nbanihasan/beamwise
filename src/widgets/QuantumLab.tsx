import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Toggle, Widget } from '@/viz/controls';
import { rng } from '@/sim/math';

/**
 * Two quantum optical links in one figure.
 * BB84: Alice sends single photons in random bases; Bob measures in random bases; they keep matching bases.
 *       An intercept-resend eavesdropper raises the error rate (QBER) to ~25 %, which they detect.
 * Entanglement: polarization-entangled pairs |HH>+|VV>, measured at angles a and b. Correlation
 *       E = cos 2(a-b) beats any local-hidden-variable model; the CHSH value S reaches 2√2 > 2.
 */
const ARROW: Record<string, string> = { '+0': '↔', '+1': '↕', 'x0': '⤢', 'x1': '⤡' };
const h2 = (p: number) => (p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p));

interface Row {
  a: number;
  ab: '+' | 'x';
  eve?: '+' | 'x';
  bb: '+' | 'x';
  b: number | null;
}

function bb84(n: number, eve: boolean, noise: number, loss: number, seed: number) {
  const u = rng(seed);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const a = u() < 0.5 ? 0 : 1;
    const ab = u() < 0.5 ? '+' : 'x';
    let bitIn = a;
    let basisIn: '+' | 'x' = ab;
    let ev: '+' | 'x' | undefined;
    if (eve) {
      ev = u() < 0.5 ? '+' : 'x';
      if (ev !== basisIn) bitIn = u() < 0.5 ? 0 : 1; // wrong basis: random outcome, resends in her basis
      basisIn = ev;
    }
    const bb = u() < 0.5 ? '+' : 'x';
    let b: number | null = bb === basisIn ? bitIn : u() < 0.5 ? 0 : 1;
    if (b !== null && u() < noise) b = 1 - b;
    if (u() < loss) b = null;
    rows.push({ a, ab, eve: ev, bb, b });
  }
  return rows;
}

function Bb84() {
  const [eve, setEve] = useState(false);
  const [noise, setNoise] = useState(0.02);
  const [loss, setLoss] = useState(0.3);
  const [seed, setSeed] = useState(3);
  const rows = useMemo(() => bb84(4000, eve, noise, loss, seed), [eve, noise, loss, seed]);
  const shown = rows.slice(0, 14);
  const sifted = rows.filter((r) => r.b !== null && r.ab === r.bb);
  const errs = sifted.filter((r) => r.a !== r.b).length;
  const qber = errs / Math.max(1, sifted.length);
  const secret = Math.max(0, 1 - 2 * h2(qber));
  return (
    <>
      <div className="qk-wrap">
        <table className="qk-table">
          <thead>
            <tr>
              <th>Alice bit</th>
              <th>Alice basis</th>
              <th>photon</th>
              {eve && <th>Eve basis</th>}
              <th>Bob basis</th>
              <th>Bob bit</th>
              <th>keep?</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const keep = r.b !== null && r.ab === r.bb;
              const bad = keep && r.a !== r.b;
              return (
                <tr key={i} className={keep ? (bad ? 'bad' : 'keep') : 'drop'}>
                  <td className="mono">{r.a}</td>
                  <td className="mono">{r.ab}</td>
                  <td className="qk-ph">{ARROW[r.ab + r.a]}</td>
                  {eve && <td className="mono">{r.eve}</td>}
                  <td className="mono">{r.bb}</td>
                  <td className="mono">{r.b === null ? 'lost' : r.b}</td>
                  <td>{keep ? (bad ? 'error' : 'key') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="qk-ctl">
        <Toggle label="Eavesdropper (intercept-resend)" checked={eve} onChange={setEve} />
        <Slider label="Channel error rate" value={noise} min={0} max={0.15} step={0.005} onChange={setNoise} format={(v) => `${(v * 100).toFixed(1)} %`} />
        <Slider label="Photon loss" value={loss} min={0} max={0.99} step={0.01} onChange={setLoss} format={(v) => `${(v * 100).toFixed(0)} %`} />
        <button type="button" className="btn small" onClick={() => setSeed(seed + 1)}>
          New photons
        </button>
      </div>
      <Readouts>
        <Readout k="Photons sent" v={rows.length} />
        <Readout k="Sifted key bits" v={`${sifted.length} (${((sifted.length / rows.length) * 100).toFixed(0)} %)`} />
        <Readout k="QBER" v={`${(qber * 100).toFixed(1)} %`} tone={qber < 0.08 ? 'good' : qber < 0.11 ? 'warn' : 'bad'} />
        <Readout k="Secret fraction 1 − 2h(Q)" v={secret > 0 ? `${(secret * 100).toFixed(0)} %` : 'abort: no secure key'} tone={secret > 0 ? 'good' : 'bad'} />
      </Readouts>
    </>
  );
}

function Entangle() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(22.5);
  const [vis, setVis] = useState(1);
  const r = (d: number) => (d * Math.PI) / 180;
  const E = (x: number, y: number) => vis * Math.cos(2 * r(x - y));
  // CHSH with Alice {a, a+45}, Bob {b, b+45}
  const a2 = a + 45;
  const b2 = b + 45;
  const S = Math.abs(E(a, b) - E(a, b2) + E(a2, b) + E(a2, b2));
  const dx = Array.from({ length: 181 }, (_, i) => i - 90);
  const q = dx.map((d) => vis * Math.cos(2 * r(d)));
  // the classic local model that reproduces perfect correlation at a = b: linear in |a − b|
  const lhvW = dx.map((d) => 1 - Math.abs(d) / 45);
  return (
    <>
      <Plot
        height={200}
        title="Correlation of the two detectors"
        xLabel="a − b (degrees)"
        yLabel="E"
        x={[-90, 90]}
        y={[-1.05, 1.05]}
        legend
        series={[
          { x: dx, y: lhvW, color: 'var(--text-3)', dash: [5, 4], label: 'best local hidden-variable model' },
          { x: dx, y: q, color: 'var(--c5)', width: 2.2, label: 'quantum, entangled pair' },
        ]}
        points={[{ x: Math.max(-90, Math.min(90, a - b)), y: E(a, b), color: 'var(--phosphor)', r: 5 }]}
      />
      <div className="qk-ctl">
        <Slider label="Alice's polarizer a" value={a} min={0} max={90} step={0.5} unit="°" onChange={setA} />
        <Slider label="Bob's polarizer b" value={b} min={0} max={90} step={0.5} unit="°" onChange={setB} />
        <Slider label="Visibility (noise, multi-pair)" value={vis} min={0.5} max={1} step={0.01} onChange={setVis} format={(v) => `${(v * 100).toFixed(0)} %`} />
      </div>
      <Readouts>
        <Readout k="E(a, b)" v={E(a, b).toFixed(3)} />
        <Readout k="CHSH S with a, a+45°, b, b+45°" v={S.toFixed(3)} tone={S > 2 ? 'good' : 'bad'} />
        <Readout k="Verdict" v={S > 2 ? 'violates Bell: entangled, eavesdropper-free' : 'no violation: no device-independent security'} tone={S > 2 ? 'good' : 'bad'} />
      </Readouts>
    </>
  );
}

export default function QuantumLab() {
  const [tab, setTab] = useState<'bb84' | 'ent'>('bb84');
  return (
    <Widget
      title={tab === 'bb84' ? 'BB84: a key that reveals spies' : 'Entangled photons and the Bell test'}
      eyebrow="Interactive · quantum optics"
      caption={
        tab === 'bb84' ? (
          <p>
            Each photon carries one bit in one of two polarization bases: + (↔ = 0, ↕ = 1) or × (⤢ = 0, ⤡ = 1). Bob guesses a basis; when it matches Alice's (about half the time) he reads the bit
            exactly, and they publicly compare bases, never bits. An eavesdropper must also guess, and every wrong guess disturbs the photon, so she pushes the error rate to about 25 %. Above about 11 %
            no secret key can be distilled and Alice and Bob abort. Loss only shrinks the key; it never leaks it.
          </p>
        ) : (
          <p>
            A source emits photon pairs in the state (|HH⟩ + |VV⟩)/√2. Each photon alone is perfectly random, yet their outcomes are correlated as cos 2(a − b), more strongly than any pre-agreed
            classical strategy allows. Set b = 22.5° with a = 0° for the maximum CHSH value 2√2 ≈ 2.83. Ekert's 1991 protocol uses this violation as a certificate that nobody else holds a copy of the key;
            the Micius satellite did it over 1,120 km.
          </p>
        )
      }
    >
      <Segmented value={tab} options={[{ value: 'bb84', label: 'BB84 key distribution' }, { value: 'ent', label: 'Entanglement (E91 / CHSH)' }]} onChange={setTab} />
      {tab === 'bb84' ? <Bb84 /> : <Entangle />}
    </Widget>
  );
}
