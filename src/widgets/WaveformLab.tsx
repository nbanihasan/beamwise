import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Widget } from '@/viz/controls';
import { lineEncode, pamMap, ppmMap, prbs, upsampleHold, vppmWave } from '@/sim/modulation';
import { onePole, eyeTraces } from '@/sim/dsp';
import { welchPSD } from '@/sim/fft';
import { gaussian, rng } from '@/sim/math';

/** Single-carrier IM formats: what the waveform, spectrum, eye and dimming level look like. */
type Mod = 'nrz' | 'manchester' | 'rz' | '4b6b' | 'ppm4' | 'vppm' | 'pam4';
const INFO: Record<Mod, { label: string; bitsPerSlot: number; note: string }> = {
  nrz: { label: 'OOK-NRZ', bitsPerSlot: 1, note: 'Simplest format. Long runs of 1s or 0s cause DC wander and visible flicker unless the data is scrambled or coded.' },
  manchester: { label: 'Manchester', bitsPerSlot: 0.5, note: 'Every bit has a transition: DC-balanced, flicker-free and self-clocking, at twice the bandwidth. Used in IEEE 802.15.7 PHY I.' },
  rz: { label: 'OOK-RZ', bitsPerSlot: 0.5, note: 'Pulses return to zero mid-bit: more power-efficient than NRZ, but twice the bandwidth and a 25 % duty cycle (dim).' },
  '4b6b': { label: '4B6B', bitsPerSlot: 4 / 6, note: 'Each 4-bit group maps to a 6-chip word with exactly three 1s: DC-balanced at only 1.5× expansion (IEEE 802.15.7 PHY II).' },
  ppm4: { label: '4-PPM', bitsPerSlot: 0.5, note: 'Two bits choose which of four slots is lit. Very power-efficient (classic IR choice), but bandwidth-hungry and dim (25 %).' },
  vppm: { label: 'VPPM', bitsPerSlot: 1, note: '2-PPM whose pulse width sets the brightness: data and dimming at once (IEEE 802.15.7). Drag the dimming slider.' },
  pam4: { label: '4-PAM', bitsPerSlot: 2, note: 'Four intensity levels carry two bits per symbol: twice the spectral efficiency of OOK, but needs ~7 dB more SNR and a linear LED.' },
};

export default function WaveformLab() {
  const [mod, setMod] = useState<Mod>('manchester');
  const [bwRatio, setBw] = useState(1.2);
  const [noise, setNoise] = useState(0.06);
  const [dim, setDim] = useState(0.5);
  const sps = 16;

  const d = useMemo(() => {
    const bits = prbs(480, 5);
    let slots: Float64Array;
    let wave: Float64Array;
    if (mod === 'vppm') {
      wave = vppmWave(bits.slice(0, 240), dim, sps);
      slots = new Float64Array(0);
    } else {
      if (mod === 'ppm4') slots = Float64Array.from(ppmMap(bits, 4));
      else if (mod === 'pam4') slots = Float64Array.from(pamMap(bits, 4), (v) => (v + 1) / 2);
      else slots = Float64Array.from(lineEncode(bits, mod));
      wave = upsampleHold(slots, sps);
    }
    const g = gaussian(rng(2));
    const fs = sps; // slot rate = 1
    const filtered = onePole(wave, bwRatio, fs, 0.5).map((v) => v + noise * g());
    const mean = wave.reduce((a, b) => a + b, 0) / wave.length;
    // longest run of identical slots
    let run = 0;
    let best = 0;
    const src = mod === 'vppm' ? [] : Array.from(slots);
    src.forEach((v, i) => {
      run = i && v === src[i - 1] ? run + 1 : 1;
      best = Math.max(best, run);
    });
    const psd = welchPSD(Float64Array.from(wave, (v) => v - mean), fs, 512);
    return { wave, filtered, mean, run: best, psd, nView: 40 * sps };
  }, [mod, bwRatio, noise, dim]);

  const info = INFO[mod];
  const t = Array.from({ length: d.nView }, (_, i) => i / sps);
  const lowFreqPower = d.psd.psdDb.slice(1, 4).reduce((a, b) => a + b, 0) / 3;
  return (
    <Widget
      title="Single-carrier formats for intensity modulation"
      controls={
        <>
          <Segmented label="Format" value={mod} onChange={setMod} options={(Object.keys(INFO) as Mod[]).map((k) => ({ value: k, label: INFO[k].label }))} />
          {mod === 'vppm' && <Slider label="Dimming (duty cycle)" value={dim} min={0.1} max={0.9} step={0.05} onChange={setDim} format={(v) => `${(v * 100).toFixed(0)} %`} />}
          <Slider label="LED bandwidth ÷ slot rate" value={bwRatio} min={0.15} max={3} step={0.05} onChange={setBw} format={(v) => `${v.toFixed(2)}`} />
          <Slider label="Receiver noise" value={noise} min={0} max={0.3} step={0.01} onChange={setNoise} format={(v) => v.toFixed(2)} />
          <Readouts>
            <Readout k="Bits per slot" v={info.bitsPerSlot.toFixed(2)} />
            <Readout k="Average brightness" v={`${(d.mean * 100).toFixed(0)} %`} />
            <Readout k="Longest run" v={mod === 'vppm' ? '—' : `${d.run} slots`} tone={mod === 'vppm' ? undefined : d.run > 6 ? 'warn' : 'good'} />
          </Readouts>
          <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>
            {info.note}
          </p>
        </>
      }
      caption={
        <p>
          The top trace is what the LED is asked to do; the middle trace is the light after the LED's limited bandwidth plus receiver noise; the eye diagram overlays
          two-slot windows of that trace. A wide-open eye means easy decisions. The spectrum shows how much power sits near DC, which is what the eye perceives as flicker
          and what an AC-coupled receiver throws away.
        </p>
      }
    >
      <Plot title="Transmitted waveform" height={110} y={[-0.1, 1.1]} series={[{ x: t, y: Array.from(d.wave.slice(0, d.nView)), color: 'var(--phosphor)', width: 1.6 }]} hideYTicks />
      <Plot title="Received (LED low-pass + noise)" height={110} series={[{ x: t, y: Array.from(d.filtered.slice(0, d.nView)), color: 'var(--c6)', width: 1.2 }]} hideYTicks />
      <div className="grid-2">
        <Plot title="Eye diagram" height={180} traces={eyeTraces(d.filtered, sps, 160, sps * 4)} traceColor="var(--c6)" hideYTicks />
        <Plot
          title="Power spectrum"
          titleRight={`near-DC ${lowFreqPower.toFixed(0)} dB`}
          height={180}
          x={[0, 3]}
          xLabel="frequency ÷ slot rate"
          yLabel="dB"
          series={[{ x: d.psd.f, y: d.psd.psdDb, color: 'var(--c5)', width: 1.6 }]}
        />
      </div>
    </Widget>
  );
}
