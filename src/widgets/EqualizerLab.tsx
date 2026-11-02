import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Widget, berTone } from '@/viz/controls';
import { DEFAULT_LINK, simulateLink, type EqMode } from '@/sim/linkSim';
import { sci } from '@/sim/math';

/** Equalisation of a band-limited LED link: none vs zero-forcing vs adaptive LMS vs decision feedback. */
const MODES: { id: EqMode; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'zf', label: 'Zero-forcing' },
  { id: 'lms', label: 'LMS (linear)' },
  { id: 'dfe', label: 'DFE' },
];

export default function EqualizerLab() {
  const [rate, setRate] = useState(60);
  const [ledBw, setLedBw] = useState(12);
  const [amb, setAmb] = useState(20);
  const [mode, setMode] = useState<EqMode>('dfe');
  const [scheme, setScheme] = useState<'ook' | 'pam4'>('ook');
  const base = { ...DEFAULT_LINK, scheme, symbolRateMHz: rate, ledBandwidthMHz: ledBw, ambientUA: amb, rmsDelayNs: 3, diffuseFraction: 0.12 };
  const all = useMemo(() => MODES.map((m) => simulateLink({ ...base, equalizer: m.id })), [rate, ledBw, amb, scheme]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = all[MODES.findIndex((m) => m.id === mode)];
  const idx = r.decisions.after.map((_, i) => i);
  const lv = r.decisions.levels;

  return (
    <Widget
      title="Equalising a slow LED"
      controls={
        <>
          <Segmented label="Modulation" value={scheme} onChange={setScheme} options={[{ value: 'ook', label: 'OOK' }, { value: 'pam4', label: '4-PAM' }]} />
          <Slider label="Symbol rate" value={rate} min={5} max={150} step={1} onChange={setRate} format={(v) => `${v} MBd`} />
          <Slider label="LED bandwidth" value={ledBw} min={3} max={60} step={1} onChange={setLedBw} format={(v) => `${v} MHz`} />
          <Slider label="Ambient photocurrent" value={amb} min={1} max={2000} log onChange={setAmb} format={(v) => `${v.toFixed(0)} µA`} />
          <Segmented label="Equaliser" value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} />
          <Readouts>
            {MODES.map((m, i) => (
              <Readout key={m.id} k={`BER · ${m.label}`} v={all[i].ber === 0 ? `< ${sci(1 / all[i].nBits, 0)}` : sci(all[i].ber, 1)} tone={berTone(all[i].ber)} />
            ))}
          </Readouts>
        </>
      }
      caption={
        <p>
          Push the symbol rate well past the LED bandwidth and the eye closes. A <strong>zero-forcing</strong> inverse filter undoes the LED's pole exactly, but boosts
          high-frequency noise. An adaptive <strong>LMS</strong> equaliser learns its taps from a training sequence and balances ISI against noise (an MMSE solution). A
          <strong> decision-feedback</strong> equaliser subtracts the tail of past symbols using its own decisions, with no noise boost. Raise the ambient light to see
          noise enhancement hurt zero-forcing first.
        </p>
      }
    >
      <div className="grid-2">
        <Plot title="Eye before equalisation" height={190} traces={r.eyeBefore} traceColor="var(--c6)" hideYTicks />
        {r.eyeAfter ? (
          <Plot title="Eye after zero-forcing filter" height={190} traces={r.eyeAfter} traceColor="var(--phosphor)" hideYTicks />
        ) : (
          <Plot
            title={mode === 'none' ? 'Decision samples (no equaliser)' : 'Decision samples after equaliser'}
            height={190}
            y={[-2, 2]}
            series={[{ x: idx, y: r.decisions.after, kind: 'scatter', color: 'var(--phosphor)', size: 1.3 }]}
            hlines={lv.slice(0, -1).map((l, i) => ({ y: (l + lv[i + 1]) / 2, color: 'var(--text-3)' }))}
            hideYTicks
          />
        )}
      </div>
      <div className="grid-2">
        <Plot
          title="Decision samples before (raw)"
          height={150}
          y={[-2, 2]}
          series={[{ x: r.decisions.before.map((_, i) => i), y: r.decisions.before, kind: 'scatter', color: 'var(--c6)', size: 1.3 }]}
          hlines={lv.slice(0, -1).map((l, i) => ({ y: (l + lv[i + 1]) / 2, color: 'var(--text-3)' }))}
          hideYTicks
        />
        <Plot
          title={r.mse.length ? 'LMS learning curve (MSE)' : 'Channel response (LED + multipath)'}
          height={150}
          logY={!!r.mse.length}
          series={r.mse.length ? [{ y: r.mse, color: 'var(--c3)', width: 1.6 }] : [{ x: r.channelResponse.f, y: r.channelResponse.db, color: 'var(--c3)', width: 1.6 }]}
          xLabel={r.mse.length ? 'block of 50 symbols' : 'MHz'}
          y={r.mse.length ? undefined : [-30, 1]}
          vlines={r.mse.length ? [{ x: 6, label: 'training ends', color: 'var(--warn)' }] : [{ x: rate / 2, label: 'Nyquist', color: 'var(--warn)' }]}
        />
      </div>
    </Widget>
  );
}
